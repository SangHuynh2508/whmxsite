"""public/coffee.json for the Quán cà phê page (event 一日店长, CoffeeXxxMap tables).

Runs on the owner's machine (WHMX_Tool is a separate folder); Vercel uses the committed public/coffee.json.
Only customer (character) names get Vietnamese, from public/data.json; everything else stays Chinese (owner 2026-11-14).
Ingredient icons: public/coffee/<Icon>.webp, exported from spriteatlas_wdfh.ab by WHMX_Tool.
Usage: python tools/build_coffee_data.py [--snap ../WHMX_Tool/PhienBan/r3173]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPS = ROOT.parent / "WHMX_Tool" / "PhienBan"
OUT = ROOT / "public" / "coffee.json"
# Customers that are story NPCs, not in data.json. CN = their speaker name in the event lore
# (WHMX_Lore_By_Chapter: 银摩竭 [V0187] ×96, 商周木耜 [D0067]); VI = Hán-Việt. Avatar: V0187 = the game's avatar,
# D0067 has none, so it is a crop of the face from drawing d0067001 (public/coffee/avatar_<id>.webp).
NPC = {"V0187": ("银摩竭", "Ngân Ma Kiệt"), "D0067": ("商周木耜", "Thương Chu Mộc Tự")}


def rows(md: Path, table: str) -> list:
    d = json.loads((md / f"{table}.json").read_text(encoding="utf-8"))
    return d if isinstance(d, list) else list(d.values())


def build(snap: Path) -> dict:
    md = snap / "masterdata"
    chars = json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8"))["characters"]
    game_cn = {r["id"]: r.get("namelanText") or "" for r in rows(md, "characterTable")}
    tags = {r["Id"]: r["NameLanText"] for r in rows(md, "CoffeeTagMap")}
    mats = {}
    for m in rows(md, "CoffeeMatMap"):
        mats[m["Id"]] = {"id": m["Id"], "slot": m["Category"], "lv": m["UnlockLv"], "name_cn": m["NameLanText"],
                         "icon": m["Icon"], "tag": tags.get(m["TagIds"], ""),
                         "desc_cn": m["DescLanText"]}
    customers = {}
    for c in rows(md, "CoffeeCustomerMap"):
        cid, ch = c["CharacterId"], chars.get(c["CharacterId"]) or {}
        npc = NPC.get(cid)
        customers[c["Id"]] = {"id": cid if ch else "", "name_cn": ch.get("name_cn") or game_cn.get(cid, "") or (npc or ("", ""))[0],
                              "name_vi": ch.get("name_vi") or (npc or ("", ""))[1], "slug": ch.get("slug") or "",
                              "avatar": f"/coffee/avatar_{cid}.webp" if npc and not ch else ""}
    recipes = []
    for r in sorted(rows(md, "CoffeeRecipeMap"), key=lambda r: r["Id"]):
        recipes.append({"id": r["Id"], "lv": r["UnlockLv"], "name_cn": r["NameLanText"],
                        "hint_cn": r["DescLanText"],
                        "tags": [tags[t] for t in r["TagList"]], "mats": r["MaterialList"],
                        "customer": customers.get(r["CustomerId"], {"id": "", "name_cn": "", "name_vi": "", "slug": "", "avatar": ""})})
    shop = [{"lv": r["Lv"], "need": r["NeedStar"], "name_cn": r["NameLanText"]} for r in rows(md, "CoffeeShopLevelMap")]
    version = json.loads((snap / "info.json").read_text(encoding="utf-8"))["version"]
    return {"version": version, "ingredients": sorted(mats.values(), key=lambda m: (m["slot"], m["id"])),
            "recipes": recipes, "shop": sorted(shop, key=lambda s: s["lv"])}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--snap", type=Path, default=max(SNAPS.glob("r*"), key=lambda p: p.name))
    doc = build(ap.parse_args().snap)
    ids = {m["id"] for m in doc["ingredients"]}
    assert all(len(r["mats"]) == 3 and set(r["mats"]) <= ids for r in doc["recipes"]), "recipe points at a missing ingredient"
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    missing = sorted({m["icon"] for m in doc["ingredients"] if not (OUT.parent / "coffee" / f"{m['icon']}.webp").exists()})
    print(f"{OUT.name}: {len(doc['recipes'])} công thức, {len(doc['ingredients'])} nguyên liệu, bản {doc['version']}"
          + (f"; thiếu icon: {missing}" if missing else ""))


if __name__ == "__main__":
    main()
