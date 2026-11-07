# Trang Âm nhạc (BGM) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Chủ dự án chọn cách chạy: Native** (Claude tự làm từng task trong phiên này, tự rà cuối — không subagent; xem memory `whmx-working-rules`). Sau mỗi task: một dòng tiến độ + cập nhật bảng trạng thái cuối file này.

**Goal:** Trang `#/music` liệt kê 259 bài nhạc nền (tên, bìa, chỗ dùng), bấm một bài thì nghe được; nhạc + bìa trên R2.

**Architecture:** WHMX_Tool (repo riêng) xuất mp3 + `bgm_index.json` → `tools/build_music_data.py` (chạy trên máy chủ dự án)
ghi `public/music.json` (commit) → React island `src/features/music/` đọc file đó. `tools/publish_music.py` đẩy mp3 + bìa
webp lên R2 `music/…`. Không có `<audio>` nào trước khi người xem chọn bài.

**Tech Stack:** Python 3 (unittest, Pillow, boto3 qua `publish_assets.create_s3_client`), React 19 + TS, node:test,
GSAP (`src/features/characters/motion.ts`), Playwright cho kiểm tra trình duyệt.

**Spec:** `docs/superpowers/specs/2026-11-08-music-page-design.md`

## Global Constraints

- Nguồn: `--bgm` mặc định `../WHMX_Tool/Xuat/Audio/bgm` (có `bgm_index.json`, `*.mp3`, `bia/*.png`), `--lore-index` mặc định `../WHMX_Lore_By_Chapter/INDEX.tsv`; thiếu → báo đường dẫn rồi dừng, không ghi file.
- Tool chạy trên máy chủ dự án, không trên Vercel; mp3/bìa không vào repo web.
- Khoá R2 viết thường: `music/bgm/<id>.mp3`, `music/covers/<icon>.webp`; `<id>` = tên file mp3 viết thường không đuôi.
- mp3 160 kbps giữ nguyên; bìa webp quality 88 (`publish_assets.POLICY`).
- `public/music.json` < 60 KB; `asset_base_url` lấy từ `public/data.json` như `banners.json`.
- Mọi `<audio>` có `preload="none"`; danh sách không có `<audio>`.
- Bỏ mục máy hát "预留位置".
- Tên VI chỉ từ `localization/music_names_vi.json` (chủ dự án điền; Claude không điền).
- React + TS; màu chỉ từ `src/styles/tokens.css`; dark-only; không cuộn ngang ở 390 px; không dùng class `hidden` trần trong React.
- GSAP nhẹ khi đổi nhóm / mở bài, có đường reduced-motion; không tự thêm hiệu ứng ngoài phần đã duyệt.
- Upload R2, commit `public/music.json`, push/deploy: **chờ chủ dự án đồng ý từng bước**.
- Commit chỉ stage file của task (cây làm việc có thay đổi của phiên khác).

## Review Focus

1. Bài thuộc nhiều nhóm (vừa truyện vừa màn đánh) → hiện ở cả hai bộ lọc, nhóm chính vẫn đúng thứ tự ưu tiên — test ở Task 1 (`groups`) và Task 3 (`filterTracks`).
2. Tên file viết hoa lẫn thường (`BGM_THST.mp3`, `Bgm_interface_Hall.mp3`) → id/khoá R2 viết thường, URL vẫn trỏ đúng — test ở Task 1 và Task 2.
3. `INDEX.tsv` thiếu tên nhóm cho một kịch bản → dùng mã nhóm (`e022`) thay vì bỏ trống — test ở Task 1.
4. Mở thẳng `#/music/<id>` không tồn tại → trang vẫn hiện danh sách, không vỡ — test ở Task 4 (`musicTrackId`) và Task 6 (trình duyệt).
5. File mp3 lỗi / `r2.dev` trả 429 → báo "Không phát được bài này", trang không vỡ — kiểm ở Task 7.

---

### Task 1: `tools/build_music_data.py` — dựng `public/music.json`

**Files:**
- Create: `tools/build_music_data.py`
- Create: `tools/test_build_music_data.py`
- Create (khi chạy): `localization/music_names_vi.json`

**Interfaces:**
- Produces: `public/music.json` dạng
  `{"version": str, "asset_base_url": str, "tracks": [Track]}`, Track =
  `{"id", "file", "cover" (str|null), "group", "groups" (list), "name_cn", "name_vi", "label_kind" ("" | "story" | "stage" | "area"), "label_cn", "source_cn", "stories" ([{"group_cn","count"}]), "stories_total" (int), "stages" ({"names_cn": [..≤3], "count": int}), "areas_cn" ([str])}`.
  Các hàm: `track_id(file) -> str`, `groups_of(t) -> list[str]`, `story_groups(ids, group_of) -> list[dict]`,
  `stage_summary(stages) -> dict`, `build_track(t, group_of, names_vi) -> dict`, `build_document(index, group_of, names_vi, base) -> dict`.

