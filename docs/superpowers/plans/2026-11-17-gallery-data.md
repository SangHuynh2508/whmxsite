# Thư viện ảnh — dữ liệu (bước 1–2 của spec) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (owner chose native + subagent review). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Từ bảng game + lore, liệt kê mọi ảnh của Thư viện ảnh (loại, tên, chữ đi kèm, nhóm phiên bản), rút png khi có MuMu, và ghi `public/gallery.json` có bản dịch VI.

**Architecture:** Hai nửa như trang Âm nhạc. `WHMX_Tool/whmx_gallery.py` (lệnh `python whmx.py gallery`) biết bundle: liệt kê mục từ masterdata/lore, rút png vào `Xuat/Gallery_<bản>/<kind>/<id>.png`, ghi `INDEX.json`; `--dry-run` chỉ liệt kê (không cần MuMu). `WhmxCalc/tools/build_gallery_data.py` đọc `INDEX.json` + masterdata (phiên bản) + bản dịch → `public/gallery.json`.

**Tech Stack:** Python 3.14, unittest, UnityPy (đã có trong WHMX_Tool), Pillow.

**Spec:** `docs/superpowers/specs/2026-11-17-gallery-page-design.md`

## Global Constraints

- Không thao tác git, không ghi DB, không đẩy R2 khi chưa được duyệt (quy ước chủ dự án).
- Phân loại theo bảng game dùng tới ảnh, không theo tên file hay kích thước. Không suy nghĩa từ tên khi thiếu bằng chứng (AGENTS.md "WHMX evidence rule"): KV không phải dạng `ui_kv<d><d>0<1|2>` thì để `name_cn` rỗng.
- Mục không tìm thấy ảnh → bỏ khỏi `gallery.json` và liệt kê, không làm hỏng build.
- Bản dịch VI do AI (skill `.agents/skills/game-translator`); 33 câu thơ bưu thiếp ghi vào danh sách cần chủ dự án xem.
- Chạy Python của dữ liệu tải về bằng `python -I`; test bằng `python -m unittest` (không có pytest).

## Review Focus

1. Một CG dùng ở nhiều truyện → lấy truyện **đầu tiên** theo thứ tự `ORDER` + tên file (giống `build_cg`), không lấy ngẫu nhiên.
2. CG tên kết thúc `sex` → hai ảnh `…f` / `…m` (nữ / nam), hai mục riêng, cùng truyện.
3. Sự kiện không có ngày trong `activityGroup` hoặc trước 2.5 → nhóm `old` ("Sự kiện trước 2.5"), không mất mục.
4. `INDEX.json` của `--dry-run` (không có png) → build vẫn chạy, in chuỗi cần dịch, nhưng `gallery.json` không có mục thiếu ảnh.
5. Hai mục khác loại trùng `id` (vd tên CG `hotelyard_bg` vừa là loading vừa là CG truyện) → khoá duy nhất là `(kind, id)`, không đè nhau.

---

### Task 1: Liệt kê mục từ bảng game (`whmx_gallery.py`, phần thuần)

**Files:**
- Create: `WHMX_Tool/whmx_gallery.py`
- Test: `WHMX_Tool/test_whmx_gallery.py`

**Interfaces:**
- Produces: `table_entries(rows: dict[str, list[dict]], kv_bundles: list[str]) -> list[dict]`; mỗi mục `{"kind", "id", "bundles": [str], "tex": str, "name_cn", "note_cn", "place_cn"}`. `kv_label(code: str) -> str`.

- [ ] **Step 1: Viết test hỏng**

