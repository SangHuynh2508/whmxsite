"""public/voice/ from WHMX_Tool's `voice` export (spec docs/superpowers/specs/2026-11-19-voice-tab-design.md).

Runs on the owner's machine only (WHMX_Tool is a separate repo); Vercel uses the committed public/voice/.
index.json lists the characters that have at least one exported line; <ID>.json holds one character's lines.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_AUDIO = ROOT.parent / "WHMX_Tool" / "Xuat" / "Audio"
OUT = ROOT / "public" / "voice"


def line_key(cid: str, lang: str, line: dict) -> str | None:
    """Object key on R2 (relative to asset_base_url); None when the line's mp3 was not exported."""
    if not line.get("file"):
        return None
    return f"voice/{cid.lower()}/{lang}/{line['skin'].lower()}_{line['type']}.mp3"


def zone_text(zone: str) -> str:
    """'6,0,18,0' (characterLines.TimeLine_<n>_zone) -> '6:00–18:00'."""
    try:
        h1, m1, h2, m2 = (int(x) for x in zone.split(","))
    except ValueError:
        return ""
    return f"{h1}:{m1:02d}–{h2}:{m2:02d}"


def char_doc(c: dict, version: str, base: str) -> dict:
    langs = []
    for L in c["langs"]:
        lines = []
        for l in L["lines"]:
            out = {"skin": l["skin"], "type": l["type"], "order": l["order"], "label": l.get("label", ""),
                   "text": l.get("text", ""), "key": line_key(c["id"], L["lang"], l)}
            if l.get("unlock"):
                out["unlock"] = l["unlock"]
            if z := zone_text(l.get("zone", "")):
                out["zone"] = z
            if l.get("cv"):
                out["cv"] = l["cv"]
            lines.append(out)
        langs.append({"lang": L["lang"], "name": L.get("name", ""), "cv": L.get("cv", ""), "lines": lines})
    return {"version": version, "asset_base_url": base, "id": c["id"], "langs": langs}


def build(voice: dict, base: str) -> tuple[dict, dict[str, dict]]:
    version = voice.get("version", "")
    docs = {cid: char_doc(c, version, base) for cid, c in sorted(voice["items"].items())}
    docs = {cid: d for cid, d in docs.items() if any(l["key"] for L in d["langs"] for l in L["lines"])}
    return {"version": version, "ids": list(docs)}, docs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--audio", type=Path, default=DEFAULT_AUDIO, help="WHMX_Tool Xuat/Audio (has voice_nhanvat.json)")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--base", help="asset_base_url override, for a local test only (default: public/data.json's)")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # Windows pipes default to cp1252
    src = args.audio / "voice_nhanvat.json"
    if not src.is_file():
        print(f"Thiếu {src} (chạy `python whmx.py voice` trong WHMX_Tool, hoặc chỉ đường bằng --audio)", file=sys.stderr)
        return 1
    voice = json.loads(src.read_text(encoding="utf-8"))
    base = args.base or json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8")).get("asset_base_url", "")
    index, docs = build(voice, base)
    args.out.mkdir(parents=True, exist_ok=True)
    for old in args.out.glob("*.json"):  # generated folder: drop characters that lost their voice
        if old.stem != "index" and old.stem not in docs:
            old.unlink()
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    for cid, d in docs.items():
        (args.out / f"{cid}.json").write_text(dump(d), encoding="utf-8")
    (args.out / "index.json").write_text(dump(index), encoding="utf-8")
    lines = [l for d in docs.values() for L in d["langs"] for l in L["lines"]]
    size = sum(p.stat().st_size for p in args.out.glob("*.json")) // 1024
    print(f"{args.out}: {len(docs)} nhân vật, {len(lines)} câu, {sum(1 for l in lines if l['key'])} có mp3, "
          f"{sum(1 for l in lines if not l['text'])} không chữ, {size} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
