"""Find the face in each banner's UP skin drawing → tools/banner_focus_auto.json (skinID → {x, y, h}, 0..1 of the image).

  python tools/banner_focus.py            # new skins only
  python tools/banner_focus.py --all      # redo every skin
  python tools/banner_focus.py --sheet    # + scratch/banner_focus_sheet.html to review every slice

The web places the drawing so this point lands in the slice's figure spot (BannerSlice.tsx). Wrong ones: fix by banner
skin in tools/banner_focus.json ({"V0076001": {"x": .5, "y": .2, "h": .06}}), made with the --sheet page (click the
face); only that file reaches the web. The detector is right on about half the drawings (props and patterns fool it), so the
page marks its guesses for review. Face detector: lbpcascade_animeface (MIT, tools/vendor/).
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
AUTO = ROOT / "tools" / "banner_focus_auto.json"
CASCADE = ROOT / "tools" / "vendor" / "lbpcascade_animeface.xml"


def pick_face(faces: list[tuple[int, int, int, int]], w: int, h: int) -> dict | None:
    """The biggest face in the top 70% of the drawing (a face lower down is usually a held object or a false hit)."""
    ok = [f for f in faces if f[1] + f[3] / 2 < 0.7 * h]
    if not ok:
        return None
    x, y, fw, fh = max(ok, key=lambda f: f[2] * f[3])
    return {"x": round((x + fw / 2) / w, 4), "y": round((y + fh / 2) / h, 4), "h": round(fh / h, 4)}


def detect(img: Image.Image, cascade) -> dict | None:
    rgba = img.convert("RGBA")
    flat = Image.new("RGB", rgba.size, (255, 255, 255))  # transparent background → white, like the detector's training art
    flat.paste(rgba, mask=rgba.getchannel("A"))
    scale = 2400 / max(flat.size)  # faces are ~6% of a full-body drawing: 2400 px, 32 px min, 3 neighbours found 58/71
    small = flat.resize((round(flat.width * scale), round(flat.height * scale)))
    gray = cv2.equalizeHist(cv2.cvtColor(np.array(small), cv2.COLOR_RGB2GRAY))
    faces = cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(32, 32))
    return pick_face([tuple(int(v) for v in f) for f in faces], small.width, small.height)


def banner_skins(banners: dict, data: dict) -> dict[str, str]:
    """skinID → image URL, for every banner's UP skin."""
    img = {s["skinID"]: s.get("image") for c in data["characters"].values() for s in c.get("skins") or []}
    return {b["up_skin"]: img[b["up_skin"]] for b in banners["banners"] if b.get("up_skin") and img.get(b["up_skin"])}


def sheet(banners: dict, data: dict, auto: dict, manual: dict, out: Path) -> None:
    """A local page: one card per UP skin, its slice preview and the drawing. Click the face on the drawing, set the
    size, then "Tải banner_focus.json" and save it over tools/banner_focus.json."""
    img = {s["skinID"]: s.get("image") for c in data["characters"].values() for s in c.get("skins") or []}
    base = banners["asset_base_url"].rstrip("/")
    cards = {}
    for b in banners["banners"]:
        k = b.get("up_skin")
        if k and img.get(k) and k not in cards:
            cards[k] = {"skin": k, "name": b["name_cn"], "fig": img[k], "bg": f"{base}/{b['art']}" if b.get("art") else "",
                        "focus": manual.get(k) or auto.get(k), "src": "tay" if k in manual else "máy" if auto.get(k) else ""}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(SHEET.replace("__DATA__", json.dumps(list(cards.values()), ensure_ascii=False)), encoding="utf-8")
    print(f"{out}: {len(cards)} skin")