```python
import unittest
import whmx_gallery as g

ROWS = {
    "collectCGs": [{"id": "CG61001", "pathCG": "hotelyard_bg.png", "nameCGLanText": "一尊江月", "sourceTipLanText": "通过活动获取"},
                   {"id": "CG61099", "pathCG": "", "nameCGLanText": "空"}],
    "BGSwitchMap": [{"Id": "1001", "Image": "ui_home_bj_di", "NameLanText": "博行派遣"}],
    "TravelPostcardMap": [{"Id": "1", "SetContent1": "ui_lx_lxwl_mxp7", "SetContent2LanText": "枫桥依旧，佳话成诗，;静行听钟声。",
                           "SetContent4LanText": "寒山寺"}],
}


class TableEntriesTest(unittest.TestCase):
    def setUp(self):
        self.items = {(e["kind"], e["id"]): e for e in g.table_entries(ROWS, ["ui_kv3401.ab", "ui_kvhuazhao.ab"])}

    def test_loading_cg(self):
        e = self.items[("loading", "CG61001")]
        self.assertEqual(e["bundles"], ["images_novel_background_hotelyard_bg.ab"])
        self.assertEqual((e["tex"], e["name_cn"], e["note_cn"]), ("hotelyard_bg", "一尊江月", "通过活动获取"))

    def test_loading_without_path_is_skipped(self):
        self.assertNotIn(("loading", "CG61099"), self.items)

    def test_home_background(self):
        e = self.items[("home", "1001")]
        self.assertEqual(e["bundles"][0], "ui_ui_home_bj_di.ab")
        self.assertEqual((e["tex"], e["name_cn"]), ("ui_home_bj_di", "博行派遣"))

    def test_postcard_keeps_poem_line_breaks(self):
        e = self.items[("postcard", "1")]
        self.assertEqual((e["place_cn"], e["note_cn"]), ("寒山寺", "枫桥依旧，佳话成诗，\n静行听钟声。"))
        self.assertIn("images_travelcards.ab", e["bundles"])

    def test_kv_labels_only_numeric_codes(self):
        self.assertEqual(self.items[("kv", "3401")]["name_cn"], "3.4上")
        self.assertEqual(self.items[("kv", "huazhao")]["name_cn"], "")
        self.assertEqual(g.kv_label("3402"), "3.4下")
        self.assertEqual(g.kv_label("19.2"), "")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Chạy, thấy hỏng** — `cd WHMX_Tool && python -m unittest test_whmx_gallery -v` → `ModuleNotFoundError: whmx_gallery`.

- [ ] **Step 3: Viết code tối thiểu**

```python
"""Thư viện ảnh: which images the web gallery shows, by the game table that uses them (spec WhmxCalc 2026-11-17)."""
from __future__ import annotations

import re
from pathlib import Path

POSTCARD_BUNDLES = ["images_travelcards.ab", "spriteatlas_travel.ab", "ui_travelcardspanel.ab", "ui_travelletterpanel.ab"]


def kv_label(code: str) -> str:
    m = re.fullmatch(r"(\d)(\d)0([12])", code)
    return f"{m[1]}.{m[2]}{'上' if m[3] == '1' else '下'}" if m else ""


def _e(kind, id_, bundles, tex, name="", note="", place=""):
    return {"kind": kind, "id": str(id_), "bundles": bundles, "tex": tex.lower(), "name_cn": name or "",
            "note_cn": note or "", "place_cn": place or ""}


def table_entries(rows: dict[str, list[dict]], kv_bundles: list[str]) -> list[dict]:
    out = []
    for r in rows.get("collectCGs", []):
        stem = Path(r.get("pathCG") or "").stem
        if stem:
            out.append(_e("loading", r["id"], [f"images_novel_background_{stem.lower()}.ab"], stem,
                          r.get("nameCGLanText"), r.get("sourceTipLanText")))
    for r in rows.get("BGSwitchMap", []):
        img = r.get("Image") or ""
        if img:
            out.append(_e("home", r["Id"], [f"ui_{img.lower()}.ab", "ui_homepanel.ab"], img, r.get("NameLanText")))
    for r in rows.get("TravelPostcardMap", []):
        img = r.get("SetContent1") or ""
        if img:
            poem = (r.get("SetContent2LanText") or r.get("SetContent2") or "").replace(";", "\n")
            out.append(_e("postcard", r["Id"], POSTCARD_BUNDLES, img, note=poem,
                          place=r.get("SetContent4LanText") or r.get("SetContent4")))
    for b in kv_bundles:
        code = b[len("ui_kv"):-len(".ab")]
        out.append(_e("kv", code, [b], f"ui_kv{code}", kv_label(code)))
    return out
