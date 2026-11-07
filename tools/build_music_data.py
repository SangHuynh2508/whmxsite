"""public/music.json from WHMX_Tool's BGM export (spec docs/superpowers/specs/2026-11-08-music-page-design.md).

Runs on the owner's machine only (WHMX_Tool is a separate repo); Vercel uses the committed public/music.json.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BGM = ROOT.parent / "WHMX_Tool" / "Xuat" / "Audio" / "bgm"
DEFAULT_LORE_INDEX = ROOT.parent / "WHMX_Lore_By_Chapter" / "INDEX.tsv"
NAMES_VI = ROOT / "localization" / "music_names_vi.json"
OUT = ROOT / "public" / "music.json"
ORDER = ("jukebox", "story", "stage", "area", "other")
PLACEHOLDER = "预留位置"  # empty jukebox slot that points back at foundationMusic_1


def track_id(file: str) -> str:
    return Path(file).stem.lower()


def _jukebox(t: dict) -> dict | None:
    return next((j for j in t["jukebox"] if j.get("name") and j["name"] != PLACEHOLDER), None)


def groups_of(t: dict) -> list[str]:
    has = {"jukebox": _jukebox(t) is not None, "story": bool(t["stories"]), "stage": bool(t["stages"]), "area": bool(t["areas"])}
    return [g for g in ORDER[:-1] if has[g]] or ["other"]


# INDEX.tsv names a character's own story "乳鸭图 — truyện của 莲塘乳鸭图 · Liên Đường Nhũ Áp Đồ [S0088]"
CHAR_STORY = re.compile(r"^(?P<cn>.+?) — truyện của .*\[(?P<cid>[A-Z]\d{4})\]$")


def split_group(raw: str, char_vi: dict[str, str]) -> tuple[str, str]:
    """(story name, the character's reviewed VI name from data.json or '') — the TSV's own VI text is not trusted."""
    m = CHAR_STORY.match(raw)
    return (m["cn"], char_vi.get(m["cid"], "")) if m else (raw, "")


def story_groups(ids: list[str], group_of: dict[str, str], char_vi: dict[str, str] | None = None) -> list[dict]:
    counts: dict[str, int] = {}
    for sid in ids:
        g = group_of.get(sid.lower()) or sid[:4].lower()  # e022002 -> e022 when INDEX.tsv has no name
        counts[g] = counts.get(g, 0) + 1
    out = []
    for g, n in list(counts.items())[:5]:
        cn, vi = split_group(g, char_vi or {})
        out.append({"group_cn": cn, "group_vi": vi, "count": n})
    return out


def stage_summary(stages: list[dict]) -> dict:
    names = list(dict.fromkeys(s["name"] for s in stages if s.get("name")))
    return {"names_cn": names[:3], "count": len(stages)}


def build_track(t: dict, group_of: dict[str, str], names_vi: dict[str, str], char_vi: dict[str, str] | None = None) -> dict:
    tid, j, groups = track_id(t["file"]), _jukebox(t), groups_of(t)
    stories, stages = story_groups(t["stories"], group_of, char_vi), stage_summary(t["stages"])
    areas = list(dict.fromkeys(a["name"] for a in t["areas"] if a.get("name")))
    kind, label = "", ""
    if not j:
        for kind, label in (("story", stories[0]["group_cn"] if stories else ""),
                            ("stage", stages["names_cn"][0] if stages["names_cn"] else ""),
                            ("area", areas[0] if areas else "")):
            if label:
                break
        else:
            kind = ""
    return {
        "id": tid, "file": f"music/bgm/{tid}.mp3",
        "cover": f"music/covers/{Path(j['cover']).stem.lower()}.webp" if j and j.get("cover") else None,
        "group": groups[0], "groups": groups,
        "name_cn": j["name"] if j else "", "name_vi": names_vi.get(tid, "") if j else "",
        "label_kind": kind, "label_cn": label,
        "label_vi": stories[0]["group_vi"] if kind == "story" else "", "source_cn": (j or {}).get("source", ""),
        "stories": stories, "stories_total": len(t["stories"]), "stages": stages, "areas_cn": areas,
    }


def build_document(index: dict, group_of: dict[str, str], names_vi: dict[str, str], base: str,
                   char_vi: dict[str, str] | None = None) -> dict:
    tracks = [build_track(t, group_of, names_vi, char_vi) for t in index["tracks"]]
    juke_id = {track_id(t["file"]): int((_jukebox(t) or {}).get("id") or 0) for t in index["tracks"]}
    tracks.sort(key=lambda x: (ORDER.index(x["group"]), juke_id[x["id"]], x["id"]))
    return {"version": index.get("version", ""), "asset_base_url": base, "tracks": tracks}


def read_group_names(index_tsv: Path) -> dict[str, str]:
    with index_tsv.open(encoding="utf-8-sig", newline="") as f:
        return {r["SCRIPT_ID"].lower(): (r.get("GROUP_NAME_CN") or "").strip() for r in csv.DictReader(f, delimiter="\t")}


def sync_names_file(path: Path, ids: list[str]) -> dict[str, str]:
    """Keep one key per named track; never overwrite a translation."""
    names = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    merged = {i: names.get(i, "") for i in sorted(set(ids) | set(names))}
    if merged != names:
        path.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return merged


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bgm", type=Path, default=DEFAULT_BGM, help="WHMX_Tool output folder with bgm_index.json")
    ap.add_argument("--lore-index", type=Path, default=DEFAULT_LORE_INDEX)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    need = [args.bgm / "bgm_index.json", args.lore_index, ROOT / "public" / "data.json"]
    missing = [str(p) for p in need if not p.is_file()]
    if missing:
        print("Thiếu file (chạy `python whmx.py bgm` trong WHMX_Tool, hoặc chỉ đường bằng --bgm / --lore-index):\n  "
              + "\n  ".join(missing), file=sys.stderr)
        return 1
    index = json.loads((args.bgm / "bgm_index.json").read_text(encoding="utf-8"))
    named = [track_id(t["file"]) for t in index["tracks"] if _jukebox(t)]
    names_vi = sync_names_file(NAMES_VI, named)
    data = json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8"))
    char_vi = {cid: c.get("name_vi", "") for cid, c in data.get("characters", {}).items()}
    doc = build_document(index, read_group_names(args.lore_index), names_vi, data.get("asset_base_url", ""), char_vi)
    args.out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{args.out}: {len(doc['tracks'])} bài, {len(named)} có tên, {args.out.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