- [ ] **Step 1: Viết test (fail)** — `tools/test_build_music_data.py`

```python
import unittest

import build_music_data as m

JUKE = {"id": "20106", "name": "春华如梦", "cover": "bia/ui_jj_yy_pic_cd_26.png",
        "source": "通过【人间千古】活动获取", "unlock_item": "71014", "default": False}


def track(file, jukebox=(), stories=(), stages=(), areas=()):
    return {"file": file, "jukebox": list(jukebox), "stories": list(stories), "stages": list(stages), "areas": list(areas)}


class BuildMusicTest(unittest.TestCase):
    def test_id_is_lowercase_stem(self):
        self.assertEqual(m.track_id("BGM_THST.mp3"), "bgm_thst")

    def test_groups_presence_and_priority(self):
        t = track("x.mp3", stories=["e022002"], stages=[{"id": "A", "name": "甲"}])
        self.assertEqual(m.groups_of(t), ["story", "stage"])
        self.assertEqual(m.groups_of(track("y.mp3")), ["other"])

    def test_story_groups_fall_back_to_code(self):
        g = m.story_groups(["e022002", "e022004", "e099001"], {"e022002": "人间千古", "e022004": "人间千古"})
        self.assertEqual(g, [{"group_cn": "人间千古", "count": 2}, {"group_cn": "e099", "count": 1}])

    def test_stage_summary_dedupes_and_caps(self):
        st = [{"id": str(i), "name": n} for i, n in enumerate(["甲", "甲", "乙", "丙", "丁"])]
        self.assertEqual(m.stage_summary(st), {"names_cn": ["甲", "乙", "丙"], "count": 5})

    def test_named_track(self):
        out = m.build_track(track("novel_E2202.mp3", jukebox=[JUKE], stories=["e022002"]), {}, {"novel_e2202": "Xuân Hoa Như Mộng"})
        self.assertEqual(out["id"], "novel_e2202")
        self.assertEqual(out["file"], "music/bgm/novel_e2202.mp3")
        self.assertEqual(out["cover"], "music/covers/ui_jj_yy_pic_cd_26.webp")
        self.assertEqual((out["group"], out["name_cn"], out["name_vi"], out["label_kind"]), ("jukebox", "春华如梦", "Xuân Hoa Như Mộng", ""))
        self.assertEqual(out["source_cn"], JUKE["source"])

    def test_unnamed_track_gets_label_from_first_use(self):
        out = m.build_track(track("Bgm_Battle_M01_01.mp3", stages=[{"id": "A", "name": "远击的进阶：子"}]), {}, {})
        self.assertEqual((out["group"], out["label_kind"], out["label_cn"], out["cover"]), ("stage", "stage", "远击的进阶：子", None))
        other = m.build_track(track("gacha_bgm.mp3"), {}, {})
        self.assertEqual((other["group"], other["label_kind"], other["label_cn"]), ("other", "", ""))

    def test_placeholder_jukebox_is_ignored(self):
        out = m.build_track(track("foundationMusic_1.mp3", jukebox=[{**JUKE, "name": "预留位置"}]), {}, {})
        self.assertEqual((out["name_cn"], out["group"]), ("", "other"))

    def test_document_sorts_jukebox_first(self):
        doc = m.build_document({"version": "r1", "tracks": [track("b.mp3"), track("a.mp3", jukebox=[JUKE])]}, {}, {}, "https://x")
        self.assertEqual([t["id"] for t in doc["tracks"]], ["a", "b"])
        self.assertEqual((doc["version"], doc["asset_base_url"]), ("r1", "https://x"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Chạy test, phải FAIL** — `cd tools && python -m unittest test_build_music_data -v` → `ModuleNotFoundError: build_music_data`.

- [ ] **Step 3: Viết `tools/build_music_data.py`**

```python
"""public/music.json from WHMX_Tool's BGM export (spec docs/superpowers/specs/2026-11-08-music-page-design.md).

Runs on the owner's machine only (WHMX_Tool is a separate repo); Vercel uses the committed public/music.json.
"""
from __future__ import annotations

import argparse
import csv
import json
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


def story_groups(ids: list[str], group_of: dict[str, str]) -> list[dict]:
    counts: dict[str, int] = {}
    for sid in ids:
        g = group_of.get(sid.lower()) or sid[:4].lower()  # e022002 -> e022 when INDEX.tsv has no name
        counts[g] = counts.get(g, 0) + 1
    return [{"group_cn": g, "count": n} for g, n in list(counts.items())[:5]]


def stage_summary(stages: list[dict]) -> dict:
    names = list(dict.fromkeys(s["name"] for s in stages if s.get("name")))
    return {"names_cn": names[:3], "count": len(stages)}


