"""MasterData → public/banners.json (current version, hero KV, events, every timed banner).

Spec: docs/superpowers/specs/2026-09-30-home-banners-design.md §3. Run on release day after the MasterData refresh
and the banner-art extraction (tools/publish_banner_art.py --extract-only), then commit public/banners.json.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT.parent / "NeoArtifacts" / "MasterData" / "json"
ART_DIR = ROOT.parent / "NeoArtifacts" / "Assets" / "banners"
OUT = ROOT / "public" / "banners.json"


def _rows(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else list(data.values())


def _list(value) -> list:
    return json.loads(value) if isinstance(value, str) else list(value or [])


def pick_version(rows: list[dict], now: int) -> dict | None:
    for r in rows:
        if int(r["StartTime"]) <= now < int(r["EndTime"]):
            label = re.sub(r"版本热点活动总览$", "", r.get("NameLanText") or "")
            return {"id": str(r["Version"]), "label": label, "start": int(r["StartTime"]), "end": int(r["EndTime"])}
    return None


def pick_events(rows: list[dict], version: dict | None) -> list[dict]:
    if not version:
        return []
    out = [{"id": r["ID"], "name_cn": r.get("NameLanText") or "", "kind_cn": r.get("DescLanText") or "",
            "start": int(r["StartTime"]), "end": int(r["EndTime"])} for r in rows if str(r.get("Version")) == version["id"]]
    return sorted(out, key=lambda e: (e["start"], e["id"]))


def _art(path: str, png: Path, published: set[str]) -> str | None:
    """Art path when extracted locally or already published (NeoArtifacts images get pruned between releases)."""
    return path if png.exists() or path in published else None


def published_art(doc: dict) -> set[str]:
    return {x for x in [(doc.get("hero") or {}).get("art")] + [v for bn in doc.get("banners") or [] for v in (bn.get("art"), bn.get("title"))] if x}


def pick_hero(rows: list[dict], now: int, art_dir: Path, published: set[str] = frozenset()) -> dict | None:
    for r in rows:
        if r.get("KV") and int(r["StartTime"]) <= now < int(r["EndTime"]):
            kv = r["KV"]
            return {"kv": kv, "name_cn": r.get("NameLanText") or "",
                    "art": _art(f"kv/{kv}.webp", art_dir / f"{kv}.png", published),
                    "start": int(r["StartTime"]), "end": int(r["EndTime"])}
    return None


GRACE = 3 * 86400  # a first banner may open a little after the release stamp; later than this = a rerun


def misdated(banners: list[dict], unlock: dict[str, int]) -> list[str]:
    """UP characters whose earliest banner opens well after their release: the first run is missing."""
    first: dict[str, int] = {}
    for x in banners:
        for u in x.get("up") or []:
            first[u] = min(x["start"], first.get(u, x["start"]))
    return sorted(u for u, t in first.items() if unlock.get(u) and t > unlock[u] + GRACE)


def restore_first_runs(banners: list[dict], unlock: dict[str, int]) -> list[dict]:
    """cardPools.json keeps one start/end per pool, so a rerun overwrites the first run (the 2024-04-19 launch pools
    only showed their 2025 reruns). The first run opens one minute after the UP character's release stamp
    (characterTable UnlockDate is 09:59, banners open 10:00) and ends one minute before the next banner window."""
    late = set(misdated(banners, unlock))
    added: dict[str, dict] = {}
    for x in sorted(banners, key=lambda x: x["start"]):
        u = next((u for u in x.get("up") or [] if u in late), None)
        if u and x["id"] not in added:
            added[x["id"]] = {**x, "id": f"{x['id']}-r1", "start": unlock[u] + 60}
            late.discard(u)
    out = banners + list(added.values())
    starts = sorted({x["start"] for x in out})
    for r in added.values():
        later = [t for t in starts if t > r["start"]]
        r["end"] = later[0] - 60 if later else r["end"]
    return sorted(out, key=lambda x: (-x["start"], x["id"]))


def build_banners(pools: list[dict], skin_ids: set[str], art_dir: Path, published: set[str] = frozenset(),
                  focus: dict | None = None) -> list[dict]:
    """focus: where the UP drawing's face is ({x, y, h}, 0..1), by skin, from tools/banner_focus.json (set by hand on
    the banner_focus.py --sheet page). The detector's guesses are only its starting point: half of them are wrong."""
    out = []
    for p in pools:
        # oldtime = the 2022 test standard pools (强化A池), before the 2024-04-19 launch
        if not p.get("startTime") or p.get("hidden") or p.get("type") == "oldtime":
            continue
        up = list(p.get("characterShow") or [])
        skin = f"{up[0]}{p['characterSkinShow']}" if up and p.get("characterSkinShow") else None
        out.append({"id": str(p["id"]), "name_cn": p.get("nameLanText") or p.get("name") or "", "name_vi": None,
                    "type": p.get("type") or "", "kind_cn": p.get("kindNameLanText") or "",
                    "start": int(p["startTime"]), "end": int(p["endTime"]), "up": up,
                    "up_skin": skin if skin in skin_ids else None,
                    "art": _art(f"banners/{p['id']}.webp", art_dir / f"PoolBg_{p['id']}.png", published),
                    "title": _art(f"banners/title/{p['id']}.webp", art_dir / f"PoolIcon_{p['id']}.png", published),
                    "choice": len(_list(p.get("changeList"))) if p.get("kind") == "choiceness" else None,
                    "focus": (focus or {}).get(skin) if skin in skin_ids else None})
    return sorted(out, key=lambda x: (-x["start"], x["id"]))


