"""Ingredient icons for the Quán cà phê page → public/coffee/<Icon>.webp (served locally, not R2: owner 2026-11-14).

Reads the game on MuMu through WHMX_Tool (whmx.py), so it runs on the owner's machine only. Run it, then
tools/build_coffee_data.py (which warns about any missing icon).
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "WHMX_Tool"))
import whmx  # noqa: E402

OUT = ROOT / "public" / "coffee"
dev = whmx.connect(argparse.Namespace(adb=None, device=None, package=None))
ctx = whmx.Ctx(dev, whmx.snapshot(dev))
want = {m["Icon"] for m in ctx.rows("CoffeeMatMap")}
OUT.mkdir(parents=True, exist_ok=True)
got = set()
for bundle in ("spriteatlas_wdfh.ab", "uiatlas_uiwdfh.ab"):
    for o in ctx.env(bundle).objects:
        if o.type.name == "Sprite" and (sp := o.read()).m_Name in want - got:
            im = sp.image
            im.thumbnail((160, 160))
            im.save(OUT / f"{sp.m_Name}.webp", quality=88)
            got.add(sp.m_Name)
print(f"{len(got)}/{len(want)} icon → {OUT}" + (f"; thiếu: {sorted(want - got)}" if want - got else ""))
