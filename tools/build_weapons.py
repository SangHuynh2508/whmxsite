"""MasterData + weapon art -> what the Vũ Khí page adds to the game document (owner 2026-11-23).

The game document (R2) already carries each weapon's name, rarity, job and skills (with the VI from the admin);
this file adds what only the game has: stats per breakthrough grade, the weapon file (hồ sơ) and the large art.

    python tools/build_weapons.py <masterdata dir> [<pic dir>]
      masterdata dir: WHMX_Tool/CDN/PhienBan/<rev>/masterdata
      pic dir: itemicon_pic_<id> PNGs (images_itemicons_pic.ab), written as public/assets/weapons/<id>.webp
Writes public/weapons.json. Text stays CN; the owner translates (CLAUDE: never fill VI here).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE_FIELDS = {"equipDefinelanText": "type", "classifylanText": "class", "materiallanText": "trait",
               "makerlanText": "maker", "textlanText": "text", "weight": "weight", "batch": "batch"}


def rows(path: Path) -> list[dict]:
    d = json.loads(path.read_text(encoding="utf-8"))
    return d if isinstance(d, list) else list(d.values())


def attr(row: dict) -> dict[str, int]:
    out = {}
    for item in row.get("Attr") or []:
        name, _, value = str(item[0] if isinstance(item, list) else item).split(",", 2)
        out[name] = int(value)
    return out


def build(master: Path) -> dict:
    files = {str(f["id"]): f for f in rows(master / "equipmentFiles.json")}
    grades: dict[str, dict[int, dict[str, int]]] = {}
    for r in rows(master / "equipmentAttrMap,.json"):
        grades.setdefault(str(r["id"]), {})[int(r["grade"])] = attr(r)
    weapons = {}
    for w in rows(master / "equipments.json"):
        wid = str(w["id"])
        g = grades.get(wid, {})
        top = g.get(max(g)) if g else None
        f = files.get(wid, {})
        weapons[wid] = {
            "tags": [t for t in re.split(r"[;；]", w.get("TagLanText") or "") if t],
            "series": w.get("Series"),
            # Max level stats = top grade + 59 × growth (checked against the CN wiki on 30321: 1849 + 59×22 = 3147)
            "grades": [{"hp": g[k].get("Hp", 0), "atk": g[k].get("Atk", 0)} for k in sorted(g)],
            "grow": {"hp": top.get("Hp_GROW", 0), "atk": top.get("Atk_GROW", 0)} if top else None,
            "file": {out: (f.get(src) or "").strip() for src, out in FILE_FIELDS.items() if f.get(src)},
        }
    return {"version": 1, "weapons": dict(sorted(weapons.items()))}


def pictures(pic_dir: Path, ids: list[str]) -> int:
    from PIL import Image
    out = ROOT / "public" / "assets" / "weapons"
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for wid in ids:
        src = next((p for p in (pic_dir / f"{wid}.png", pic_dir / f"itemicon_pic_{wid}.png") if p.exists()), None)
        if src:
            Image.open(src).save(out / f"{wid}.webp", "WEBP", quality=86, method=6)
            n += 1
    return n


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    doc = build(Path(sys.argv[1]))
    target = ROOT / "public" / "weapons.json"
    target.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(doc['weapons'])} weapons -> {target.relative_to(ROOT)}")
    if len(sys.argv) > 2:
        print(f"{pictures(Path(sys.argv[2]), list(doc['weapons']))} pictures -> public/assets/weapons/")


if __name__ == "__main__":
    main()
