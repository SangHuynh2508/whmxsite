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
DEFAULT_UPDATES = ROOT.parent / "WHMX_Tool" / "Xuat"  # `whmx.py update` writes CapNhat_<old>_den_<new>\ here
# {Chinese: Vietnamese} for every string the page shows; Claude translates it (owner 2026-11-08: "trang này nhỏ ko cần admin dịch")
MUSIC_VI = ROOT / "localization" / "music_vi.json"
OUT = ROOT / "public" / "music.json"
ORDER = ("jukebox", "story", "stage", "area", "other")
PLACEHOLDER = "预留位置"  # empty jukebox slot that points back at foundationMusic_1

# Events INDEX.tsv leaves unnamed (its README: no MasterData table links them). Evidence, masterdata r3168:
EVENT_CN = {
    "e007": "尘世异象",  # dungeonMap: the story string these scripts open is named 尘世异象
    "e009": "岁时迢迢",  # SIMplotMap; activityGroup SIM, remarks 鸟音山水养成活动
    "e011": "研学",      # YX2NarrativeMap, unlocked by item 5161 (nameRem 研学剧情道具)
    "e016": "朝闻以行",  # AnalectsAtlasMap
    "e017": "大秦回音",  # Qin cast's first meeting of 秦公镈; 2024-11-14, between e016 and e018
    "e018": "昔时今游",  # TourEventMap; activityGroup QinTour, 骊山
    "e032": "愿为穹宇",  # RogueConstants RogueLike, star theme
    "e034": "望识沧海",  # RogueConstants RogueLike2, sea theme
    "e035": "釉生净土",  # 2.5上 (2025-11-13): the one event between 望识沧海 and 镂忆琢名; porcelain plot
    "g001": "新手引导",  # lore README: g001 is the newcomer guide
}
UNKNOWN_EVENT = "未知活动"  # e005: Qin cast, no table or date ties it to an event

# Tracks no jukebox, story, stage or area uses, named after their event (never shown by file id, owner 2026-11-08).
# activityGroup r3168 key / remarks, or the exact pinyin of a story group name INDEX.tsv already has.
TRACK_EVENT = {
    "bgm_active_travel": "南船北马行",   # key travel (旅游活动)
    "bgm_crisiscontract2": "阨会之域",   # key crisiscontract2 (异变之域改版活动)
    "bgm_farm": "金穗长野望",            # 种田玩法
    "bgm_guobao": "人间千古",            # 国家宝藏活动入口
    "bgm_newyear": "新年开笔",
    "bgm_nianbeast": "良宵百载",         # key NianBeast
    "bgm_rogue2activity": "望识沧海",
    "bgm_rsdx": "人世丹心", "rsdx": "人世丹心",
    "bgm_sailingmain": "海上远旅人", "bgm_sailingrichman": "海上远旅人",  # key sailing (航海)
    "dh_parkour": "若故人来", "dh_story": "若故人来",                     # key DunHuang
    "qin_expedition": "大秦回音", "qin_main": "大秦回音", "qin_story": "大秦回音",  # key daqin (大秦 SLG)
    "fsmy": "浮生觅源", "hmwy": "衡门无忧", "jsyz": "沃土织金", "kzry": "框中日月", "kzryani": "框中日月",
    "lhsa": "两河三岸", "packup": "釉生净土", "seasonslg": "经以山海", "wdfh": "无渡风花", "wjwy": "无稽妄语",
    "yps": "问平生", "zgcx": "折光澄心", "louyizhuoming": "镂忆琢名",
    "jinzhongqiwu": "烬中起舞", "jiyechangsheng": "寂夜长生", "lueyingchenghua": "掠影成花",
    "songshiyouxin": "松石有信", "songshiyouxingame": "松石有信", "zhixiangliu": "只香留",
}


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


def story_groups(ids: list[str], group_of: dict[str, str], char_vi: dict[str, str] | None = None,
                 vi: dict[str, str] | None = None) -> list[dict]:
    counts: dict[str, int] = {}
    for sid in ids:
        sid, code = sid.lower(), sid[:4].lower()
        g = group_of.get(sid) or group_of.get(code) or EVENT_CN.get(code, UNKNOWN_EVENT)
        counts[g] = counts.get(g, 0) + 1
    out = []
    for g, n in list(counts.items())[:5]:
        cn, char = split_group(g, char_vi or {})
        out.append({"group_cn": cn, "group_vi": char or (vi or {}).get(cn, ""), "count": n})
    return out


def stage_summary(stages: list[dict], vi: dict[str, str] | None = None) -> dict:
    names = list(dict.fromkeys(s["name"] for s in stages if s.get("name")))[:3]
    return {"names_cn": names, "names_vi": [(vi or {}).get(n, "") for n in names], "count": len(stages)}


