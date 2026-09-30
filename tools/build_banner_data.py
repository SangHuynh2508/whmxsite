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


def pick_hero(rows: list[dict], now: int, art_dir: Path) -> dict | None:
    for r in rows:
        if r.get("KV") and int(r["StartTime"]) <= now < int(r["EndTime"]):
            kv = r["KV"]
            return {"kv": kv, "name_cn": r.get("NameLanText") or "",
                    "art": f"kv/{kv}.webp" if (art_dir / f"{kv}.png").exists() else None,
                    "start": int(r["StartTime"]), "end": int(r["EndTime"])}
    return None


def build_banners(pools: list[dict], skin_ids: set[str], art_dir: Path) -> list[dict]:
    out = []
    for p in pools:
        if not p.get("startTime") or p.get("hidden"):
            continue
        up = list(p.get("characterShow") or [])
        skin = f"{up[0]}{p['characterSkinShow']}" if up and p.get("characterSkinShow") else None
        out.append({"id": str(p["id"]), "name_cn": p.get("nameLanText") or p.get("name") or "", "name_vi": None,
                    "type": p.get("type") or "", "kind_cn": p.get("kindNameLanText") or "",
                    "start": int(p["startTime"]), "end": int(p["endTime"]), "up": up,
                    "up_skin": skin if skin in skin_ids else None,
                    "art": f"banners/{p['id']}.webp" if (art_dir / f"PoolBg_{p['id']}.png").exists() else None,
                    "title": f"banners/title/{p['id']}.webp" if (art_dir / f"PoolIcon_{p['id']}.png").exists() else None,
                    "choice": len(_list(p.get("changeList"))) if p.get("kind") == "choiceness" else None})
    return sorted(out, key=lambda x: (-x["start"], x["id"]))


def build_document(master_dir: Path, data_json: Path, art_dir: Path, now: int, masterdata: str) -> dict:
    data = json.loads(data_json.read_text(encoding="utf-8"))
    skin_ids = {s["skinID"] for c in data["characters"].values() for s in c.get("skins") or []}
    version = pick_version(_rows(master_dir / "ActivityVersionMap.json"), now)
    return {"generated_at": now, "masterdata": masterdata, "asset_base_url": data.get("asset_base_url", ""),
            "version": version, "hero": pick_hero(_rows(master_dir / "LoginBackgroundMap.json"), now, art_dir),
            "events": pick_events(_rows(master_dir / "ActivityOverAllMap.json"), version),
            "banners": build_banners(_rows(master_dir / "cardPools.json"), skin_ids, art_dir)}


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
    doc = build_document(MASTER, ROOT / "public" / "data.json", ART_DIR, args.now, masterdata_version(MASTER))
    OUT.write_text(dumps(doc), encoding="utf-8")
    print(f"banners.json: {len(doc['banners'])} banners, {len(doc['events'])} events, "
          f"version {doc['version'] and doc['version']['label']}, hero {doc['hero'] and doc['hero']['kv']}, "
          f"art {sum(1 for x in doc['banners'] if x['art'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