SHEET = """<!doctype html><meta charset=utf-8><title>Banner focus</title><style>
body{background:#111;color:#ccc;font:13px sans-serif;margin:0;padding:12px}
header{position:sticky;top:0;background:#111;padding:8px 0;z-index:9;display:flex;gap:12px;align-items:center}
button{font:inherit;padding:6px 12px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:16px}
.c{display:grid;grid-template-columns:1fr 150px;gap:8px;background:#1a1a1a;padding:8px}
.c.todo{outline:2px solid #c33}.c.guess{outline:2px dashed #ca3}
.s{position:relative;aspect-ratio:3/1.1;overflow:hidden;background:#222}
.s .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.s .fig{position:absolute;right:2%;top:-8%;height:250%}
.s .fig.f{right:auto;left:72%;top:40%;height:var(--fs);transform:translate(calc(var(--fx)*-100%),calc(var(--fy)*-100%))}
.d{position:relative;background:#fff;cursor:crosshair}.d img{width:100%;display:block}
.d i{position:absolute;border:2px solid #e33;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.m{grid-column:1/-1;display:flex;gap:10px;align-items:center}
</style><header><b>Bấm vào mặt trên ảnh bên phải · kéo thanh để chỉnh cỡ mặt</b>
<span id=n></span><button id=ok>Đánh dấu tất cả "máy" là đúng</button><button id=dl>Tải banner_focus.json</button></header><main id=g></main>
<script>
const D=__DATA__, g=document.getElementById('g');
const fs=h=>Math.min(400,Math.max(120,28/h));
function draw(c,e){const f=c.focus, fig=e.querySelector('.fig'), dot=e.querySelector('i');
 e.className='c'+(f?(c.src==='máy'?' guess':''):' todo');
 e.querySelector('.m span').textContent=c.skin+' · '+c.name+' · '+(f?(c.src==='máy'?'máy đoán':'đã chỉnh'):'CHƯA CÓ');
 if(!f){fig.className='fig';dot.style.display='none';return}
 fig.className='fig f';fig.style.cssText=`--fx:${f.x};--fy:${f.y};--fs:${fs(f.h)}%`;
 const img=e.querySelector('.d img');dot.style.display='';dot.style.left=f.x*100+'%';dot.style.top=f.y*100+'%';
 dot.style.width=dot.style.height=(f.h*img.clientHeight*1.2)+'px';e.querySelector('input').value=f.h;count()}
function count(){document.getElementById('n').textContent=D.filter(c=>c.focus&&c.src!=='máy').length+'/'+D.length+' đã chỉnh, '+D.filter(c=>!c.focus).length+' chưa có'}
for(const c of D){const e=document.createElement('div');
 e.innerHTML=`<div class=s>${c.bg?`<img class=bg src="${c.bg}">`:''}<img class=fig src="${c.fig}"></div><div class=d><img src="${c.fig}"><i></i></div>
 <div class=m><span></span><label>cỡ mặt <input type=range min=.02 max=.2 step=.002></label></div>`;
 e.querySelector('.d').onclick=ev=>{const r=ev.currentTarget.getBoundingClientRect();
  c.focus={x:+((ev.clientX-r.left)/r.width).toFixed(4),y:+((ev.clientY-r.top)/r.height).toFixed(4),h:c.focus?.h||.06};c.src='tay';draw(c,e)};
 e.querySelector('input').oninput=ev=>{if(!c.focus)return;c.focus.h=+ev.target.value;c.src='tay';draw(c,e)};
 e.querySelector('.d img').onload=()=>draw(c,e);g.append(e);c.el=e;draw(c,e)}
document.getElementById('ok').onclick=()=>{for(const c of D)if(c.src==='máy'){c.src='tay';draw(c,c.el)}};
document.getElementById('dl').onclick=()=>{const o={};for(const c of D)if(c.focus&&c.src==='tay')o[c.skin]=c.focus;
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'}));a.download='banner_focus.json';a.click()};
count();
</script>"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--sheet", action="store_true")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    banners = json.loads((ROOT / "public" / "banners.json").read_text(encoding="utf-8"))
    data = json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8"))
    auto = {} if args.all or not AUTO.exists() else json.loads(AUTO.read_text(encoding="utf-8"))
    cascade = cv2.CascadeClassifier(str(CASCADE))
    todo = {k: v for k, v in banner_skins(banners, data).items() if k not in auto}
    for n, (skin, url) in enumerate(sorted(todo.items()), 1):
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "WhmxCalc-banner-focus"}), timeout=60) as r:
            auto[skin] = detect(Image.open(io.BytesIO(r.read())), cascade)
        print(f"{n}/{len(todo)} {skin} {auto[skin] or 'không thấy mặt'}")
    AUTO.write_text(json.dumps(dict(sorted(auto.items())), indent=1) + "\n", encoding="utf-8")
    miss = sorted(k for k, v in auto.items() if not v)
    print(f"{AUTO}: {len(auto)} skin, không thấy mặt {len(miss)}" + (": " + ", ".join(miss) if miss else ""))
    if args.sheet:
        manual_f = ROOT / "tools" / "banner_focus.json"
        manual = json.loads(manual_f.read_text(encoding="utf-8")) if manual_f.exists() else {}
        sheet(banners, data, {k: v for k, v in auto.items() if v}, manual, ROOT / "scratch" / "banner_focus_sheet.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