def build_track(t: dict, group_of: dict[str, str], vi: dict[str, str], char_vi: dict[str, str] | None = None) -> dict:
    tid, j, groups = track_id(t["file"]), _jukebox(t), groups_of(t)
    stories, stages = story_groups(t["stories"], group_of, char_vi, vi), stage_summary(t["stages"], vi)
    areas = list(dict.fromkeys(a["name"] for a in t["areas"] if a.get("name")))
    kind, label = "", ""
    if not j:
        for kind, label in (("story", stories[0]["group_cn"] if stories else ""),
                            ("stage", stages["names_cn"][0] if stages["names_cn"] else ""),
                            ("area", areas[0] if areas else "")):
            if label:
                break
        else:
            kind, label = "", TRACK_EVENT.get(tid, "")
    source = (j or {}).get("source", "")
    return {
        "id": tid, "file": f"music/bgm/{tid}.mp3",
        "cover": f"music/covers/{Path(j['cover']).stem.lower()}.webp" if j and j.get("cover") else None,
        "group": groups[0], "groups": groups,
        "name_cn": j["name"] if j else "", "name_vi": vi.get(j["name"], "") if j else "",
        "label_kind": kind, "label_cn": label,
        "label_vi": stories[0]["group_vi"] if kind == "story" else vi.get(label, ""),
        "source_cn": source, "source_vi": vi.get(source, ""),
        "stories": stories, "stories_total": len(t["stories"]), "stages": stages,
        "areas_cn": areas, "areas_vi": [vi.get(a, "") for a in areas],
    }


def newest_update(xuat: Path) -> tuple[str, set[str]]:
    """(new revision, ids of the bgm it added) from the latest CapNhat_<old>_den_<new> folder; ('', set()) if none."""
    runs = [(int(m[1]), m[0][1:], d) for d in (xuat.glob("CapNhat_*_den_r*") if xuat.is_dir() else [])
            if (m := re.search(r"_r(\d+)$", d.name))]
    if not runs:
        return "", set()
    _, rev, d = max(runs)
    return rev, {track_id(f.name) for f in (d / "Audio" / "bgm").glob("*.mp3")}


def build_document(index: dict, group_of: dict[str, str], vi: dict[str, str], base: str,
                   char_vi: dict[str, str] | None = None, new: tuple[str, set[str]] = ("", set())) -> dict:
    tracks = [build_track(t, group_of, vi, char_vi) for t in index["tracks"]]
    for x in tracks:
        x["new"] = x["id"] in new[1]
    juke_id = {track_id(t["file"]): int((_jukebox(t) or {}).get("id") or 0) for t in index["tracks"]}
    tracks.sort(key=lambda x: (ORDER.index(x["group"]), juke_id[x["id"]], x["id"]))
    unnamed = [x for x in tracks if not x["name_cn"] and not x["label_cn"]]
    for n, x in enumerate(unnamed, 1):  # system tracks (hall, login, gacha…): a number, not the file id
        x["label_cn"], x["label_vi"] = f"未命名曲目 {n}", f"Bài chưa rõ tên {n}"
    return {"version": index.get("version", ""), "asset_base_url": base, "new_version": new[0], "tracks": tracks}


def group_names(rows) -> dict[str, str]:
    """script id -> group name, plus event code (e015) -> the name its named scripts carry."""
    out: dict[str, str] = {}
    for r in rows:
        sid, name = r["SCRIPT_ID"].lower(), (r.get("GROUP_NAME_CN") or "").strip()
        out[sid] = name
        if name:
            out.setdefault(sid[:4], name)
    return out


def untranslated(doc: dict) -> list[str]:
    """Chinese strings the page would show with no Vietnamese."""
    miss = set()
    for t in doc["tracks"]:
        pairs = [(t["name_cn"], t["name_vi"]), (t["label_cn"], t["label_vi"]), (t["source_cn"], t["source_vi"])]
        pairs += [(s["group_cn"], s["group_vi"]) for s in t["stories"]]
        pairs += list(zip(t["stages"]["names_cn"], t["stages"]["names_vi"])) + list(zip(t["areas_cn"], t["areas_vi"]))
        miss |= {cn for cn, v in pairs if cn and not v}
    return sorted(miss)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bgm", type=Path, default=DEFAULT_BGM, help="WHMX_Tool output folder with bgm_index.json")
    ap.add_argument("--lore-index", type=Path, default=DEFAULT_LORE_INDEX)
    ap.add_argument("--updates", type=Path, default=DEFAULT_UPDATES, help="WHMX_Tool Xuat folder with CapNhat_* runs")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # Windows pipes default to cp1252
    need = [args.bgm / "bgm_index.json", args.lore_index, ROOT / "public" / "data.json", MUSIC_VI]
    missing = [str(p) for p in need if not p.is_file()]
    if missing:
        print("Thiếu file (chạy `python whmx.py bgm` trong WHMX_Tool, hoặc chỉ đường bằng --bgm / --lore-index):\n  "
              + "\n  ".join(missing), file=sys.stderr)
        return 1
    index = json.loads((args.bgm / "bgm_index.json").read_text(encoding="utf-8"))
    vi = json.loads(MUSIC_VI.read_text(encoding="utf-8"))
    data = json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8"))
    char_vi = {cid: c.get("name_vi", "") for cid, c in data.get("characters", {}).items()}
    with args.lore_index.open(encoding="utf-8-sig", newline="") as f:
        group_of = group_names(csv.DictReader(f, delimiter="\t"))
    new = newest_update(args.updates)
    doc = build_document(index, group_of, vi, data.get("asset_base_url", ""), char_vi, new)
    args.out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    miss = untranslated(doc)
    print(f"{args.out}: {len(doc['tracks'])} bài, {args.out.stat().st_size // 1024} KB, mới ở {new[0] or '—'}: {len(new[1])}, chưa dịch {len(miss)}")
    for cn in miss:
        print("  " + cn)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