def build_track(t: dict, group_of: dict[str, str], names_vi: dict[str, str]) -> dict:
    tid, j, groups = track_id(t["file"]), _jukebox(t), groups_of(t)
    stories, stages = story_groups(t["stories"], group_of), stage_summary(t["stages"])
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
        "label_kind": kind, "label_cn": label, "source_cn": (j or {}).get("source", ""),
        "stories": stories, "stories_total": len(t["stories"]), "stages": stages, "areas_cn": areas,
    }


def build_document(index: dict, group_of: dict[str, str], names_vi: dict[str, str], base: str) -> dict:
    tracks = [build_track(t, group_of, names_vi) for t in index["tracks"]]
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
    base = json.loads((ROOT / "public" / "data.json").read_text(encoding="utf-8")).get("asset_base_url", "")
    doc = build_document(index, read_group_names(args.lore_index), names_vi, base)
    args.out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{args.out}: {len(doc['tracks'])} bài, {len(named)} có tên, {args.out.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Chạy test, phải PASS** — `cd tools && python -m unittest test_build_music_data -v` → 8 OK. Thêm `npm run test:tools` (chạy nền) để chắc không vỡ test khác.

- [ ] **Step 5: Chạy thật** — `python tools/build_music_data.py` → in `259 bài, 38 có tên, <60 KB`. Kiểm `localization/music_names_vi.json` có 38 khoá rỗng. Mở `public/music.json` xem 1 bài máy hát, 1 bài màn đánh, 1 bài "other". **Chưa commit `public/music.json`** (chờ Task 8).

- [ ] **Step 6: Commit** — `git add tools/build_music_data.py tools/test_build_music_data.py localization/music_names_vi.json && git commit -m "music: build public/music.json from the WHMX_Tool BGM export"`

### Task 2: `tools/publish_music.py` — đẩy mp3 + bìa lên R2

**Files:**
- Create: `tools/publish_music.py`
- Create: `tools/test_publish_music.py`

**Interfaces:**
- Consumes: thư mục `--bgm` (như Task 1); `publish_assets.{POLICY, REQUIRED_ENV, create_s3_client, load_dotenv_without_logging, sha256_file}`.
- Produces: `object_key(path: Path) -> str | None`; đối tượng R2 `music/bgm/<id>.mp3`, `music/covers/<stem>.webp` với metadata `source-sha256`.

- [ ] **Step 1: Test (fail)** — `tools/test_publish_music.py`

```python
import unittest
from pathlib import Path

import publish_music as p


class ObjectKeyTest(unittest.TestCase):
    def test_mp3_key_is_lowercase(self):
        self.assertEqual(p.object_key(Path("bgm/BGM_THST.mp3")), "music/bgm/bgm_thst.mp3")

    def test_cover_key(self):
        self.assertEqual(p.object_key(Path("bgm/bia/ui_jj_yy_pic_cd_01.png")), "music/covers/ui_jj_yy_pic_cd_01.webp")

    def test_other_files_ignored(self):
        self.assertIsNone(p.object_key(Path("bgm/bgm_index.json")))
        self.assertIsNone(p.object_key(Path("bgm/_xong_audio.txt")))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Chạy, phải FAIL** — `cd tools && python -m unittest test_publish_music -v`.

- [ ] **Step 3: Viết `tools/publish_music.py`** (theo `publish_banner_art.py`: bỏ qua đối tượng đã có cùng `source-sha256`)

```python
"""Upload the BGM export (mp3 + jukebox covers) to R2 under music/ (spec 2026-11-08 §6). --dry-run lists only."""
from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path

from PIL import Image

from build_music_data import DEFAULT_BGM, track_id
from publish_assets import POLICY, REQUIRED_ENV, create_s3_client, load_dotenv_without_logging, sha256_file

ROOT = Path(__file__).resolve().parent.parent


def object_key(path: Path) -> str | None:
    if path.suffix.lower() == ".mp3":
        return f"music/bgm/{track_id(path.name)}.mp3"
    if path.suffix.lower() == ".png" and path.parent.name == "bia":
        return f"music/covers/{path.stem.lower()}.webp"
    return None


def _unchanged(client, bucket: str, key: str, source: str) -> bool:
    try:
        return client.head_object(Bucket=bucket, Key=key).get("Metadata", {}).get("source-sha256") == source
    except Exception as exc:  # 404 = new object; anything else is re-raised without endpoint detail
        if getattr(exc, "response", {}).get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise RuntimeError(f"Could not verify remote object {key}") from exc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bgm", type=Path, default=DEFAULT_BGM)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    files = sorted(p for p in [*args.bgm.glob("*.mp3"), *(args.bgm / "bia").glob("*.png")] if object_key(p))
    if not files:
        raise SystemExit(f"Không thấy mp3/bìa trong {args.bgm}")
    load_dotenv_without_logging(ROOT / ".env")
    client = bucket = None
    if not args.dry_run:
        missing = [n for n in REQUIRED_ENV if not os.environ.get(n)]
        if missing:
            raise RuntimeError("Missing required environment variable names: " + ", ".join(missing))
        client, bucket = create_s3_client(), os.environ["R2_BUCKET"]
    sent = skipped = size = 0
    with tempfile.TemporaryDirectory() as tmp:
        for f in files:
            key, source = object_key(f), sha256_file(f)
            if client and _unchanged(client, bucket, key, source):
                skipped += 1
                continue
            body, ctype = f, "audio/mpeg"
            if f.suffix.lower() == ".png":
                body, ctype = Path(tmp) / (f.stem + ".webp"), "image/webp"
                Image.open(f).save(body, "WEBP", quality=POLICY["quality"], method=POLICY["method"])
            size += body.stat().st_size
            if client:
                client.upload_file(str(body), bucket, key, ExtraArgs={
                    "ContentType": ctype, "CacheControl": "public, max-age=604800",
                    "Metadata": {"source-sha256": source, "policy-version": POLICY["version"]}})
            sent += 1
    verb = "would upload" if not client else "uploaded"
    print(f"{verb} {sent} objects ({size / 2**20:.0f} MB), unchanged {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Chạy test, phải PASS** — `cd tools && python -m unittest test_publish_music -v` → 3 OK.
- [ ] **Step 5: Dry-run** — `python tools/publish_music.py --dry-run` → `would upload 299 objects (~700 MB)`. Gửi con số cho chủ dự án. **Không chạy thật ở task này.**
- [ ] **Step 6: Commit** — `git add tools/publish_music.py tools/test_publish_music.py && git commit -m "music: R2 publisher for BGM mp3 and jukebox covers"`

### Task 3: Lớp dữ liệu TS — `src/features/music/musicData.mts`

**Files:**
- Create: `src/features/music/musicData.mts`
- Create: `src/features/music/musicData.test.mts`
- Modify: `src/i18n/strings.mts` (thêm khoá `vi` + `cn`)

**Interfaces:**
- Consumes: `public/music.json` (Task 1).
- Produces: types `MusicGroup`, `MusicTrack`, `MusicDoc`; `loadMusic(fetchImpl?)`, `loadMusicCached()`, `cachedMusic()`,
  `filterTracks(tracks, group: MusicGroup | 'all', query: string): MusicTrack[]`, `trackTitle(t, lang): string`,
  `assetUrl(doc, key): string`, `groupCounts(tracks): Record<MusicGroup, number>`.
  Khoá i18n: `navMusic, muTitle, muAll, muJukebox, muStory, muStage, muArea, muOther, muSearch, muEmpty, muLoadError, muPlayError, muSource, muUsedStory, muUsedStage, muUsedArea, muMore`.

- [ ] **Step 1: Test (fail)** — `src/features/music/musicData.test.mts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { assetUrl, filterTracks, groupCounts, loadMusic, trackTitle, type MusicTrack } from './musicData.mts';

const t = (o: Partial<MusicTrack>): MusicTrack => ({ id: 'x', file: 'music/bgm/x.mp3', cover: null, group: 'other', groups: ['other'],
  name_cn: '', name_vi: '', label_kind: '', label_cn: '', source_cn: '', stories: [], stories_total: 0,
  stages: { names_cn: [], count: 0 }, areas_cn: [], ...o });

const named = t({ id: 'novel_e2202', group: 'jukebox', groups: ['jukebox', 'story'], name_cn: '春华如梦', name_vi: 'Xuân Hoa Như Mộng' });
const battle = t({ id: 'bgm_battle_m01_01', group: 'stage', groups: ['stage'], label_kind: 'stage', label_cn: '远击的进阶：子' });
const both = t({ id: 'novel_m8', group: 'story', groups: ['story', 'stage'], label_kind: 'story', label_cn: '来古' });

test('filter by presence, not only the primary group', () => {
  assert.deepEqual(filterTracks([named, battle, both], 'stage', '').map((x) => x.id), ['bgm_battle_m01_01', 'novel_m8']);
  assert.equal(filterTracks([named, battle, both], 'all', '').length, 3);
});

test('search matches CN, VI, label and id, case-insensitive', () => {
  for (const q of ['春华', 'xuân hoa', '远击', 'BATTLE_M01', '  novel_m8 ']) assert.equal(filterTracks([named, battle, both], 'all', q).length, 1, q);
  assert.equal(filterTracks([named], 'all', 'không có').length, 0);
});

test('title: VI name in VI, CN name in CN, label otherwise, id last', () => {
  assert.equal(trackTitle(named, 'vi'), 'Xuân Hoa Như Mộng');
  assert.equal(trackTitle(named, 'cn'), '春华如梦');
  assert.equal(trackTitle(t({ ...named, name_vi: '' }), 'vi'), '春华如梦');
  assert.match(trackTitle(battle, 'vi'), /远击的进阶：子$/);
  assert.equal(trackTitle(t({ id: 'gacha_bgm' }), 'vi'), 'gacha_bgm');
});

test('counts per group by presence', () => {
  const c = groupCounts([named, battle, both]);
  assert.equal(c.stage, 2); assert.equal(c.jukebox, 1); assert.equal(c.other, 0);
});

test('asset url joins base and key', () => {
  assert.equal(assetUrl({ asset_base_url: 'https://r2.example/' } as never, 'music/bgm/x.mp3'), 'https://r2.example/music/bgm/x.mp3');
});

test('load returns null on a bad document or a failed fetch', async () => {
  assert.equal(await loadMusic(async () => new Response('{}')), null);
  assert.equal(await loadMusic(async () => { throw new Error('offline'); }), null);
  const ok = await loadMusic(async () => new Response(JSON.stringify({ version: 'r1', asset_base_url: '', tracks: [named] })));
  assert.equal(ok?.tracks.length, 1);
});
```

- [ ] **Step 2: Chạy, phải FAIL** — `node --test src/features/music/musicData.test.mts` (chạy nền, theo quy tắc npm).

- [ ] **Step 3: Viết `musicData.mts`**

```ts
// public/music.json (tools/build_music_data.py) → the Âm nhạc page. Spec 2026-11-08 §4–§5.
import type { Lang } from '../../i18n/lang.mts';
import { s, type StringKey } from '../../i18n/strings.mts';

export type MusicGroup = 'jukebox' | 'story' | 'stage' | 'area' | 'other';
export type MusicTrack = { id: string; file: string; cover: string | null; group: MusicGroup; groups: MusicGroup[];
  name_cn: string; name_vi: string; label_kind: '' | 'story' | 'stage' | 'area'; label_cn: string; source_cn: string;
  stories: { group_cn: string; count: number }[]; stories_total: number;
  stages: { names_cn: string[]; count: number }; areas_cn: string[] };
export type MusicDoc = { version: string; asset_base_url: string; tracks: MusicTrack[] };

export const GROUPS: MusicGroup[] = ['jukebox', 'story', 'stage', 'area', 'other'];
export const GROUP_LABEL: Record<MusicGroup, StringKey> = { jukebox: 'muJukebox', story: 'muStory', stage: 'muStage', area: 'muArea', other: 'muOther' };

// ponytail: one copy per page load, like banners.json; a failed load is not kept.
let cached: MusicDoc | null = null;
export const cachedMusic = () => cached;
export async function loadMusicCached(): Promise<MusicDoc | null> {
  return cached ?? (cached = await loadMusic());
}

export async function loadMusic(fetchImpl: typeof fetch = fetch): Promise<MusicDoc | null> {
  try {
    const res = await fetchImpl('/music.json');
    if (!res.ok) return null;
    const doc = await res.json();
    return Array.isArray(doc?.tracks) ? (doc as MusicDoc) : null;
  } catch {
    return null;
  }
}

export function filterTracks(tracks: MusicTrack[], group: MusicGroup | 'all', query: string): MusicTrack[] {
  const q = query.trim().toLowerCase();
  return tracks.filter((t) => (group === 'all' || t.groups.includes(group))
    && (!q || [t.name_cn, t.name_vi, t.label_cn, t.id].some((v) => v.toLowerCase().includes(q))));
}

export function groupCounts(tracks: MusicTrack[]): Record<MusicGroup, number> {
  const c = { jukebox: 0, story: 0, stage: 0, area: 0, other: 0 };
  for (const t of tracks) for (const g of t.groups) c[g] += 1;
  return c;
}

export function trackTitle(t: MusicTrack, lang: Lang): string {
  if (t.name_cn) return (lang === 'vi' && t.name_vi) || t.name_cn;
  if (t.label_kind) return `${s(GROUP_LABEL[t.label_kind], lang)} · ${t.label_cn}`;
  return t.id;
}

export const assetUrl = (doc: MusicDoc, key: string) => `${doc.asset_base_url.replace(/\/$/, '')}/${key}`;
```

- [ ] **Step 4: Thêm chuỗi i18n** vào `vi` và `cn` trong `src/i18n/strings.mts` (CN đánh dấu `// draft` như các khoá khác chưa duyệt):

```ts
// vi
navMusic: 'Âm nhạc', muTitle: 'Âm nhạc', muAll: 'Tất cả', muJukebox: 'Máy hát', muStory: 'Truyện', muStage: 'Màn đánh',
muArea: 'Bản đồ', muOther: 'Khác', muSearch: 'Tìm theo tên hoặc mã bài', muEmpty: 'Không có bài nào phù hợp.',
muLoadError: 'Không tải được danh sách nhạc.', muPlayError: 'Không phát được bài này.', muSource: 'Nguồn',
muUsedStory: 'Dùng trong truyện', muUsedStage: 'Dùng trong màn đánh', muUsedArea: 'Dùng ở bản đồ', muMore: '+{n} màn khác',
// cn
navMusic: '音乐', muTitle: '音乐', muAll: '全部', muJukebox: '唱片机', muStory: '剧情', muStage: '战斗', muArea: '地图',
muOther: '其他', muSearch: '按曲名或编号搜索', muEmpty: '没有符合的曲目。', muLoadError: '曲目列表加载失败。',
muPlayError: '无法播放此曲目。', muSource: '获取方式', muUsedStory: '剧情使用', muUsedStage: '关卡使用', muUsedArea: '地图使用',
muMore: '另有 {n} 关', // draft
```

- [ ] **Step 5: Chạy, phải PASS** — `node --test src/features/music/musicData.test.mts` → 6 pass; rồi `npm test` (nền) để chắc `strings.test.mts` (kiểm đủ khoá vi/cn) vẫn qua.
- [ ] **Step 6: Commit** — `git add src/features/music/musicData.mts src/features/music/musicData.test.mts src/i18n/strings.mts && git commit -m "music: data layer, filters and UI strings"`

### Task 4: Route `#/music`, khung trang, mục nav

**Files:**
- Modify: `src/app/router/staticRoutes.mts`, `src/app/router/staticRoutes.test.mts`
- Modify: `src/app/router/router.js` (import, `VIEW_CONTAINERS`, unmount, mount)
- Modify: `index.html` (thêm `<main id="music-view" class="music-view hidden"></main>` sau `info-view`)
- Modify: `src/app/layout/AppNav.tsx` (mục `#/music`, icon lucide `Music`)
- Create: `src/features/music/MusicPage.tsx` (khung tạm: tiêu đề + số bài; giao diện thật ở Task 6)
- Create: `src/features/music/styles/music.css` (chỉ `.music-view` layout + `.music-view.hidden`, theo `info.css`)

**Interfaces:**
- Produces: `staticView()` trả `'music'` cho `/music` và `/music/<id>`; `musicTrackId(hash): string` (id viết thường hoặc `''`);
  `mountMusicPage(container)`, `unmountMusicPage()`.

- [ ] **Step 1: Test (fail)** — thêm vào `staticRoutes.test.mts`:

```ts
import { musicTrackId, staticView } from './staticRoutes.mts';

test('music routes', () => {
  assert.equal(staticView('#/music'), 'music');
  assert.equal(staticView('#/music/'), 'music');
  assert.equal(staticView('#/music/Bgm_Map'), 'music');
  assert.equal(staticView('#/musicx'), null);
  assert.equal(musicTrackId('#/music'), '');
  assert.equal(musicTrackId('#/music/Bgm_Map'), 'bgm_map');
  assert.equal(musicTrackId('#/music/a/b'), '');
  assert.equal(musicTrackId('#/banners'), '');
  assert.equal(musicTrackId('#/music/%'), '');
});
```

- [ ] **Step 2: Chạy, phải FAIL** — `node --test src/app/router/staticRoutes.test.mts`.
- [ ] **Step 3: Sửa `staticRoutes.mts`**

```ts
export function staticView(hash: string): 'home' | 'banners' | 'info' | 'music' | null {
  const path = hash.replace(/^#/, '').split('?')[0].replace(/^\/?/, '/').replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  if (path === '/banners') return 'banners';
  if (path === '/info') return 'info';
  if (path === '/music' || /^\/music\/[^/]+$/.test(path)) return 'music'; // the track id is the page's own
  return null;
}

/** '#/music/Bgm_Map' → 'bgm_map'; '' for the list or anything else. */
export function musicTrackId(hash: string): string {
  const m = /^\/music\/([^/]+)$/.exec(hash.replace(/^#/, '').split('?')[0].replace(/^\/?/, '/').replace(/\/+$/, ''));
  if (!m) return '';
  try { return decodeURIComponent(m[1]).toLowerCase(); } catch { return ''; } // '#/music/%' must not throw
}
```

- [ ] **Step 4: `MusicPage.tsx` khung + island** (theo `banners/island.tsx`)

```tsx
// Âm nhạc page (spec docs/superpowers/specs/2026-11-08-music-page-design.md). Look: docs/public-redesign/music/direction-approved.md (Task 5).
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import { cachedMusic, loadMusicCached, type MusicDoc } from './musicData.mts';
import './styles/music.css';

export function MusicPage({ doc }: { doc: MusicDoc | null }) {
  const lang = useLang();
  if (!doc) return <div className="music-page"><p>{s('muLoadError', lang)}</p></div>;
  return <div className="music-page"><h1>{s('muTitle', lang)}</h1><p>{doc.tracks.length}</p></div>;
}

let root: Root | null = null;
let generation = 0;
export function unmountMusicPage() { generation += 1; root?.unmount(); root = null; }
export function mountMusicPage(container: HTMLElement): Promise<void> {
  unmountMusicPage();
  const render = (doc: MusicDoc | null) => {
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    flushSync(() => mounted.render(<StrictMode><MusicPage doc={doc} /></StrictMode>));
  };
  const hit = cachedMusic();
  if (hit) { render(hit); return Promise.resolve(); }
  const mine = generation;
  return loadMusicCached().then((doc) => { if (mine === generation) render(doc); });
}
```

- [ ] **Step 5: Nối router + index + nav**
  - `router.js`: `import { mountMusicPage, unmountMusicPage } from '../../features/music/MusicPage.tsx';`; `VIEW_CONTAINERS` thêm `music: 'music-view'`; trong vòng ẩn: `if (id === 'music-view') unmountMusicPage();`; nhánh mount: `else if (route.view === 'music') mountMusicPage(target);`.
  - `index.html`: `<!-- Music View Root (React, src/features/music/MusicPage.tsx) -->` + `<main id="music-view" class="music-view hidden"></main>`.
  - `AppNav.tsx`: import `Music` từ `lucide-react`; thêm `{ href: '#/music', label: 'navMusic', icon: Music, views: ['music'] }` ngay trước mục `#/info`.
  - `music.css`: chép khối `.info-view` / `.info-view.hidden` / `.info-page` của `info.css`, đổi tên `music-*`.
- [ ] **Step 6: Kiểm** — `node --test src/app/router/staticRoutes.test.mts` PASS; `npm test` + `npm run build` (nền, lần lượt) qua; `npm run dev` + Playwright mở `#/music` thấy "Âm nhạc" + 259, nav sáng mục mới; Network không có request `.mp3`.
- [ ] **Step 7: Commit** — `git add src/app/router/staticRoutes.mts src/app/router/staticRoutes.test.mts src/app/router/router.js index.html src/app/layout/AppNav.tsx src/features/music/MusicPage.tsx src/features/music/styles/music.css && git commit -m "music: #/music route, page shell and nav entry"`

### Task 5: Thiết kế — huashu-design 3 hướng, chủ dự án chọn

**Files:**
- Create: `docs/public-redesign/music/design-demos/{A,B,C}.html`
- Create: `docs/public-redesign/music/direction-approved.md`

- [ ] **Step 1:** Đọc `DESIGN.md`, `PRODUCT.md`, `docs/public-redesign/info/direction-approved.md`, `docs/public-redesign/tier-list/direction-approved.md`.
- [ ] **Step 2:** Dùng skill `huashu-design` làm 3 demo HTML tĩnh với dữ liệu thật trích từ `public/music.json` (tokens của `src/styles/tokens.css`). Mỗi hướng phải trả lời: (a) bố cục danh sách + bộ lọc nhóm + ô tìm ở 1440 và 390 px; (b) bấm bài mở **trang chi tiết `#/music/<id>` hay popup**; (c) nút nghe: `<audio controls>` gốc hay nút riêng; (d) có bài trước/sau trong danh sách đang lọc không; (e) hiệu ứng GSAP khi đổi nhóm / mở bài.
- [ ] **Step 3:** Gửi 3 hướng cho chủ dự án, **dừng chờ chọn**. Ghi lựa chọn (và chỉnh sửa nếu có) vào `direction-approved.md`: bố cục, cách mở bài, điều khiển, hiệu ứng, class CSS dự kiến.
- [ ] **Step 4: Commit** — `git add docs/public-redesign/music && git commit -m "docs(music): design directions and the approved one"`

### Task 6: Giao diện trang theo hướng đã duyệt

**Files:**
- Modify: `src/features/music/MusicPage.tsx`
- Modify: `src/features/music/styles/music.css`
- Create (nếu hướng duyệt cần): `src/features/music/TrackListen.tsx`

**Interfaces:**
- Consumes: `musicData.mts` (Task 3), `musicTrackId` (Task 4), `useReveal` từ `src/features/characters/motion.ts`, `direction-approved.md` (Task 5).

Hành vi bắt buộc, bất kể hướng nào:
- Danh sách: bộ lọc `Tất cả` + 5 nhóm có số đếm (`groupCounts`), ô tìm (`filterTracks`), trạng thái rỗng `muEmpty`; mỗi dòng: bìa (hoặc ảnh mặc định), `trackTitle`, tóm tắt chỗ dùng; **không có `<audio>`**.
- Mở bài: theo hướng duyệt; `#/music/<id>` mở đúng bài; id không tồn tại → chỉ hiện danh sách.
- Phần nghe dùng đúng khối sau (bao bằng giao diện đã duyệt):

```tsx
function Listen({ doc, track }: { doc: MusicDoc; track: MusicTrack }) {
  const lang = useLang();
  const audio = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); const a = audio.current; return () => a?.pause(); }, [track.id]); // leaving stops the music
  return failed
    ? <p className="music-error">{s('muPlayError', lang)}</p>
    : <audio ref={audio} key={track.id} src={assetUrl(doc, track.file)} preload="none" controls onError={() => setFailed(true)} />;
}
```

- Chi tiết bài: nguồn (`source_cn`), truyện (`stories` + `stories_total`), màn (`stages.names_cn` + `muMore` khi `count > names_cn.length`), bản đồ (`areas_cn`), mã file.
- GSAP: `useReveal` khi đổi nhóm/kết quả tìm và khi mở bài; reduced-motion bỏ chuyển động (hook đã xử lý).

- [ ] **Step 1:** Viết lại `MusicPage.tsx` + `music.css` theo `direction-approved.md` với các hành vi trên (giữ island ở Task 4).
- [ ] **Step 2:** `npm test` + `npm run build` (nền) qua.
- [ ] **Step 3: Playwright** (dev server): 1440 + 390 px — không cuộn ngang trang; Network trước khi bấm bài: 0 request `.mp3`; bấm bài → nghe được (cần R2 ở Task 7, nếu chưa có thì trỏ tạm `asset_base_url` dev sang thư mục local qua `public/` **không commit**, hoặc kiểm sau Task 7); `#/music/khong_co` → danh sách; đổi VI/CN đổi chữ giao diện + `trackTitle`; reduced motion; ảnh chụp màn hình gửi chủ dự án.
- [ ] **Step 4: Tự rà** — `ponytail:ponytail-review` trên diff của task.
- [ ] **Step 5: Commit** — `git add src/features/music && git commit -m "music: page per the approved design"`

### Task 7: Đưa nhạc lên R2 (cần chủ dự án đồng ý)

- [ ] **Step 1:** `python tools/publish_music.py --dry-run` → gửi chủ dự án số đối tượng + dung lượng; **dừng chờ "đồng ý"**.
- [ ] **Step 2:** `python tools/publish_music.py` → `uploaded 299 …`; chạy lại lần nữa phải ra `uploaded 0, unchanged 299`.
- [ ] **Step 3:** `curl -sI <asset_base_url>/music/bgm/bgm_interface_hall.mp3` → 200, `content-type: audio/mpeg`; `curl -sI …/music/covers/ui_jj_yy_pic_cd_01.webp` → 200 `image/webp`.
- [ ] **Step 4:** Playwright: bấm 3 bài (1 máy hát, 1 màn đánh, 1 khác) → phát được; giả lập lỗi (đổi `file` một bài trong DevTools) → hiện `muPlayError`.

### Task 8: Hoàn tất — dữ liệu, tài liệu, (push khi chủ dự án bảo)

**Files:**
- Add: `public/music.json` (sinh ở Task 1)
- Modify: `docs/WHMX_CURRENT_STATE_FINAL_2026-10-04.md` (dòng trạng thái "Âm nhạc"), `docs/WHMX_COMMANDS.md` (mục "Cập nhật nhạc": `python whmx.py bgm` → `python tools/build_music_data.py` → `python tools/publish_music.py --dry-run` → chạy thật → commit `public/music.json`)

- [ ] **Step 1:** Chạy lại `python tools/build_music_data.py` (để `name_vi` mới nhất), xem `git diff --stat public/music.json`; **hỏi chủ dự án** trước khi commit.
- [ ] **Step 2:** `npm test`, `npm run test:tools`, `npm run build`, validators (`npm run validate-data`) — nền, lần lượt.
- [ ] **Step 3: Commit** (sau khi được đồng ý) — `git add public/music.json docs/WHMX_CURRENT_STATE_FINAL_2026-10-04.md docs/WHMX_COMMANDS.md docs/superpowers/plans/2026-11-08-music-page.md && git commit -m "music: publish music.json and docs"`
- [ ] **Step 4:** Push/deploy **chỉ khi chủ dự án bảo**, theo quy trình trong state doc (`git fetch`, kiểm ancestor, `git push origin HEAD:main`, rồi `HEAD`), kiểm trên whmxsite.vercel.app.

## Trạng thái

| Task | Trạng thái | Ghi chú |
|---|---|---|
| 1 build_music_data | chưa | |
| 2 publish_music | chưa | |
| 3 musicData + i18n | chưa | |
| 4 route + shell + nav | chưa | |
| 5 thiết kế (huashu) | chưa | chờ chủ dự án chọn |
| 6 giao diện | chưa | |
| 7 R2 upload | chưa | chờ đồng ý |
| 8 dữ liệu + docs | chưa | chờ đồng ý commit/push |