```

- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh → 5 test OK.

---

### Task 2: CG truyện từ lore (dùng chung quét của `build_cg`)

**Files:**
- Modify: `WHMX_Tool/whmx_story.py` (tách `cg_first_use` ra khỏi `build_cg`, `build_cg` gọi lại nó)
- Modify: `WHMX_Tool/whmx_gallery.py`
- Test: `WHMX_Tool/test_whmx_gallery.py`

**Interfaces:**
- Produces: `whmx_story.cg_first_use(lore: Path) -> tuple[dict[str, dict], dict[str, list[str]]]` (tên CG → dòng INDEX.tsv đầu tiên; tên → danh sách "id tiêu đề"). `whmx_story.cg_variants(name: str) -> list[tuple[str, str]]`. `whmx_gallery.story_entries(lore: Path) -> list[dict]` (mục `kind="story"` có thêm `section`, `category`, `group_cn`, `script_id`, `title_cn`).

- [ ] **Step 1: Viết test hỏng** (thêm vào `test_whmx_gallery.py`)

```python
import tempfile
from pathlib import Path


def make_lore(root: Path):
    (root / "Events/e001").mkdir(parents=True)
    (root / "Main_Story/m001").mkdir(parents=True)
    (root / "INDEX.tsv").write_text(
        "SECTION\tCATEGORY\tGROUP_NAME_CN\tSCRIPT_ID\tTITLE_CN\tLINES\tFILE\n"
        "Events\te001\t花朝昔时\te001002\t第二幕\t1\tEvents/e001/e001002.txt\n"
        "Events\te001\t花朝昔时\te001001\t第一幕\t1\tEvents/e001/e001001.txt\n"
        "Main_Story\tm001\t来古 (原洛阳)\tm001001\t序\t1\tMain_Story/m001/m001001.txt\n", encoding="utf-8")
    (root / "Events/e001/e001001.txt").write_text("〔背景 cg_1_3.1〕〔背景 bg_room〕", encoding="utf-8")
    (root / "Events/e001/e001002.txt").write_text("〔背景 cg_1_3.1〕", encoding="utf-8")
    (root / "Main_Story/m001/m001001.txt").write_text("〔背景 cg_0_1sex〕", encoding="utf-8")


class StoryEntriesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        make_lore(Path(self.tmp.name))
        self.items = {e["id"]: e for e in g.story_entries(Path(self.tmp.name))}

    def tearDown(self):
        self.tmp.cleanup()

    def test_only_cg_backgrounds_and_first_script_wins(self):
        self.assertEqual(set(self.items), {"cg_1_3_1", "cg_0_1sexf", "cg_0_1sexm"})
        e = self.items["cg_1_3_1"]
        self.assertEqual((e["script_id"], e["group_cn"], e["section"]), ("e001001", "花朝昔时", "Events"))
        self.assertEqual(e["bundles"], ["images_novel_background_cg_1_3_1.ab"])

    def test_sex_variants_are_two_items(self):
        self.assertEqual(self.items["cg_0_1sexf"]["category"], "m001")
        self.assertEqual(self.items["cg_0_1sexm"]["bundles"], ["images_novel_background_cg_0_1sexm.ab"])
