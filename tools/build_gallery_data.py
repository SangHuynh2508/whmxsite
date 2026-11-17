"""Thư viện ảnh data: WHMX_Tool Gallery INDEX.json + versions + VI → public/gallery.json (spec 2026-11-17)."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from build_music_data import CHAR_STORY, EVENT_CN, UNKNOWN_EVENT, load_versions, split_group, version_of

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT.parent / "WHMX_Tool"
OUT = ROOT / "public" / "gallery.json"
GALLERY_VI = Path(__file__).resolve().parent / "gallery_vi.json"
VARIANTS = Path(__file__).resolve().parent / "gallery_variants.json"  # near-identical image groups (owner 2026-11-17)
TEXT = ("name", "note", "place", "sub", "story")
VERSION = re.compile(r"^\d\.\d[上下]?$")  # "3.4上": the page formats it (musicData versionLabel), not a translation
PLACEHOLDER = re.compile(r"^名字测试\d*$")  # dev placeholder names in collectCGs (CG61006, CG61023)


def _latest(pattern: str) -> Path | None:
    hits = sorted(TOOL.glob(pattern), key=lambda p: int(re.sub(r"\D", "", p.name) or 0))
    return hits[-1] if hits else None


def story_group(x: dict, starts: dict[str, int], versions: list[dict]) -> tuple[str, str]:
    """(group, sub): events → v<major> + version label, or old; main story → chapter; the rest → other + its group."""
    sec = x.get("section", "")
    if sec == "Events":
        name = x.get("group_cn") or EVENT_CN.get(x.get("category", ""), UNKNOWN_EVENT)
        v = version_of([name], starts, versions)
        return (f"v{v[0]}", v) if v else ("old", name)  # before 2.5 / undated: one tab per event
    if sec == "Main_Story":
        return "main", re.sub(r"\s*\(.*\)$", "", x.get("group_cn", ""))
    return "other", split_group(x.get("group_cn", ""), {})[0] or sec


def story_name(x: dict) -> str:
    """The story / event a story CG opens in: the INDEX group of its first script, tidied like `sub`;
    '' when the lore names none (never invented)."""
    sec = x.get("section", "")
    if sec == "Events":
        return x.get("group_cn") or EVENT_CN.get(x.get("category", ""), "")
    if sec == "Main_Story":
        return re.sub(r"\s*\(.*\)$", "", x.get("group_cn", ""))
    return split_group(x.get("group_cn", ""), {})[0]


def variant_groups(groups: list, items: list[dict]) -> list:
    """Groups of near-identical images → [[kind, [ids]]] of the items present, order kept (first id = the tile).
    Groups left with one image are dropped; an image in two groups is a data error."""
    have = {(i["kind"], i["id"]) for i in items}
    out, seen = [], set()
    for kind, ids in groups:
        keep = [i for i in ids if (kind, i) in have]
        dup = [i for i in keep if (kind, i) in seen]
        if dup:
            raise SystemExit(f"gallery_variants.json: {kind} {dup} đã nằm ở nhóm khác")
        seen.update((kind, i) for i in keep)
        if len(keep) > 1:
            out.append([kind, keep])
    return out


def build_document(index: dict, vi: dict[str, str], base: str, starts: dict[str, int], versions: list[dict],
                   char_vi: dict[str, str] | None = None, variants: list | None = None) -> dict:
    vi = dict(vi)
    for x in index["items"]:  # a character's story is named after the character: reuse its reviewed VI name
        m = CHAR_STORY.match(x.get("group_cn", ""))
        if m and (char_vi or {}).get(m["cid"]):
            vi.setdefault(m["cn"], char_vi[m["cid"]])
    items = []
    for x in index["items"]:
        if not x.get("png"):
            continue
        group, sub = story_group(x, starts, versions) if x["kind"] == "story" else ("", "")
        y = {"id": x["id"], "kind": x["kind"], "file": f"gallery/{x['kind']}/{x['id']}", "w": x["w"], "h": x["h"],
             "name_cn": "" if PLACEHOLDER.match(x.get("name_cn", "")) else x.get("name_cn", ""), "note_cn": x.get("note_cn", ""), "place_cn": x.get("place_cn", ""),
             "group": group, "sub_cn": sub, "story_cn": story_name(x) if x["kind"] == "story" else ""}
        for k in TEXT:
            y[f"{k}_vi"] = vi.get(y[f"{k}_cn"], "") if y[f"{k}_cn"] and not VERSION.match(y[f"{k}_cn"]) else ""
        items.append(y)
    return {"version": index.get("version", ""), "asset_base_url": base, "items": items,
            "variants": variant_groups(variants or [], items)}


def with_all(index: dict) -> dict:
    """The index with every item kept, png or not (sizes 0) — for listing texts before the images exist."""
    return {**index, "items": [{"w": 0, "h": 0, **x, "png": x.get("png") or "-"} for x in index["items"]]}


def untranslated(doc: dict) -> list[str]:
    return list(dict.fromkeys(i[f"{k}_cn"] for i in doc["items"] for k in TEXT if i[f"{k}_cn"] and not i[f"{k}_vi"] and not VERSION.match(i[f"{k}_cn"])))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--index", type=Path, default=(_latest("Xuat/Gallery_r*") or TOOL / "Xuat" / "Gallery") / "INDEX.json")
    ap.add_argument("--master", type=Path, default=(_latest("PhienBan/r*") or TOOL / "PhienBan") / "masterdata")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--base", help="asset_base_url khác R2, CHỈ để thử cục bộ (không để lại gallery.json đó)")
    ap.add_argument("--strings", action="store_true", help="in mọi chuỗi CN chưa dịch (kể cả mục chưa có ảnh) rồi thoát")
    args = ap.parse_args()
    if not args.index.is_file():
        print(f"Thiếu {args.index} (chạy `python whmx.py gallery` trong WHMX_Tool)", file=sys.stderr)
        return 1
    index = json.loads(args.index.read_text(encoding="utf-8"))
    vi = json.loads(GALLERY_VI.read_text(encoding="utf-8")) if GALLERY_VI.is_file() else {}
    starts, versions = load_versions(args.master)
    data = json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8"))
    char_vi = {cid: c.get("name_vi", "") for cid, c in data.get("characters", {}).items()}
    if args.strings:  # every item counts here, png or not, so translation can run before the export
        doc = build_document(with_all(index), vi, "", starts, versions, char_vi)
        print("\n".join(untranslated(doc)))
        return 0
    variants = json.loads(VARIANTS.read_text(encoding="utf-8")) if VARIANTS.is_file() else []
    doc = build_document(index, vi, args.base or data.get("asset_base_url", ""), starts, versions, char_vi, variants)
    args.out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    miss = untranslated(doc)
    print(f"{args.out}: {len(doc['items'])} ảnh, {len(doc['variants'])} nhóm gần giống, {args.out.stat().st_size // 1024} KB, chưa dịch {len(miss)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