def build_document(master_dir: Path, data_json: Path, art_dir: Path, now: int, masterdata: str,
                   published: set[str] = frozenset(), focus: dict | None = None) -> dict:
    data = json.loads(data_json.read_text(encoding="utf-8"))
    skin_ids = {s["skinID"] for c in data["characters"].values() for s in c.get("skins") or []}
    version = pick_version(_rows(master_dir / "ActivityVersionMap.json"), now)
    return {"generated_at": now, "masterdata": masterdata, "asset_base_url": data.get("asset_base_url", ""),
            "version": version, "hero": pick_hero(_rows(master_dir / "LoginBackgroundMap.json"), now, art_dir, published),
            "events": pick_events(_rows(master_dir / "ActivityOverAllMap.json"), version),
            "banners": restore_first_runs(build_banners(_rows(master_dir / "cardPools.json"), skin_ids, art_dir, published, focus),
                                          {cid: c["unlock_date"] for cid, c in data["characters"].items() if c.get("unlock_date")})}


def dumps(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


def masterdata_version(master_dir: Path) -> str:
    launches = sorted((master_dir.parent / "provenance").glob("launch_*.json"))
    if not launches:
        return ""
    return json.loads(launches[-1].read_text(encoding="utf-8"))["launch"]["ConfigVersion_v2"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--now", type=int, default=int(time.time()), help="unix seconds (tests / reproducing a build)")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # CJK labels; a piped Windows stdout is cp1252
    published = published_art(json.loads(OUT.read_text(encoding="utf-8"))) if OUT.exists() else set()
    load = lambda f: json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    doc = build_document(MASTER, ROOT / "public" / "data.json", ART_DIR, args.now, masterdata_version(MASTER), published,
                         load(ROOT / "tools" / "banner_focus.json"))
    unlock = {cid: c["unlock_date"] for cid, c in json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8"))["characters"].items() if c.get("unlock_date")}
    if late := misdated(doc["banners"], unlock):
        print("Khí Giả có banner sớm nhất trễ hơn ngày ra mắt (thiếu lần chạy đầu): " + ", ".join(late), file=sys.stderr)
        return 1
    OUT.write_text(dumps(doc), encoding="utf-8")
    print(f"banners.json: {len(doc['banners'])} banners, {len(doc['events'])} events, "
          f"version {doc['version'] and doc['version']['label']}, hero {doc['hero'] and doc['hero']['kv']}, "
          f"art {sum(1 for x in doc['banners'] if x['art'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