```

- [ ] **Step 2: Chạy, thấy hỏng** — `AttributeError: module 'whmx_gallery' has no attribute 'story_entries'`.

- [ ] **Step 3: Tách hàm trong `whmx_story.py`** — thay phần đầu `build_cg` (từ `rows = list(...)` tới hết `def variants`) bằng hai hàm cấp module, `build_cg` gọi lại:

```python
def cg_first_use(lore: Path) -> tuple[dict, dict]:
    """CG name → first INDEX.tsv row that shows it (ORDER, then file), and name → every 'id title' using it."""
    rows = list(csv.DictReader(open(lore / 'INDEX.tsv', encoding='utf-8-sig'), delimiter='\t'))
    rows.sort(key=lambda r: (ORDER.index(r['SECTION']) if r['SECTION'] in ORDER else 99, nat(r['FILE'])))
    first, uses = {}, {}
    for r in rows:
        p = lore / r['FILE']
        if not p.exists():
            continue
        for name in re.findall(r'〔背景 ([^〕]+)〕', p.read_text(encoding='utf-8')):
            if not name.lower().startswith('cg'):
                continue
            tag = f"{r['SCRIPT_ID']} {r['TITLE_CN']}".strip()
            if tag not in uses.setdefault(name, []):
                uses[name].append(tag)
            first.setdefault(name, r)
    return first, uses


def cg_variants(name: str) -> list[tuple[str, str]]:
    n = name.lower().replace('.', '_')  # scripts write cg_1_3.1 for bundle cg_1_3_1
    if n.endswith('sex'):
        return [(n + 'f', '_nu'), (n + 'm', '_nam')]  # Nhà Sưu Tầm nữ / nam
    return [(n, '')]


def build_cg(ctx, lore: Path, out: Path) -> None:
    """Each CG (〔背景 cg…〕 in the lore) goes to the folder of the first script that shows it; INDEX.tsv lists every user."""
    first, uses = cg_first_use(lore)
    variants = cg_variants
    # … phần còn lại của build_cg giữ nguyên
```

Rồi thêm vào `whmx_gallery.py`:

```python
from whmx_story import cg_first_use, cg_variants


def story_entries(lore: Path) -> list[dict]:
    first, _ = cg_first_use(lore)
    out = []
    for name, r in first.items():
        for low, _suffix in cg_variants(name):
            e = _e("story", low, [f"images_novel_background_{low}.ab"], low)
            e.update(section=r["SECTION"], category=r["CATEGORY"], group_cn=r["GROUP_NAME_CN"],
                     script_id=r["SCRIPT_ID"], title_cn=r["TITLE_CN"])
            out.append(e)
    return out
```

- [ ] **Step 4: Chạy, thấy qua** — `python -m unittest test_whmx_gallery -v` → 8 test OK. Kiểm `build_cg` không đổi hành vi: `python -c "import whmx_story"` không lỗi.

---

### Task 3: Rút ảnh + `INDEX.json` + lệnh `gallery`

**Files:**
- Modify: `WHMX_Tool/whmx_gallery.py`, `WHMX_Tool/whmx.py` (đăng ký lệnh, mục README)
- Modify: `WHMX_Tool/README.txt`
- Test: `WHMX_Tool/test_whmx_gallery.py`

**Interfaces:**
- Consumes: `table_entries`, `story_entries`.
- Produces: `pick_texture(objs: list, tex: str)` (đối tượng có `.m_Name`, `.image`), `export_gallery(ctx, lore: Path, out: Path, dry: bool) -> dict`. File `out/INDEX.json` = `{"version": str, "items": [mục + "png": "<kind>/<id>.png" | null, "w": int|null, "h": int|null]}`; `out/_THIEU.txt` liệt kê `kind\tid\tlý do`.

- [ ] **Step 1: Viết test hỏng**

```python
class FakeTex:
    def __init__(self, name, w, h):
        self.m_Name, self.m_Width, self.m_Height = name, w, h


class PickTextureTest(unittest.TestCase):
    def test_exact_name_wins_case_insensitive(self):
        objs = [FakeTex("big_other", 4000, 4000), FakeTex("UI_LX_LXWL_MXP7", 800, 500)]
        self.assertEqual(g.pick_texture(objs, "ui_lx_lxwl_mxp7").m_Name, "UI_LX_LXWL_MXP7")

    def test_single_image_bundle_falls_back_to_largest(self):
        objs = [FakeTex("a", 10, 10), FakeTex("b", 1920, 1080)]
        self.assertEqual(g.pick_texture(objs, "hotelyard_bg", single=True).m_Name, "b")

    def test_shared_bundle_without_name_is_none(self):
        self.assertIsNone(g.pick_texture([FakeTex("x", 10, 10)], "ui_lx_lxwl_mxp7"))


class DryRunTest(unittest.TestCase):
    def test_dry_run_writes_index_without_png(self):
        class Ctx:
            snap = Path("r9999")
            ab = {"images_novel_background_hotelyard_bg.ab": {}}
            def rows(self, t): return ROWS.get(t, [])
        with tempfile.TemporaryDirectory() as d:
            lore = Path(d) / "lore"; make_lore(lore)
            doc = g.export_gallery(Ctx(), lore, Path(d) / "out", dry=True)
            self.assertEqual(doc["version"], "r9999")
            self.assertTrue(all(i["png"] is None for i in doc["items"]))
            self.assertTrue((Path(d) / "out" / "INDEX.json").is_file())
            thieu = (Path(d) / "out" / "_THIEU.txt").read_text(encoding="utf-8")
            self.assertIn("home\t1001\tkhông có trong index game", thieu)
            self.assertNotIn("CG61001", thieu)
```

- [ ] **Step 2: Chạy, thấy hỏng** — `AttributeError: … pick_texture`.

- [ ] **Step 3: Viết code**

```python
import json


def pick_texture(objs: list, tex: str, single: bool = False):
    named = [o for o in objs if o.m_Name.lower() == tex.lower()]
    if named:
        return named[0]
    if single and objs:
        return max(objs, key=lambda o: o.m_Width * o.m_Height)
    return None


def _images(ctx, logical: str) -> list:
    out = []
    for o in ctx.env(logical).objects:
        if o.type.name in ("Texture2D", "Sprite"):
            x = o.read()
            if o.type.name == "Sprite":  # atlas sprite: crop size comes from its rect
                x.m_Width, x.m_Height = int(x.m_Rect.width), int(x.m_Rect.height)
            out.append(x)
    return out


def export_gallery(ctx, lore: Path, out: Path, dry: bool = False) -> dict:
    kv = sorted(n for n in ctx.ab if re.fullmatch(r"ui_kv[^/]+\.ab", n))
    rows = {t: ctx.rows(t) for t in ("collectCGs", "BGSwitchMap", "TravelPostcardMap")}
    items, missing = table_entries(rows, kv) + story_entries(lore), []
    if not dry:
        ctx.prefetch(sorted({b for e in items for b in e["bundles"] if b in ctx.ab}))
    for e in items:
        e.update(png=None, w=None, h=None)
        have = [b for b in e["bundles"] if b in ctx.ab]
        if not have:
            missing.append(f"{e['kind']}\t{e['id']}\tkhông có trong index game"); continue
        if dry:
            continue
        for b in have:
            try:
                t = pick_texture(_images(ctx, b), e["tex"], single=len(e["bundles"]) == 1)
            except Exception as ex:  # noqa: BLE001 — one bad bundle must not stop the export
                missing.append(f"{e['kind']}\t{e['id']}\t{b}: {ex}"); t = None
            if t is not None:
                f = out / e["kind"] / f"{e['id']}.png"
                f.parent.mkdir(parents=True, exist_ok=True)
                t.image.save(f)
                e.update(png=f"{e['kind']}/{e['id']}.png", w=t.image.width, h=t.image.height)
                break
        else:
            missing.append(f"{e['kind']}\t{e['id']}\tkhông thấy ảnh {e['tex']}")
    doc = {"version": ctx.snap.name, "items": items}
    out.mkdir(parents=True, exist_ok=True)
    (out / "INDEX.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "_THIEU.txt").write_text("\n".join(missing) + "\n", encoding="utf-8")
    print(f"Gallery: {len(items)} mục, có ảnh {sum(1 for i in items if i['png'])}, thiếu {len(missing)} → {out}", flush=True)
    return doc
```

Trong `whmx.py`: thêm `p = sub.add_parser("gallery", help="ảnh cho Thư viện ảnh của web: CG loading, nền sảnh, bưu thiếp, KV, CG truyện + INDEX.json")`, `p.add_argument("--dry-run", action="store_true", help="chỉ liệt kê, không cần MuMu")`, và nhánh lệnh theo mẫu lệnh `cg` (Ctx của bản mới nhất; lore = `Xuat/Lore_<bản>` mới nhất; out = `Xuat/Gallery_<bản>`; `--dry-run` cho phép `dev=None`). README: thêm một mục "gallery" dưới "cg".

- [ ] **Step 4: Chạy, thấy qua** — `python -m unittest test_whmx_gallery -v` → 12 test OK.
- [ ] **Step 5: Chạy thật dry-run** — `python whmx.py gallery --dry-run` → in số mục mỗi loại; đọc `_THIEU.txt`, ghi số vào báo cáo.

---

### Task 4: `build_gallery_data.py` → `public/gallery.json`

**Files:**
- Create: `WhmxCalc/tools/build_gallery_data.py`, `WhmxCalc/tools/gallery_vi.json` (khởi tạo `{}`)
- Test: `WhmxCalc/tools/test_build_gallery_data.py`

**Interfaces:**
- Consumes: `INDEX.json` (Task 3); `build_music_data.EVENT_CN`, `load_versions`, `version_of`; tên sự kiện đã dịch ở file `build_music_data.MUSIC_VI` (chỉ dùng ở Task 5 để chép sang).
- Produces: `story_group(item: dict, starts, versions) -> tuple[str, str]` (`group`, `sub`); `build_document(index: dict, vi: dict, base: str, starts, versions) -> dict`; `untranslated(doc) -> list[str]`; `strings(index) -> list[str]` (mọi chuỗi CN cần dịch, kể cả mục thiếu ảnh).

- [ ] **Step 1: Viết test hỏng**

```python
import unittest

import build_gallery_data as b

VERS = [{"label": "2.5上", "start": 100, "end": 200}, {"label": "3.4上", "start": 300, "end": 400}]
STARTS = {"花朝昔时": 50, "镂忆琢名": 320}


def it(kind, id_, png=True, **kw):
    return {"kind": kind, "id": id_, "png": f"{kind}/{id_}.png" if png else None, "w": 1920, "h": 1080,
            "name_cn": "", "note_cn": "", "place_cn": "", **kw}


class StoryGroupTest(unittest.TestCase):
    def test_event_with_version(self):
        x = it("story", "cg_9", section="Events", category="e040", group_cn="镂忆琢名")
        self.assertEqual(b.story_group(x, STARTS, VERS), ("v3", "3.4上"))

    def test_event_before_versions_or_undated_is_old(self):
        self.assertEqual(b.story_group(it("story", "a", section="Events", category="e001", group_cn="花朝昔时"), STARTS, VERS), ("old", ""))
        self.assertEqual(b.story_group(it("story", "c", section="Events", category="e099", group_cn=""), STARTS, VERS), ("old", ""))

    def test_unnamed_event_uses_event_cn(self):
        x = it("story", "d", section="Events", category="e035", group_cn="")
        self.assertEqual(b.story_group(x, {"釉生净土": 150}, VERS), ("v2", "2.5上"))

    def test_main_story_by_chapter(self):
        x = it("story", "e", section="Main_Story", category="m001", group_cn="来古 (原洛阳)")
        self.assertEqual(b.story_group(x, STARTS, VERS), ("main", "来古"))

    def test_other(self):
        self.assertEqual(b.story_group(it("story", "f", section="Side_Stories_B", category="b001", group_cn="火车之上"), STARTS, VERS), ("other", "火车之上"))


class DocumentTest(unittest.TestCase):
    def setUp(self):
        idx = {"version": "r3173", "items": [
            it("loading", "CG1", name_cn="一尊江月", note_cn="活动获取"),
            it("loading", "CG2", png=False, name_cn="缺图"),
            it("story", "hotelyard_bg", section="Main_Story", category="m001", group_cn="来古 (原洛阳)"),
            it("loading", "hotelyard_bg", name_cn="酒店"),
        ]}
        self.doc = b.build_document(idx, {"一尊江月": "Một Chén Giang Nguyệt", "来古": "Lai Cổ"}, "https://cdn", {}, [])
        self.by = {(i["kind"], i["id"]): i for i in self.doc["items"]}

    def test_missing_png_dropped_and_same_id_different_kind_kept(self):
        self.assertNotIn(("loading", "CG2"), self.by)
        self.assertIn(("story", "hotelyard_bg"), self.by)
        self.assertIn(("loading", "hotelyard_bg"), self.by)

    def test_fields_and_translation(self):
        x = self.by[("loading", "CG1")]
        self.assertEqual(x["file"], "gallery/loading/CG1")
        self.assertEqual((x["name_vi"], x["note_vi"], x["w"], x["h"]), ("Một Chén Giang Nguyệt", "", 1920, 1080))
        self.assertEqual(self.doc["asset_base_url"], "https://cdn")
        self.assertEqual(self.by[("story", "hotelyard_bg")]["sub_vi"], "Lai Cổ")

    def test_untranslated_and_strings(self):
        self.assertIn("活动获取", b.untranslated(self.doc))
        self.assertIn("缺图", b.strings({"items": [it("loading", "CG2", png=False, name_cn="缺图")]}))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Chạy, thấy hỏng** — `cd WhmxCalc/tools && python -m unittest test_build_gallery_data -v` → `ModuleNotFoundError`.

- [ ] **Step 3: Viết code**

```python
"""Thư viện ảnh data: WHMX_Tool Gallery INDEX.json + versions + VI → public/gallery.json (spec 2026-11-17)."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from build_music_data import EVENT_CN, load_versions, version_of

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT.parent / "WHMX_Tool"
OUT = ROOT / "public" / "gallery.json"
GALLERY_VI = Path(__file__).resolve().parent / "gallery_vi.json"
TEXT = ("name", "note", "place", "sub")


def _latest(pattern: str) -> Path | None:
    hits = sorted(TOOL.glob(pattern), key=lambda p: int(re.sub(r"\D", "", p.name) or 0))
    return hits[-1] if hits else None


def story_group(x: dict, starts: dict[str, int], versions: list[dict]) -> tuple[str, str]:
    sec = x.get("section", "")
    if sec == "Events":
        name = x.get("group_cn") or EVENT_CN.get(x.get("category", ""), "")
        v = version_of([name], starts, versions) if name else ""
        return (f"v{v[0]}", v) if v else ("old", "")
    if sec == "Main_Story":
        return "main", re.sub(r"\s*\(.*\)$", "", x.get("group_cn", ""))
    return "other", x.get("group_cn", "") or sec


def build_document(index: dict, vi: dict[str, str], base: str, starts: dict[str, int], versions: list[dict]) -> dict:
    items = []
    for x in index["items"]:
        if not x.get("png"):
            continue
        group, sub = story_group(x, starts, versions) if x["kind"] == "story" else ("", "")
        y = {"id": x["id"], "kind": x["kind"], "file": f"gallery/{x['kind']}/{x['id']}", "w": x["w"], "h": x["h"],
             "name_cn": x.get("name_cn", ""), "note_cn": x.get("note_cn", ""), "place_cn": x.get("place_cn", ""),
             "group": group, "sub_cn": sub}
        for k in TEXT:
            y[f"{k}_vi"] = vi.get(y[f"{k}_cn"], "") if y[f"{k}_cn"] else ""
        items.append(y)
    return {"version": index.get("version", ""), "asset_base_url": base, "items": items}


def strings(index: dict) -> list[str]:
    return list(dict.fromkeys(x.get(f"{k}_cn") for x in index["items"] for k in ("name", "note", "place") if x.get(f"{k}_cn")))


def untranslated(doc: dict) -> list[str]:
    return list(dict.fromkeys(i[f"{k}_cn"] for i in doc["items"] for k in TEXT if i[f"{k}_cn"] and not i[f"{k}_vi"]))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--index", type=Path, default=(_latest("Xuat/Gallery_r*") or TOOL / "Xuat" / "Gallery") / "INDEX.json")
    ap.add_argument("--master", type=Path, default=(_latest("PhienBan/r*") or TOOL / "PhienBan") / "masterdata")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--strings", action="store_true", help="in mọi chuỗi CN chưa dịch (kể cả mục chưa có ảnh) rồi thoát")
    args = ap.parse_args()
    if not args.index.is_file():
        print(f"Thiếu {args.index} (chạy `python whmx.py gallery` trong WHMX_Tool)", file=sys.stderr)
        return 1
    index = json.loads(args.index.read_text(encoding="utf-8"))
    vi = json.loads(GALLERY_VI.read_text(encoding="utf-8")) if GALLERY_VI.is_file() else {}
    if args.strings:
        for s in strings(index):
            if s not in vi:
                print(s)
        return 0
    base = json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8")).get("asset_base_url", "")
    doc = build_document(index, vi, base, *load_versions(args.master))
    args.out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    miss = untranslated(doc)
    print(f"{args.out}: {len(doc['items'])} ảnh, {args.out.stat().st_size // 1024} KB, chưa dịch {len(miss)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

Chú thích dịch tên nhóm truyện: `sub_vi` lấy từ `gallery_vi.json`; Task 5 chép sẵn tên sự kiện đã có từ file dịch tên sự kiện của Âm nhạc (`build_music_data.MUSIC_VI`) vào đó để không dịch lại.

- [ ] **Step 4: Chạy, thấy qua** — `python -m unittest test_build_gallery_data -v` → 8 test OK; chạy lại `python -m unittest test_build_music_data` → vẫn OK.
- [ ] **Step 5: Chạy thật** — `python tools/build_gallery_data.py --strings` (trên INDEX dry-run) → số chuỗi cần dịch.

---

### Task 5: Dịch VI (`gallery_vi.json`)

**Files:**
- Modify: `WhmxCalc/tools/gallery_vi.json`
- Create: `WhmxCalc/docs/gallery-poems-review.md` (33 câu thơ: CN | VI | ghi chú, để chủ dự án xem)

- [ ] **Step 1:** Đọc `.agents/skills/game-translator/SKILL.md` (bắt buộc theo AGENTS.md).
- [ ] **Step 2:** Lấy danh sách: `python tools/build_gallery_data.py --strings`, cộng tên nhóm truyện (`sub_cn` của CG truyện: tên sự kiện / chương / nhóm). Tên đã có trong file dịch sự kiện của Âm nhạc → chép nguyên.
- [ ] **Step 3:** Dịch phần còn lại theo skill (tên riêng Hán-Việt, giữ thuật ngữ đã dùng trên web như "Khí Giả", tên sự kiện đã dịch). Ghi `gallery_vi.json` dạng `{"cn": "vi"}`, sắp theo khoá.
- [ ] **Step 4:** Câu thơ bưu thiếp: dịch, đồng thời ghi vào `docs/gallery-poems-review.md` kèm địa danh để chủ dự án xem lại.
- [ ] **Step 5:** `python tools/build_gallery_data.py --strings` → không còn dòng nào.

---

### Task 6: Rà soát bằng subagent + sửa

- [ ] **Step 1:** Gọi một subagent (general-purpose) rà toàn bộ thay đổi của Task 1–5 theo spec + mục Review Focus: đúng/sai, thiếu test, rủi ro khi chạy thật với MuMu, chất lượng bản dịch (mẫu 30 câu).
- [ ] **Step 2:** Sửa các điểm xác nhận được; chạy lại hai bộ test.
- [ ] **Step 3:** Dừng trước huashu-design, báo chủ dự án: số mục mỗi loại, phần thiếu, việc cần MuMu (`python whmx.py gallery` để có png thật), file cần xem.
