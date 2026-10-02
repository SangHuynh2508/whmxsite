# Home page + Banner page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **WHMX owner rule:** no subagents unless the owner asks in that message — run natively (executing-plans), final review = self-review with `ponytail:ponytail-review`.

**Goal:** `#/` becomes a Home page (hero, current banners with a live countdown, current events, new releases, shortcuts) and `#/banners` lists every banner since 2024-05, all from a static `public/banners.json` refreshed on release day.

**Architecture:** A Python tool reads MasterData (`cardPools`, `ActivityVersionMap`, `ActivityOverAllMap`, `LoginBackgroundMap`) and writes `public/banners.json`; a second tool extracts key art from the game bundles and uploads WebP to R2. Pure TypeScript modules (`bannerTime`, `bannersData`, `newReleases`, `staticRoutes`) hold all logic and are unit-tested; thin React islands (`BannerCard`, `BannersPage`, `HomePage`) render them inside the existing hash router, following the `BuildTab.tsx` mount pattern.

**Tech Stack:** Python 3.14 + unittest (tools), UnityPy via `../NeoArtifacts/NeoArtifacts.py` (art), boto3 (R2), React 19 + TypeScript islands, node:test (`*.test.mts`), GSAP (`src/features/characters/motion.ts`), Playwright MCP for browser checks.

**Spec:** [`docs/superpowers/specs/2026-09-30-home-banners-design.md`](../specs/2026-09-30-home-banners-design.md) (approved 2026-09-30).

## Handoff (2026-09-30) — read before Task 1

This plan was written in the "game data" session (r3057/r3071 exploration, lore, icons), which stays open for game
updates and data work. **The implementation runs in its own session.** State at handoff:

- **Approved:** spec (owner "ổn" / "duyệt", decisions Q1–Q9 in spec §2, design adds taste skills + impeccable) and this
  plan (owner "ổn"). Execution: **native** (superpowers:executing-plans), no subagents, final self-review with
  `ponytail:ponytail-review`. Task 6 stops for the owner's pick; Task 2 upload and Task 10 push/deploy/prune need an owner yes.
- **Git:** branch `feat/postgres-admin-crud`, HEAD `d0f07d2` = `origin/main` (pushed 2026-09-30). **Uncommitted, written by
  the data session:** this plan, the spec `docs/superpowers/specs/2026-09-30-home-banners-design.md`,
  `docs/WHMX_CURRENT_STATE_FINAL_2026-10-02.md` (r3071 row, roadmap 6c chibi + this feature), `docs/WHMX_COMMANDS.md`
  (`SNAPSHOT` → r3071). Commit the spec + plan with Task 1 (owner said "chưa commit" before the handoff — ask once if
  unsure); leave the state/commands docs to the data session unless the owner says otherwise. Owner files that are
  never staged: `localization/localization_master.xlsx` (modified) and all untracked owner/tool files.
- **Game data now:** snapshot `r3071-20260930T053704587211Z` (authoritative), MasterData `c7d7e7b8…` / lang 5680;
  `public/data.json` rebuilt for r3071 and live. `images_cardpool.ab` and `ui_kv3401.ab` are in
  `NeoArtifacts/Assets/runtime_bundle_cache/r3057-20260929T130948564397Z/bundles/` (unchanged in r3071 — the FileMD5
  check in Task 2 finds them). `NeoArtifacts/Assets/banners/` does not exist yet (Task 2 creates it).
- **Checked facts the plan relies on:** 94 timed `cardPools` rows (none hidden), types `time` 77 / `limited` 14 /
  `oldtime` 2 / `season` 1; 83 `PoolBg_*` paths in `images_cardpool` (76 of the 94 timed pools have one); current version
  2019 "3.4上"; 4 events in `ActivityOverAllMap` for it; active hero `KV3401` 经以山海; `data.json` has `asset_base_url`,
  `characters[].unlock_date`, `skins[].unlock_date` (147 skins dated), `slug`, `icon`.
- **Parallel sessions:** the Tier-list session (just started, nothing committed) and the data session. Do not rebuild
  `public/data.json` or touch `public/assets/items` / NeoArtifacts MasterData here — that is the data session's job; if a
  game update lands mid-way, re-run `tools/build_banner_data.py` only.
- **Gotchas:** `*.test.mts` are excluded from `tsc`; `lucide-react` 1.47 has `House`, not `Home`; UnityPy bundle lookup must
  match **FileMD5** (MD5Name is stable across versions); the hidden browser pane gives no animation frames — use the
  Playwright MCP for route/motion checks (`docs/WHMX_CURRENT_STATE_FINAL_2026-10-02.md` §7).

## Global Constraints

- Colours only from `src/styles/tokens.css`; dark only; never the bare `hidden` class in React markup (`max-md:hidden` if needed); a panel hidden at some width must appear elsewhere at that width.
- Every public state/view change gets a GSAP effect via `src/features/characters/motion.ts` (`useReveal`), with a reduced-motion path; countdown digits change without animation.
- 390 px wide: no horizontal scroll. Check at 1440 and 390 px.
- Vietnamese UI copy exactly as in the spec: "Đã kết thúc · chờ bản cập nhật", "Chưa tải được dữ liệu banner", "Trang chủ", "Banner", countdown "8 ngày 10 giờ" / "5 giờ 12 phút" / "45 phút" / "< 1 phút", dates `dd/mm/yyyy`.
- No speculative/upcoming banners; no guessing from ID shape — `up_skin` only when that skin id exists in `data.json`.
- Nothing under `api/`; no new npm dependency; one npm command at a time, in the background.
- Git: commit only this plan's files (the tree holds the owner's workbook and other sessions' files — never stage them); **push, R2 upload and deploy only with an owner yes**.
- Design gate (Task 6): huashu 3 directions → owner picks → taste skills pass → impeccable `detect` (+ `critique` as self-review, no subagents). UI tasks 7–9 take their CSS from `docs/public-redesign/home/direction-approved.md`.

## Review Focus

1. **A tab left open past a banner's end** — the card must flip to "Đã kết thúc · chờ bản cập nhật" without a reload, and the banner must stay in the current block (not vanish). → Task 4 test `currentBanners keeps an ended batch and marks it ended`.
2. **`banners.json` missing, HTML error page, or wrong shape** — pages show "Chưa tải được dữ liệu banner", Home still renders shortcuts/new releases. → Task 4 test `loadBanners returns null on 404 and on a bad shape`; Task 10 browser check.
3. **UP character not in `data.json`** (unreleased, e.g. W0185 when a banner ships early) — the card renders without that avatar and without a broken link. → Task 4 test `upCharacters skips ids missing from data.json`.
4. **Key art object not uploaded yet (404)** — the card falls back to UP avatars instead of a broken image. → Task 7 `onError` + Task 10 browser check with a bad URL.
5. **Dates near midnight / viewer time zone** — `dd/mm/yyyy` must be the viewer's local date, not UTC. → Task 3 test `formatDate uses the given time zone`.

---

## File map

| File | Responsibility |
|---|---|
| `tools/build_banner_data.py` (create) | MasterData + `data.json` → `public/banners.json` (pure functions + CLI) |
| `tools/test_build_banner_data.py` (create) | unittest for the above |
| `tools/publish_banner_art.py` (create) | Extract `PoolBg_<id>` / `<KV>` from the current snapshot's bundles → `../NeoArtifacts/Assets/banners/*.png` → WebP → R2 `banners/`, `kv/` (`--dry-run`) |
| `tools/test_publish_banner_art.py` (create) | unittest for the object-key plan |
| `public/banners.json` (generated, committed) | data for both pages |
| `src/features/banners/bannerTime.mts` (+ test) | status / remaining text / date format |
| `src/features/banners/bannersData.mts` (+ test) | types, `loadBanners`, `currentBanners`, `archive`, `upCharacters`, `artUrl` |
| `src/features/home/newReleases.mts` (+ test) | newest characters/skins |
| `src/app/router/staticRoutes.mts` (+ test) | `#/` → `home`, `#/banners` → `banners` |
| `src/features/banners/useNow.ts` | shared ticking clock |
| `src/features/banners/BannerCard.tsx` | one banner card |
| `src/features/banners/BannersPage.tsx` | Banner page + `mountBannersPage` / `unmountBannersPage` |
| `src/features/home/HomePage.tsx` | Home page + `mountHomePage` / `unmountHomePage` |
| `src/features/banners/styles/banners.css`, `src/features/home/styles/home.css` (create) | styles from the approved direction |
| `src/app/router/router.js`, `index.html`, `src/app/layout/AppNav.tsx` (modify) | routing, containers, nav items |
| `docs/public-redesign/home/` (create) | design demos + `direction-approved.md` |
| `docs/WHMX_COMMANDS.md`, `docs/WHMX_CURRENT_STATE_FINAL_2026-10-02.md` (modify) | release-day step, status |

---

### Task 1: `build_banner_data.py` → `public/banners.json`

**Files:**
- Create: `tools/build_banner_data.py`, `tools/test_build_banner_data.py`
- Generate: `public/banners.json`

**Interfaces:**
- Produces: `public/banners.json` with the shape of spec §3.2; Python functions `pick_version(rows, now)`, `pick_hero(rows, now, art_dir)`, `pick_events(rows, version)`, `build_banners(pools, skin_ids, art_dir)`, `build_document(master_dir, data_json, art_dir, now)`.

- [ ] **Step 1: Write the failing test**

```python
# tools/test_build_banner_data.py
import json
import tempfile
import unittest
from pathlib import Path

import build_banner_data as b

POOLS = [
    {"id": "2114", "nameLanText": "万嶂烟峦", "type": "limited", "kindNameLanText": "限定渠道", "hidden": False,
     "startTime": 200, "endTime": 900, "characterShow": ["A0184"], "characterSkinShow": "001"},
    {"id": "340001", "nameLanText": "孤岛螺旋", "type": "season", "kindNameLanText": "限时渠道", "hidden": False,
     "startTime": 200, "endTime": 2000, "characterShow": ["W0097"], "characterSkinShow": "009"},
    {"id": "5003", "nameLanText": "结伴同游", "type": "time", "kindNameLanText": "限时渠道", "hidden": False,
     "startTime": 200, "endTime": 900, "characterShow": [], "characterSkinShow": ""},
    {"id": "2017", "nameLanText": "歆铭长愿", "type": "time", "kindNameLanText": "限时渠道", "hidden": False,
     "startTime": 10, "endTime": 20, "characterShow": ["D0089"], "characterSkinShow": "002"},
    {"id": "1", "nameLanText": "", "type": "normal", "hidden": True, "startTime": 0, "endTime": 0},
]


class BuildBannerDataTest(unittest.TestCase):
    def test_only_timed_pools_newest_first(self):
        out = b.build_banners(POOLS, {"A0184001"}, Path("/nonexistent"))
        self.assertEqual([x["id"] for x in out], ["2114", "340001", "5003", "2017"])

    def test_banner_fields_and_up_skin_only_when_skin_exists(self):
        out = {x["id"]: x for x in b.build_banners(POOLS, {"A0184001"}, Path("/nonexistent"))}
        self.assertEqual(out["2114"], {"id": "2114", "name_cn": "万嶂烟峦", "name_vi": None, "type": "limited",
                                       "kind_cn": "限定渠道", "start": 200, "end": 900, "up": ["A0184"],
                                       "up_skin": "A0184001", "art": None})
        self.assertIsNone(out["340001"]["up_skin"])  # W0097009 is not in data.json
        self.assertEqual(out["5003"]["up"], [])

    def test_art_only_when_extracted_png_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "PoolBg_2114.png").write_bytes(b"x")
            out = {x["id"]: x for x in b.build_banners(POOLS, set(), Path(tmp))}
        self.assertEqual(out["2114"]["art"], "banners/2114.webp")
        self.assertIsNone(out["5003"]["art"])

    def test_version_events_and_hero_follow_now(self):
        versions = [{"Version": "2018", "NameLanText": "3.3下版本热点活动总览", "StartTime": 0, "EndTime": 100},
                    {"Version": "2019", "NameLanText": "3.4上版本热点活动总览", "StartTime": 100, "EndTime": 1000}]
        v = b.pick_version(versions, 150)
        self.assertEqual(v, {"id": "2019", "label": "3.4上", "start": 100, "end": 1000})
        events = [{"ID": 1071, "Version": "2019", "NameLanText": "榑桑遗境", "DescLanText": "主题活动", "StartTime": 100, "EndTime": 900},
                  {"ID": 1000, "Version": "2018", "NameLanText": "old", "DescLanText": "x", "StartTime": 0, "EndTime": 50}]
        self.assertEqual(b.pick_events(events, v), [{"id": 1071, "name_cn": "榑桑遗境", "kind_cn": "主题活动", "start": 100, "end": 900}])
        logins = [{"KV": "KV3401", "NameLanText": "经以山海", "StartTime": "100", "EndTime": "1000"},
                  {"KV": "KVOB", "NameLanText": "", "StartTime": "1000", "EndTime": "5000"}]
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "KV3401.png").write_bytes(b"x")
            self.assertEqual(b.pick_hero(logins, 150, Path(tmp)),
                             {"kv": "KV3401", "name_cn": "经以山海", "art": "kv/KV3401.webp", "start": 100, "end": 1000})
        self.assertIsNone(b.pick_version(versions, 5000))
        self.assertIsNone(b.pick_hero(logins, 99, Path("/nonexistent")))

    def test_document_is_deterministic(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "cardPools.json").write_text(json.dumps(POOLS), encoding="utf-8")
            (root / "ActivityVersionMap.json").write_text("[]", encoding="utf-8")
            (root / "ActivityOverAllMap.json").write_text("[]", encoding="utf-8")
            (root / "LoginBackgroundMap.json").write_text("[]", encoding="utf-8")
            data = root / "data.json"
            data.write_text(json.dumps({"asset_base_url": "https://r2", "characters": {
                "A0184": {"skins": [{"skinID": "A0184001"}]}}}), encoding="utf-8")
            one = b.dumps(b.build_document(root, data, root, now=150, masterdata="abc"))
            two = b.dumps(b.build_document(root, data, root, now=150, masterdata="abc"))
        self.assertEqual(one, two)
        doc = json.loads(one)
        self.assertEqual(doc["asset_base_url"], "https://r2")
        self.assertEqual(doc["masterdata"], "abc")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s tools -p "test_build_banner_data.py" -v`
Expected: FAIL / ERROR `ModuleNotFoundError: No module named 'build_banner_data'`.

- [ ] **Step 3: Write minimal implementation**

```python
# tools/build_banner_data.py
"""MasterData → public/banners.json (current version, hero KV, events, every timed banner).

Spec: docs/superpowers/specs/2026-09-30-home-banners-design.md §3. Run on release day after the MasterData refresh
and the banner-art extraction (tools/publish_banner_art.py --extract-only), then commit public/banners.json.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT.parent / "NeoArtifacts" / "MasterData" / "json"
ART_DIR = ROOT.parent / "NeoArtifacts" / "Assets" / "banners"
OUT = ROOT / "public" / "banners.json"


def _rows(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else list(data.values())


def pick_version(rows: list[dict], now: int) -> dict | None:
    for r in rows:
        if int(r["StartTime"]) <= now < int(r["EndTime"]):
            label = re.sub(r"版本热点活动总览$", "", r.get("NameLanText") or "")
            return {"id": str(r["Version"]), "label": label, "start": int(r["StartTime"]), "end": int(r["EndTime"])}
    return None


def pick_events(rows: list[dict], version: dict | None) -> list[dict]:
    if not version:
        return []
    out = [{"id": r["ID"], "name_cn": r.get("NameLanText") or "", "kind_cn": r.get("DescLanText") or "",
            "start": int(r["StartTime"]), "end": int(r["EndTime"])} for r in rows if str(r.get("Version")) == version["id"]]
    return sorted(out, key=lambda e: (e["start"], e["id"]))


def pick_hero(rows: list[dict], now: int, art_dir: Path) -> dict | None:
    for r in rows:
        if r.get("KV") and int(r["StartTime"]) <= now < int(r["EndTime"]):
            kv = r["KV"]
            return {"kv": kv, "name_cn": r.get("NameLanText") or "",
                    "art": f"kv/{kv}.webp" if (art_dir / f"{kv}.png").exists() else None,
                    "start": int(r["StartTime"]), "end": int(r["EndTime"])}
    return None


def build_banners(pools: list[dict], skin_ids: set[str], art_dir: Path) -> list[dict]:
    out = []
    for p in pools:
        if not p.get("startTime") or p.get("hidden"):
            continue
        up = list(p.get("characterShow") or [])
        skin = f"{up[0]}{p['characterSkinShow']}" if up and p.get("characterSkinShow") else None
        out.append({"id": str(p["id"]), "name_cn": p.get("nameLanText") or p.get("name") or "", "name_vi": None,
                    "type": p.get("type") or "", "kind_cn": p.get("kindNameLanText") or "",
                    "start": int(p["startTime"]), "end": int(p["endTime"]), "up": up,
                    "up_skin": skin if skin in skin_ids else None,
                    "art": f"banners/{p['id']}.webp" if (art_dir / f"PoolBg_{p['id']}.png").exists() else None})
    return sorted(out, key=lambda x: (-x["start"], x["id"]))


def build_document(master_dir: Path, data_json: Path, art_dir: Path, now: int, masterdata: str) -> dict:
    data = json.loads(data_json.read_text(encoding="utf-8"))
    skin_ids = {s["skinID"] for c in data["characters"].values() for s in c.get("skins") or []}
    version = pick_version(_rows(master_dir / "ActivityVersionMap.json"), now)
    return {"generated_at": now, "masterdata": masterdata, "asset_base_url": data.get("asset_base_url", ""),
            "version": version, "hero": pick_hero(_rows(master_dir / "LoginBackgroundMap.json"), now, art_dir),
            "events": pick_events(_rows(master_dir / "ActivityOverAllMap.json"), version),
            "banners": build_banners(_rows(master_dir / "cardPools.json"), skin_ids, art_dir)}


def dumps(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


def masterdata_version(master_dir: Path) -> str:
    launches = sorted((master_dir.parent / "provenance").glob("launch_*.json"))
    if not launches:
        return ""
    return json.loads(launches[-1].read_text(encoding="utf-8"))["launch"]["ConfigVersion_v2"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--now", type=int, default=int(time.time()), help="unix seconds (tests / reproducing a build)")
    args = parser.parse_args()
    doc = build_document(MASTER, ROOT / "public" / "data.json", ART_DIR, args.now, masterdata_version(MASTER))
    OUT.write_text(dumps(doc), encoding="utf-8")
    print(f"banners.json: {len(doc['banners'])} banners, {len(doc['events'])} events, "
          f"version {doc['version'] and doc['version']['label']}, hero {doc['hero'] and doc['hero']['kv']}, "
          f"art {sum(1 for x in doc['banners'] if x['art'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest discover -s tools -p "test_build_banner_data.py" -v`
Expected: 5 tests OK.

- [ ] **Step 5: Generate the real file and sanity-check it**

Run: `python tools/build_banner_data.py`
Expected (r3071 data, art not extracted yet): `banners.json: 94 banners, 4 events, version 3.4上, hero KV3401, art 0`. Open `public/banners.json` and check `2114` has `"up":["A0184"]`, `"up_skin":"A0184001"`.

- [ ] **Step 6: Commit**

```bash
git add tools/build_banner_data.py tools/test_build_banner_data.py public/banners.json
git commit -m "feat(banners): build public/banners.json from MasterData"
```

---

### Task 2: `publish_banner_art.py` (extract key art + KV, WebP, R2)

**Files:**
- Create: `tools/publish_banner_art.py`, `tools/test_publish_banner_art.py`

**Interfaces:**
- Consumes: `public/banners.json` is **not** needed (reads bundle names from the snapshot index); `tools/publish_assets.py`: `POLICY`, `create_s3_client()`, `load_dotenv_without_logging(path)`, `sha256_file(path)`, `REQUIRED_ENV`.
- Produces: `../NeoArtifacts/Assets/banners/PoolBg_<id>.png`, `<KV>.png` (raw, never overwritten) and R2 objects `banners/<id>.webp`, `kv/<KV>.webp` with metadata `source-sha256`, `policy-version`. Pure helper `object_key(png_name) -> str | None`.

- [ ] **Step 1: Write the failing test**

```python
# tools/test_publish_banner_art.py
import unittest

import publish_banner_art as p


class ObjectKeyTest(unittest.TestCase):
    def test_pool_background_and_kv_keys(self):
        self.assertEqual(p.object_key("PoolBg_2114.png"), "banners/2114.webp")
        self.assertEqual(p.object_key("PoolBg_340001.png"), "banners/340001.webp")
        self.assertEqual(p.object_key("KV3401.png"), "kv/KV3401.webp")

    def test_other_files_are_ignored(self):
        self.assertIsNone(p.object_key("PoolIcon_2114.png"))
        self.assertIsNone(p.object_key("notes.txt"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s tools -p "test_publish_banner_art.py" -v`
Expected: ERROR `No module named 'publish_banner_art'`.

- [ ] **Step 3: Write minimal implementation**

```python
# tools/publish_banner_art.py
"""Banner key art (PoolBg_<id>) and the current hero KV → NeoArtifacts/Assets/banners → WebP → R2.

  python tools/publish_banner_art.py --extract-only   # bundles of the authoritative snapshot → raw PNGs (no network)
  python tools/publish_banner_art.py --dry-run        # + optimize, list the R2 objects that would be uploaded
  python tools/publish_banner_art.py                  # ⚠️ upload (owner yes)
Bundles are picked by FileMD5 (MD5Name is stable across versions, so the first cache hit can be an old copy).
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image

from publish_assets import POLICY, REQUIRED_ENV, create_s3_client, load_dotenv_without_logging, sha256_file

ROOT = Path(__file__).resolve().parent.parent
NEO = ROOT.parent / "NeoArtifacts"
ART_DIR = NEO / "Assets" / "banners"


def object_key(png_name: str) -> str | None:
    if m := re.fullmatch(r"PoolBg_(\d+)\.png", png_name):
        return f"banners/{m.group(1)}.webp"
    if m := re.fullmatch(r"(KV[0-9A-Za-z]+)\.png", png_name):
        return f"kv/{m.group(1)}.webp"
    return None


def _load_bundle(N, idx: dict, name: str):
    import UnityPy
    entry = idx[name]
    for hit in sorted(glob.glob(str(NEO / "Assets" / "runtime_bundle_cache" / "*" / "bundles" / entry["MD5Name"])), reverse=True):
        raw = Path(hit).read_bytes()
        if hashlib.md5(raw).hexdigest() == entry["FileMD5"]:
            data, _ = N.decrypt_unityfs_ab(raw, name)
            return UnityPy.load(data)
    raise RuntimeError(f"{name}: no cached copy with the snapshot's FileMD5 — pull it first (runtime-update)")


def extract() -> list[Path]:
    sys.path.insert(0, str(NEO))
    sys.argv = sys.argv[:1]
    import NeoArtifacts as N
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = N.UNITY_VERSION
    pointer = json.loads((NEO / "Assets" / "runtime_snapshots" / "current_authoritative_snapshot.json").read_text(encoding="utf-8"))
    idx = {e["Name"]: e for e in N.load_build_ab_json(NEO / "Assets" / "runtime_snapshots" / pointer["snapshot_id"] / "data.dat")["ABList"]}
    master = NEO / "MasterData" / "json"
    logins = json.loads((master / "LoginBackgroundMap.json").read_text(encoding="utf-8"))
    now = int(time.time())  # only the hero KV active now (older ui_kv bundles are usually not in the local cache)
    kvs = {r["KV"] for r in (logins if isinstance(logins, list) else logins.values())
           if r.get("KV") and int(r["StartTime"]) <= now < int(r["EndTime"])}
    wanted = {"images_cardpool.ab": lambda n: n.startswith("PoolBg_")}
    for kv in kvs:
        if f"ui_{kv.lower()}.ab" in idx:
            wanted[f"ui_{kv.lower()}.ab"] = lambda n, kv=kv: n == kv
    ART_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for bundle, keep in wanted.items():
        for obj in _load_bundle(N, idx, bundle).objects:
            if obj.type.name != "Texture2D":
                continue
            tex = obj.read()
            dst = ART_DIR / f"{tex.m_Name}.png"
            if keep(tex.m_Name) and not dst.exists():
                tex.image.save(dst)
                written.append(dst)
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extract-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    new = extract()
    print(f"extracted {len(new)} new PNGs into {ART_DIR}")
    if args.extract_only:
        return 0
    load_dotenv_without_logging(ROOT / ".env")
    client = bucket = None
    if not args.dry_run:
        missing = [n for n in REQUIRED_ENV if not os.environ.get(n)]
        if missing:
            raise RuntimeError("Missing required environment variable names: " + ", ".join(missing))
        client, bucket = create_s3_client(), os.environ["R2_BUCKET"]
    uploaded = skipped = 0
    with tempfile.TemporaryDirectory() as tmp:
        for png in sorted(ART_DIR.glob("*.png")):
            key = object_key(png.name)
            if not key:
                continue
            source = sha256_file(png)
            if client:
                try:
                    head = client.head_object(Bucket=bucket, Key=key)
                    if head.get("Metadata", {}).get("source-sha256") == source:
                        skipped += 1
                        continue
                except Exception as exc:  # 404 = new object; anything else is re-raised without endpoint detail
                    if getattr(exc, "response", {}).get("Error", {}).get("Code") not in {"404", "NoSuchKey", "NotFound"}:
                        raise RuntimeError(f"Could not verify remote object {key}") from exc
            webp = Path(tmp) / (png.stem + ".webp")
            Image.open(png).save(webp, "WEBP", quality=POLICY["quality"], method=POLICY["method"])
            if client:
                client.upload_file(str(webp), bucket, key, ExtraArgs={"ContentType": "image/webp", "Metadata": {
                    "source-sha256": source, "policy-version": POLICY["version"]}})
            uploaded += 1
            print(("would upload " if not client else "uploaded ") + key)
    print(f"{'planned' if not client else 'uploaded'} {uploaded}, unchanged {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest discover -s tools -p "test_publish_banner_art.py" -v`
Expected: 2 tests OK.

- [ ] **Step 5: Extract and dry-run on the real snapshot**

Run: `python tools/publish_banner_art.py --dry-run`
Expected: `extracted 84 new PNGs` (the 83 `PoolBg_*` paths of `images_cardpool` + `KV3401`), then 84 `would upload …` lines. Then `python tools/build_banner_data.py` → `art 76` or more (timed pools with art) and hero `art` = `kv/KV3401.webp`.
**Upload (`python tools/publish_banner_art.py` without flags) only after the owner says yes** — list the object count in the question.

- [ ] **Step 6: Commit**

```bash
git add tools/publish_banner_art.py tools/test_publish_banner_art.py public/banners.json
git commit -m "feat(banners): extract banner key art and hero KV, publish WebP to R2"
```

---

### Task 3: `bannerTime.mts`

**Files:**
- Create: `src/features/banners/bannerTime.mts`, `src/features/banners/bannerTime.test.mts`

**Interfaces:**
- Produces: `type BannerStatus = 'upcoming' | 'active' | 'ended'`; `status(nowMs: number, startS: number, endS: number): BannerStatus`; `remaining(nowMs: number, endS: number): string`; `formatDate(s: number, timeZone?: string): string` (`dd/mm/yyyy`).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/banners/bannerTime.test.mts
import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDate, remaining, status } from './bannerTime.mts';

const S = 1_000;
test('status: start inclusive, end exclusive', () => {
  assert.equal(status(99 * S, 100, 200), 'upcoming');
  assert.equal(status(100 * S, 100, 200), 'active');
  assert.equal(status(199_999, 100, 200), 'active');
  assert.equal(status(200 * S, 100, 200), 'ended');
});

test('remaining: days+hours, hours+minutes, minutes, under a minute', () => {
  const end = 1_000_000;
  assert.equal(remaining((end - (8 * 86400 + 10 * 3600 + 59)) * S, end), '8 ngày 10 giờ');
  assert.equal(remaining((end - (5 * 3600 + 12 * 60 + 30)) * S, end), '5 giờ 12 phút');
  assert.equal(remaining((end - (45 * 60 + 5)) * S, end), '45 phút');
  assert.equal(remaining((end - 30) * S, end), '< 1 phút');
  assert.equal(remaining((end + 5) * S, end), '');
});

test('formatDate uses the given time zone', () => {
  // 2026-10-21 18:00 UTC = 2026-10-22 01:00 in Vietnam
  const s = Date.UTC(2026, 9, 21, 18, 0) / 1000;
  assert.equal(formatDate(s, 'Asia/Ho_Chi_Minh'), '22/10/2026');
  assert.equal(formatDate(s, 'UTC'), '21/10/2026');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/features/banners/bannerTime.test.mts`
Expected: FAIL `Cannot find module './bannerTime.mts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/banners/bannerTime.mts
// Banner/event time helpers (spec 2026-09-30 §3.4). Times in the data are unix seconds; "now" is Date.now() ms.
export type BannerStatus = 'upcoming' | 'active' | 'ended';

export function status(nowMs: number, startS: number, endS: number): BannerStatus {
  if (nowMs < startS * 1000) return 'upcoming';
  return nowMs < endS * 1000 ? 'active' : 'ended';
}

export function remaining(nowMs: number, endS: number): string {
  const left = Math.floor((endS * 1000 - nowMs) / 1000);
  if (left <= 0) return '';
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60);
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return m > 0 ? `${m} phút` : '< 1 phút';
}

export function formatDate(s: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(s * 1000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/features/banners/bannerTime.test.mts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/banners/bannerTime.mts src/features/banners/bannerTime.test.mts
git commit -m "feat(banners): status, countdown text and local dates"
```

---

### Task 4: `bannersData.mts`

**Files:**
- Create: `src/features/banners/bannersData.mts`, `src/features/banners/bannersData.test.mts`

**Interfaces:**
- Consumes: `status` from Task 3.
- Produces:
  - `type Banner = { id: string; name_cn: string; name_vi: string | null; type: string; kind_cn: string; start: number; end: number; up: string[]; up_skin: string | null; art: string | null }`
  - `type BannerEvent = { id: number; name_cn: string; kind_cn: string; start: number; end: number }`
  - `type BannersDoc = { generated_at: number; masterdata: string; asset_base_url: string; version: { id: string; label: string; start: number; end: number } | null; hero: { kv: string; name_cn: string; art: string | null; start: number; end: number } | null; events: BannerEvent[]; banners: Banner[] }`
  - `loadBanners(fetchImpl?: typeof fetch): Promise<BannersDoc | null>`
  - `currentBanners(doc: BannersDoc, nowMs: number): { featured: Banner[]; compact: Banner[] }`
  - `currentEvents(doc: BannersDoc, nowMs: number): BannerEvent[]` (active ones)
  - `archive(doc: BannersDoc, f: { character?: string; type?: string; year?: number }, timeZone?: string): { year: number; banners: Banner[] }[]`
  - `upCharacters<C>(b: Banner, characters: Record<string, C>): { id: string; char: C }[]`
  - `artUrl(doc: BannersDoc, path: string | null): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/banners/bannersData.test.mts
import assert from 'node:assert/strict';
import test from 'node:test';

import { archive, artUrl, currentBanners, currentEvents, loadBanners, upCharacters, type Banner, type BannersDoc } from './bannersData.mts';

const b = (id: string, start: number, end: number, extra: Partial<Banner> = {}): Banner =>
  ({ id, name_cn: id, name_vi: null, type: 'time', kind_cn: '限时渠道', start, end, up: ['A0001'], up_skin: null, art: null, ...extra });
const doc = (banners: Banner[]): BannersDoc =>
  ({ generated_at: 0, masterdata: '', asset_base_url: 'https://r2', version: null, hero: null, events: [], banners });
const S = 1000;

test('currentBanners: the latest batch; season and no-UP banners go compact', () => {
  const d = doc([b('old', 10, 100), b('2114', 100, 900, { type: 'limited' }), b('340001', 100, 2000, { type: 'season' }),
    b('5003', 100, 900, { up: [] })]);
  const { featured, compact } = currentBanners(d, 150 * S);
  assert.deepEqual(featured.map((x) => x.id), ['2114']);
  assert.deepEqual(compact.map((x) => x.id), ['340001', '5003']);
});

test('currentBanners keeps an ended batch and marks it ended (site data older than the game)', () => {
  const d = doc([b('old', 10, 100), b('2114', 100, 900, { type: 'limited' })]);
  assert.deepEqual(currentBanners(d, 950 * S).featured.map((x) => x.id), ['2114']);
});

test('currentBanners ignores banners that have not started', () => {
  const d = doc([b('now', 100, 900), b('later', 500, 900)]);
  assert.deepEqual(currentBanners(d, 150 * S).featured.map((x) => x.id), ['now']);
});

test('currentEvents: only active events', () => {
  const d = { ...doc([]), events: [{ id: 1, name_cn: 'a', kind_cn: '', start: 100, end: 900 }, { id: 2, name_cn: 'b', kind_cn: '', start: 500, end: 900 }] };
  assert.deepEqual(currentEvents(d, 150 * S).map((e) => e.id), [1]);
});

test('archive: grouped by year of start (local), newest first, filters combine', () => {
  const y2025 = Date.UTC(2025, 5, 1) / 1000, y2026 = Date.UTC(2026, 5, 1) / 1000;
  const d = doc([b('a', y2026, y2026 + 10, { up: ['A0184'], type: 'limited' }), b('b', y2025, y2025 + 10), b('c', y2026 - 10, y2026)]);
  assert.deepEqual(archive(d, {}, 'UTC').map((g) => [g.year, g.banners.map((x) => x.id)]), [[2026, ['a', 'c']], [2025, ['b']]]);
  assert.deepEqual(archive(d, { character: 'A0184' }, 'UTC').map((g) => g.banners.map((x) => x.id)), [['a']]);
  assert.deepEqual(archive(d, { type: 'time', year: 2026 }, 'UTC').map((g) => g.banners.map((x) => x.id)), [['c']]);
});

test('upCharacters skips ids missing from data.json', () => {
  assert.deepEqual(upCharacters(b('x', 0, 1, { up: ['A0001', 'W0185'] }), { A0001: { slug: 'a' } }), [{ id: 'A0001', char: { slug: 'a' } }]);
});

test('artUrl joins the R2 base; null stays null', () => {
  const d = doc([]);
  assert.equal(artUrl(d, 'banners/2114.webp'), 'https://r2/banners/2114.webp');
  assert.equal(artUrl(d, null), null);
});

test('loadBanners returns null on 404 and on a bad shape', async () => {
  const res = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
  assert.equal(await loadBanners(res(404, {}) as typeof fetch), null);
  assert.equal(await loadBanners(res(200, { banners: 'x' }) as typeof fetch), null);
  assert.equal(await loadBanners((async () => new Response('<html>', { status: 200 })) as typeof fetch), null);
  const ok = await loadBanners(res(200, doc([b('1', 0, 1)])) as typeof fetch);
  assert.equal(ok?.banners.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/features/banners/bannersData.test.mts`
Expected: FAIL `Cannot find module './bannersData.mts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/banners/bannersData.mts
// public/banners.json (tools/build_banner_data.py) → what the Home and Banner pages show. Spec 2026-09-30 §3, §5.
import { status } from './bannerTime.mts';

export type Banner = { id: string; name_cn: string; name_vi: string | null; type: string; kind_cn: string;
  start: number; end: number; up: string[]; up_skin: string | null; art: string | null };
export type BannerEvent = { id: number; name_cn: string; kind_cn: string; start: number; end: number };
export type BannersDoc = { generated_at: number; masterdata: string; asset_base_url: string;
  version: { id: string; label: string; start: number; end: number } | null;
  hero: { kv: string; name_cn: string; art: string | null; start: number; end: number } | null;
  events: BannerEvent[]; banners: Banner[] };

export async function loadBanners(fetchImpl: typeof fetch = fetch): Promise<BannersDoc | null> {
  try {
    const res = await fetchImpl('/banners.json');
    if (!res.ok) return null;
    const doc = await res.json();
    return Array.isArray(doc?.banners) && Array.isArray(doc?.events) ? (doc as BannersDoc) : null;
  } catch {
    return null;
  }
}

/** The newest batch that has started: every started banner still running after the latest start. Kept when it ends
 *  (the site data is older than the game) so the card can say "Đã kết thúc · chờ bản cập nhật". */
export function currentBanners(doc: BannersDoc, nowMs: number): { featured: Banner[]; compact: Banner[] } {
  const started = doc.banners.filter((b) => status(nowMs, b.start, b.end) !== 'upcoming');
  const anchor = Math.max(...started.map((b) => b.start), -Infinity);
  const current = started.filter((b) => b.end > anchor);
  return {
    featured: current.filter((b) => b.up.length > 0 && b.type !== 'season'),
    compact: current.filter((b) => !(b.up.length > 0 && b.type !== 'season')),
  };
}

export function currentEvents(doc: BannersDoc, nowMs: number): BannerEvent[] {
  return doc.events.filter((e) => status(nowMs, e.start, e.end) === 'active');
}

const yearOf = (s: number, timeZone?: string) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric' }).format(s * 1000));

export function archive(doc: BannersDoc, f: { character?: string; type?: string; year?: number }, timeZone?: string) {
  const groups = new Map<number, Banner[]>();
  for (const b of [...doc.banners].sort((x, y) => y.start - x.start)) {
    const year = yearOf(b.start, timeZone);
    if (f.character && !b.up.includes(f.character)) continue;
    if (f.type && b.type !== f.type) continue;
    if (f.year && year !== f.year) continue;
    groups.set(year, [...(groups.get(year) ?? []), b]);
  }
  return [...groups].map(([year, banners]) => ({ year, banners }));
}

export function upCharacters<C>(b: Banner, characters: Record<string, C>): { id: string; char: C }[] {
  return b.up.filter((id) => characters[id]).map((id) => ({ id, char: characters[id] }));
}

export function artUrl(doc: BannersDoc, path: string | null): string | null {
  return path ? `${doc.asset_base_url.replace(/\/$/, '')}/${path}` : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/features/banners/bannersData.test.mts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/banners/bannersData.mts src/features/banners/bannersData.test.mts
git commit -m "feat(banners): current batch, archive, events and loading of banners.json"
```

---

### Task 5: `newReleases.mts` + `staticRoutes.mts`

**Files:**
- Create: `src/features/home/newReleases.mts`, `src/features/home/newReleases.test.mts`, `src/app/router/staticRoutes.mts`, `src/app/router/staticRoutes.test.mts`
- Modify: `src/app/analytics/pageRoute.test.mts` (one assertion)

**Interfaces:**
- Produces:
  - `type Release = { kind: 'character' | 'skin'; id: string; charId: string; name: string; image: string; date: number; isNew: boolean }`
  - `newReleases(characters: Record<string, ReleaseChar>, nowS: number, versionStart: number | null, limit = 8): Release[]` where `ReleaseChar = { id: string; name_vi?: string; name_cn: string; icon?: string; unlock_date?: number | null; skins?: { skinID: string; name_vi?: string | null; name_cn: string; is_base?: boolean; unlock_date?: number | null; image?: string }[] }`
  - `staticView(hash: string): 'home' | 'banners' | null`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/home/newReleases.test.mts
import assert from 'node:assert/strict';
import test from 'node:test';

import { newReleases } from './newReleases.mts';

const chars = {
  A0184: { id: 'A0184', name_vi: 'Thác Kim Bác Sơn Lư', name_cn: '错金博山炉', icon: 'assets/characters/avatars/A0184.png', unlock_date: 500,
    skins: [{ skinID: 'A0184001', name_cn: 'base', is_base: true, unlock_date: 500 }] },
  A0170: { id: 'A0170', name_cn: '小宋香炉', unlock_date: 100,
    skins: [{ skinID: 'A0170003', name_vi: 'Áo mới', name_cn: '新衣', is_base: false, unlock_date: 520, image: 'https://r2/x.webp' }] },
  W0185: { id: 'W0185', name_cn: '刻本山海经', unlock_date: 9000, skins: [] },
};

test('newest first; base skins and future unlocks excluded; isNew from the version start', () => {
  const out = newReleases(chars, 600, 400);
  assert.deepEqual(out.map((r) => [r.kind, r.id, r.isNew]), [['skin', 'A0170003', true], ['character', 'A0184', true], ['character', 'A0170', false]]);
  assert.equal(out[0].name, 'Áo mới');
  assert.equal(out[1].name, 'Thác Kim Bác Sơn Lư');
  assert.equal(out[2].name, '小宋香炉');
});

test('limit and no version', () => {
  assert.equal(newReleases(chars, 600, null, 1).length, 1);
  assert.equal(newReleases(chars, 600, null)[0].isNew, false);
});
```

```ts
// src/app/router/staticRoutes.test.mts
import assert from 'node:assert/strict';
import test from 'node:test';

import { staticView } from './staticRoutes.mts';

test('home and banners routes', () => {
  for (const h of ['', '#', '#/', '/']) assert.equal(staticView(h), 'home');
  assert.equal(staticView('#/banners'), 'banners');
  assert.equal(staticView('#/banners/'), 'banners');
  assert.equal(staticView('#/characters'), null);
  assert.equal(staticView('#/bannersx'), null);
});
```

Add to `src/app/analytics/pageRoute.test.mts`, inside the existing test, after the `#/characters` line:

```ts
  assert.deepEqual(pageForHash('#/banners'), { path: '/banners', route: '/banners' });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/features/home/newReleases.test.mts src/app/router/staticRoutes.test.mts src/app/analytics/pageRoute.test.mts`
Expected: the two new files FAIL (module not found); `pageRoute` passes already (generic path mapping) — keep the assertion as a guard.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/home/newReleases.mts
// "Mới ra mắt" on Home (spec 2026-09-30 §5): characters and non-base skins by unlock_date, released ones only.
export type ReleaseSkin = { skinID: string; name_vi?: string | null; name_cn: string; is_base?: boolean; unlock_date?: number | null; image?: string };
export type ReleaseChar = { id: string; name_vi?: string; name_cn: string; icon?: string; unlock_date?: number | null; skins?: ReleaseSkin[] };
export type Release = { kind: 'character' | 'skin'; id: string; charId: string; name: string; image: string; date: number; isNew: boolean };

export function newReleases(characters: Record<string, ReleaseChar>, nowS: number, versionStart: number | null, limit = 8): Release[] {
  const out: Release[] = [];
  for (const c of Object.values(characters)) {
    if (c.unlock_date && c.unlock_date <= nowS) {
      out.push({ kind: 'character', id: c.id, charId: c.id, name: c.name_vi || c.name_cn, image: c.icon ? `/${c.icon.replace(/^\//, '')}` : '', date: c.unlock_date, isNew: false });
    }
    for (const s of c.skins ?? []) {
      if (!s.is_base && s.unlock_date && s.unlock_date <= nowS) {
        out.push({ kind: 'skin', id: s.skinID, charId: c.id, name: s.name_vi || s.name_cn, image: s.image ?? '', date: s.unlock_date, isNew: false });
      }
    }
  }
  return out
    .sort((a, b) => b.date - a.date || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((r) => ({ ...r, isNew: versionStart !== null && r.date >= versionStart }));
}
```

```ts
// src/app/router/staticRoutes.mts
// Routes owned by React pages without parameters (spec 2026-09-30 §4). parseHash (router.js) asks this first.
export function staticView(hash: string): 'home' | 'banners' | null {
  const path = hash.replace(/^#/, '').replace(/^\/?/, '/').replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  if (path === '/banners') return 'banners';
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/features/home/newReleases.test.mts src/app/router/staticRoutes.test.mts src/app/analytics/pageRoute.test.mts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/newReleases.mts src/features/home/newReleases.test.mts src/app/router/staticRoutes.mts src/app/router/staticRoutes.test.mts src/app/analytics/pageRoute.test.mts
git commit -m "feat(home): new releases list and static home/banners routes"
```

---

### Task 6: Design gate — huashu 3 directions, taste, impeccable (owner picks)

**Files:**
- Create: `docs/public-redesign/home/design-demos/direction-a-*.html`, `…-b-*.html`, `…-c-*.html`, `docs/public-redesign/home/direction-approved.md`

**Interfaces:**
- Consumes: real data — `public/banners.json` (Task 1/2), `public/data.json`; `DESIGN.md`, `PRODUCT.md`, `src/styles/tokens.css`.
- Produces: `direction-approved.md` naming the class names and CSS rules Tasks 7–9 copy: Home blocks (hero, banner row, compact row, events, releases, shortcuts), `BannerCard` (art, fallback avatars, type chip, countdown, ended note, dates), Banner page (filters, year groups), breakpoints 1440 / 980 / 640 / 390, motion notes.

- [ ] **Step 1:** Load `huashu-design` and follow it: three **real** directions for Home built on the r3071 data (hero KV3401 · "3.4上 · 经以山海", banners 2114 / 2115 / 2116 featured, 340001 + 5003 compact, events 榑桑遗境 / 调派特典万嶂烟峦 / 试炼 rows, new releases A0184, W0097, A0170003…), each with the Banner card and a Banner-page strip, at 1440 and 390 px. Serve with `python -m http.server <port>` from the repo root.
- [ ] **Step 2:** Show the owner the three demos (screenshots at 1440 and 390 px); **stop until the owner picks** (may mix).
- [ ] **Step 3:** Taste pass on the chosen demo with the project taste skills (`.claude/skills/design-taste-frontend` and siblings); apply the fixes to the demo.
- [ ] **Step 4:** impeccable: `"<launcher>" detect --viewport 1440x900 <demo>` and `--viewport 390x844`; fix findings; `/impeccable critique` as a **self-review** (no subagents); put the owner's decisions on the critique points into the doc.
- [ ] **Step 5:** Write `direction-approved.md` (what was chosen, class list, CSS values from tokens, motion, phone rules) and commit:

```bash
git add docs/public-redesign/home
git commit -m "docs(design): Home + Banner direction approved"
```

---

### Task 7: `useNow`, `BannerCard`, `BannersPage` (+ styles)

**Files:**
- Create: `src/features/banners/useNow.ts`, `src/features/banners/BannerCard.tsx`, `src/features/banners/BannersPage.tsx`, `src/features/banners/styles/banners.css`

**Interfaces:**
- Consumes: Tasks 3–4 (`status`, `remaining`, `formatDate`, `loadBanners`, `currentBanners`, `archive`, `upCharacters`, `artUrl`, types); `getGameData()` (`src/data/loader.js`); `getCharacterAvatarUrl(char)` (`src/ui/utils/avatar.js`); `useReveal(scope, selector, key)` (`src/features/characters/motion.ts`).
- Produces: `useNow(): number` (ms, refreshed every 30 s and on tab show); `<BannerCard banner doc now characters compact? />`; `mountBannersPage(container: HTMLElement): void`, `unmountBannersPage(): void`.

- [ ] **Step 1: Write `useNow.ts`**

```ts
// src/features/banners/useNow.ts
// One clock per page (spec §3.4): every 30 s — the countdown text has no seconds ("45 phút", "< 1 phút"); paused
// while the tab is hidden and refreshed as soon as it is shown again.
import { useEffect, useState } from 'react';

const TICK_MS = 30_000;

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      if (!document.hidden) timer = window.setTimeout(tick, TICK_MS);
    };
    const onVisible = () => { window.clearTimeout(timer); if (!document.hidden) tick(); };
    timer = window.setTimeout(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return now;
}
```

- [ ] **Step 2: Write `BannerCard.tsx`** (markup and behaviour fixed here; class names must match `direction-approved.md`, rename both together if the direction differs)

```tsx
// src/features/banners/BannerCard.tsx
import { useState } from 'react';
import { formatDate, remaining, status } from './bannerTime.mts';
import { artUrl, upCharacters, type Banner, type BannersDoc } from './bannersData.mts';
import { getCharacterAvatarUrl } from '../../ui/utils/avatar.js';

type Char = { id: string; slug: string; name_vi?: string; name_cn: string; icon?: string };

export function BannerCard({ banner, doc, now, characters, compact = false }:
  { banner: Banner; doc: BannersDoc; now: number; characters: Record<string, Char>; compact?: boolean }) {
  const [artBroken, setArtBroken] = useState(false);
  const ups = upCharacters(banner, characters);
  const state = status(now, banner.start, banner.end);
  const art = artBroken ? null : artUrl(doc, banner.art);
  const upNames = ups.map(({ char }) => char.name_vi || char.name_cn).join(', ');
  return (
    <article className={`bn-card${compact ? ' bn-card--compact' : ''}`} data-state={state}>
      <div className="bn-art">
        {art
          ? <img src={art} alt={banner.name_cn} loading="lazy" onError={() => setArtBroken(true)} />
          : <div className="bn-art-fallback">{ups.map(({ id, char }) => <img key={id} src={getCharacterAvatarUrl(char)} alt="" loading="lazy" />)}</div>}
      </div>
      <div className="bn-body">
        <p className="bn-meta">
          <span className="bn-kind" lang="zh">{banner.kind_cn}</span>
          <span className="bn-dates">{formatDate(banner.start)} – {formatDate(banner.end)}</span>
        </p>
        <h3 className="bn-name">
          {banner.name_vi ?? <span lang="zh">{banner.name_cn}</span>}
          {upNames && <span className="bn-up-names"> · {upNames}</span>}
        </h3>
        {state === 'active' && <p className="bn-countdown">Còn {remaining(now, banner.end)}</p>}
        {state === 'ended' && <p className="bn-ended">Đã kết thúc · chờ bản cập nhật</p>}
        {!compact && ups.length > 0 && (
          <ul className="bn-ups">
            {ups.map(({ id, char }) => (
              <li key={id}><a href={`#/characters/${char.slug}`}><img src={getCharacterAvatarUrl(char)} alt="" loading="lazy" />{char.name_vi || char.name_cn}</a></li>
            ))}
            {banner.up_skin && <li><a href={`#/skins/${banner.up_skin}`}>Trang phục</a></li>}
          </ul>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Write `BannersPage.tsx`**

```tsx
// src/features/banners/BannersPage.tsx
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { BannerCard } from './BannerCard.tsx';
import { archive, currentBanners, loadBanners, type BannersDoc } from './bannersData.mts';
import { useNow } from './useNow.ts';
import { useReveal } from '../characters/motion.ts';
import { getGameData } from '../../data/loader.js';
import './styles/banners.css';

const TYPES: [string, string][] = [['', 'Tất cả'], ['limited', 'Giới hạn'], ['time', 'Có thời hạn'], ['season', 'Theo mùa'], ['oldtime', 'Thường trực']];

export function BannersPage({ doc }: { doc: BannersDoc | null }) {
  const characters = getGameData().characters;
  const [character, setCharacter] = useState('');
  const [type, setType] = useState('');
  const [year, setYear] = useState(0);
  const now = useNow();
  const page = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => (doc ? archive(doc, { character, type, year: year || undefined }) : []), [doc, character, type, year]);
  const years = useMemo(() => (doc ? archive(doc, {}).map((g) => g.year) : []), [doc]);
  useReveal(page, '.bn-year', `${character}|${type}|${year}`);
  if (!doc) return <div className="bn-page"><p className="bn-error">Chưa tải được dữ liệu banner</p></div>;
  const { featured, compact } = currentBanners(doc, now);
  const upIds = [...new Set(doc.banners.flatMap((b) => b.up))].filter((id) => characters[id]);
  return (
    <div className="bn-page" ref={page}>
      <h1 className="bn-title">Banner</h1>
      <section className="bn-current" aria-label="Banner đang mở">
        {featured.map((b) => <BannerCard key={b.id} banner={b} doc={doc} now={now} characters={characters} />)}
        {compact.map((b) => <BannerCard key={b.id} banner={b} doc={doc} now={now} characters={characters} compact />)}
      </section>
      <section className="bn-archive" aria-label="Lưu trữ banner">
        <div className="bn-filters">
          <label>Khí Giả <select value={character} onChange={(e) => setCharacter(e.target.value)}>
            <option value="">Tất cả</option>
            {upIds.map((id) => <option key={id} value={id}>{characters[id].name_vi || characters[id].name_cn}</option>)}
          </select></label>
          <label>Loại <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
          <label>Năm <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            <option value={0}>Tất cả</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select></label>
        </div>
        {groups.map((g) => (
          <div className="bn-year" key={g.year}>
            <h2>{g.year}</h2>
            {g.banners.map((b) => <BannerCard key={b.id} banner={b} doc={doc} now={now} characters={characters} compact />)}
          </div>
        ))}
      </section>
    </div>
  );
}

let root: Root | null = null;
let generation = 0;

export function unmountBannersPage() {
  generation += 1;
  root?.unmount();
  root = null;
}

export function mountBannersPage(container: HTMLElement): Promise<void> {
  unmountBannersPage();
  const mine = generation;
  return loadBanners().then((doc) => {
    if (mine !== generation) return;
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    flushSync(() => mounted.render(<StrictMode><BannersPage doc={doc} /></StrictMode>));
  });
}
```

- [ ] **Step 4: Write `styles/banners.css`** from `direction-approved.md` — only tokens from `src/styles/tokens.css`, the classes above (`bn-page`, `bn-title`, `bn-current`, `bn-card`, `bn-card--compact`, `bn-art`, `bn-art-fallback`, `bn-body`, `bn-meta`, `bn-kind`, `bn-dates`, `bn-name`, `bn-up-names`, `bn-countdown`, `bn-ended`, `bn-ups`, `bn-archive`, `bn-filters`, `bn-year`, `bn-error`), `[data-state="ended"]` styling, phone layout ≤ 640 px, no horizontal scroll at 390 px, `prefers-reduced-motion` respected (GSAP is in `useReveal`).

- [ ] **Step 5: Typecheck and tests**

Run (background, one at a time): `npx tsc --noEmit -p tsconfig.json`, then `npm test`.
Expected: 0 type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/banners
git commit -m "feat(banners): banner card and Banner page"
```

---

### Task 8: `HomePage` (+ styles)

**Files:**
- Create: `src/features/home/HomePage.tsx`, `src/features/home/styles/home.css`

**Interfaces:**
- Consumes: Task 4 (`loadBanners`, `currentBanners`, `currentEvents`, `artUrl`), Task 3 (`remaining`), Task 5 (`newReleases`), Task 7 (`BannerCard`, `useNow`), `getGameData()`, `getCharacterAvatarUrl`, `useReveal`.
- Produces: `mountHomePage(container: HTMLElement): Promise<void>`, `unmountHomePage(): void`.

- [ ] **Step 1: Write `HomePage.tsx`**

```tsx
// src/features/home/HomePage.tsx
// Home (spec 2026-09-30 §5, Q2): hero, current banners, current events, new releases, shortcuts.
import { StrictMode, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { BannerCard } from '../banners/BannerCard.tsx';
import { remaining } from '../banners/bannerTime.mts';
import { artUrl, currentBanners, currentEvents, loadBanners, type BannersDoc } from '../banners/bannersData.mts';
import { useNow } from '../banners/useNow.ts';
import { useReveal } from '../characters/motion.ts';
import { newReleases } from './newReleases.mts';
import { getGameData } from '../../data/loader.js';
import './styles/home.css';

const SHORTCUTS: [string, string][] = [['#/characters', 'Khí Giả'], ['#/gallery', 'Trang Phục'], ['#/weapons', 'Vũ Khí'], ['#/banners', 'Banner'], ['#calc', 'Công cụ']];

export function HomePage({ doc }: { doc: BannersDoc | null }) {
  const characters = getGameData().characters;
  const now = useNow();
  const page = useRef<HTMLDivElement>(null);
  useReveal(page, '.home-block', 'home');
  const releases = newReleases(characters, Math.floor(now / 1000), doc?.version?.start ?? null);
  const hero = doc?.hero;
  const heroArt = doc && hero ? artUrl(doc, hero.art) : null;
  const banners = doc ? currentBanners(doc, now) : null;
  const events = doc ? currentEvents(doc, now) : [];
  return (
    <div className="home-page" ref={page}>
      <header className="home-hero home-block">
        {heroArt && <img src={heroArt} alt="" />}
        <div className="home-hero-text">
          {doc?.version && <p className="home-version">{doc.version.label}</p>}
          {hero && <h1 lang="zh">{hero.name_cn}</h1>}
          {!hero && <h1>Vật Hoa Di Tân</h1>}
        </div>
      </header>
      <section className="home-block home-banners" aria-label="Banner đang mở">
        <h2>Banner đang mở</h2>
        {!banners && <p className="bn-error">Chưa tải được dữ liệu banner</p>}
        {banners?.featured.map((b) => <BannerCard key={b.id} banner={b} doc={doc!} now={now} characters={characters} />)}
        {banners && banners.compact.length > 0 && (
          <div className="home-compact">{banners.compact.map((b) => <BannerCard key={b.id} banner={b} doc={doc!} now={now} characters={characters} compact />)}</div>
        )}
        <a className="home-more" href="#/banners">Tất cả banner ›</a>
      </section>
      {events.length > 0 && (
        <section className="home-block home-events" aria-label="Sự kiện đang diễn ra">
          <h2>Sự kiện đang diễn ra</h2>
          <ul>{events.map((e) => (
            <li key={e.id}><span className="home-event-kind" lang="zh">{e.kind_cn}</span> <span lang="zh">{e.name_cn}</span>
              <span className="home-event-left">Còn {remaining(now, e.end)}</span></li>
          ))}</ul>
        </section>
      )}
      {releases.length > 0 && (
        <section className="home-block home-releases" aria-label="Mới ra mắt">
          <h2>Mới ra mắt</h2>
          <ul>{releases.map((r) => {
            const char = characters[r.charId];
            const href = r.kind === 'skin' ? `#/skins/${r.id}` : `#/characters/${char.slug}`;
            return <li key={r.id}><a href={href}><img src={r.image} alt="" loading="lazy" />{r.name}{r.isNew && <span className="home-new">NEW</span>}</a></li>;
          })}</ul>
        </section>
      )}
      <nav className="home-block home-shortcuts" aria-label="Lối tắt">
        {SHORTCUTS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
      </nav>
    </div>
  );
}

let root: Root | null = null;
let generation = 0;

export function unmountHomePage() {
  generation += 1;
  root?.unmount();
  root = null;
}

export function mountHomePage(container: HTMLElement): Promise<void> {
  unmountHomePage();
  const mine = generation;
  return loadBanners().then((doc) => {
    if (mine !== generation) return;
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    flushSync(() => mounted.render(<StrictMode><HomePage doc={doc} /></StrictMode>));
  });
}
```

- [ ] **Step 2: Write `styles/home.css`** from `direction-approved.md` — tokens only; classes `home-page`, `home-hero`, `home-hero-text`, `home-version`, `home-block`, `home-banners`, `home-compact`, `home-more`, `home-events`, `home-event-kind`, `home-event-left`, `home-releases`, `home-new`, `home-shortcuts`; hero art covers without layout shift (fixed aspect ratio); ≤ 640 px single column; no horizontal scroll at 390 px.

- [ ] **Step 3: Typecheck and tests** — `npx tsc --noEmit -p tsconfig.json`, then `npm test` (background, one at a time). Expected: 0 errors, all pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/home
git commit -m "feat(home): Home page with banners, events, new releases and shortcuts"
```

---

### Task 9: Routing, containers, navigation

**Files:**
- Modify: `src/app/router/router.js` (imports; `parseHash` start `:49-56`; `VIEW_CONTAINERS` `:169-175`; `renderRouteView` `:178-195`; the `#/` rewrite in `handleRoute` `:227-231`), `index.html` (after `#skin-detail-view`, `:188-190`), `src/app/layout/AppNav.tsx` (`PUBLIC_LINKS` `:20-25`, brand link `:97`, icon import `:3`)

**Interfaces:**
- Consumes: `staticView` (Task 5), `mountHomePage`/`unmountHomePage` (Task 8), `mountBannersPage`/`unmountBannersPage` (Task 7).

- [ ] **Step 1: `router.js`**

Add imports next to the other view imports:

```js
import { staticView } from './staticRoutes.mts';
import { mountHomePage, unmountHomePage } from '../../features/home/HomePage.tsx';
import { mountBannersPage, unmountBannersPage } from '../../features/banners/BannersPage.tsx';
```

Replace the "Default home route" block at the top of `parseHash` with:

```js
  const pageView = staticView(window.location.hash);
  if (pageView) return { view: pageView, slug: '', subtab: '' };
```

Add to `VIEW_CONTAINERS`:

```js
  home: 'home-view',
  banners: 'banners-view',
```

In `renderRouteView`, unmount the React pages whenever their container is emptied and mount them when targeted. Replace the loop and the dispatch with:

```js
  for (const id of Object.values(VIEW_CONTAINERS)) {
    const el = document.getElementById(id);
    if (el && el !== target) {
      if (id === 'home-view') unmountHomePage();
      if (id === 'banners-view') unmountBannersPage();
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  }
  const mainContent = document.getElementById('main-content');
  if (target !== mainContent) {
    mainContent.classList.add('hidden');
    target.classList.remove('hidden');
    if (route.view === 'home') mountHomePage(target);
    else if (route.view === 'banners') mountBannersPage(target);
    else if (route.view === 'catalog') renderCharacterCatalogView(target);
    else if (route.view === 'character') renderCharacterDetail(route.slug, route.subtab);
    else if (route.view === 'weapons') renderWeaponsView(target);
    else if (route.view === 'gallery') renderSkinGalleryView(target);
    else renderSkinDetailView(target, route.skinId);
    return;
  }
```

Delete the rewrite in `handleRoute`:

```js
  // Redirect / or empty hash to canonical #/characters
  const rawHash = window.location.hash;
  if (!rawHash || rawHash === '#' || rawHash === '#/') {
    history.replaceState(null, '', '#/characters');
  }
```

- [ ] **Step 2: `index.html`** — after the Skin Detail `<main>`:

```html
    <!-- Home View Root (React, src/features/home/HomePage.tsx) -->
    <main id="home-view" class="home-view hidden"></main>

    <!-- Banners View Root (React, src/features/banners/BannersPage.tsx) -->
    <main id="banners-view" class="banners-view hidden"></main>
```

- [ ] **Step 3: `AppNav.tsx`** — add `House, Sparkles` to the existing `lucide-react` import (v1.47 exports `House`, not `Home`), then:

```tsx
const PUBLIC_LINKS = [
  { href: '#/', label: 'Trang chủ', icon: House, views: ['home'] },
  { href: '#/characters', label: 'Khí Giả', icon: UsersRound, views: ['catalog', 'character'] },
  { href: '#/gallery', label: 'Trang Phục', icon: Shirt, views: ['gallery', 'skin-detail'] },
  { href: '#/banners', label: 'Banner', icon: Sparkles, views: ['banners'] },
  { href: '#/weapons', label: 'Vũ Khí', icon: Sword, views: ['weapons'] },
  { href: '#calc', label: 'Công cụ', icon: Calculator, views: ['calculator'] },
];
```

and the brand link `href="#/characters" … onClick={linkClick('#/characters')}` → `href="#/" … onClick={linkClick('#/')}`. The mobile menu reads the same `PUBLIC_LINKS`; check its item count/layout at 390 px in Task 10.

- [ ] **Step 4: Typecheck, tests, build** — `npx tsc --noEmit -p tsconfig.json`, `npm test`, `npm run build` (background, one at a time). Expected: 0 errors, all pass, build OK.

- [ ] **Step 5: Commit**

```bash
git add src/app/router/router.js index.html src/app/layout/AppNav.tsx
git commit -m "feat(nav): Home at #/ and Banner page at #/banners"
```

---

### Task 10: Browser verification, release-day docs, owner gates

**Files:**
- Modify: `docs/WHMX_COMMANDS.md` (§4 step C), `docs/WHMX_CURRENT_STATE_FINAL_2026-10-02.md` (§2 status row, §11 roadmap line), `docs/superpowers/specs/2026-09-30-home-banners-design.md` (status line)

- [ ] **Step 1: Browser checks (Playwright MCP, dev server `preview_start whmxcalc-dev`, port 5173):**
  - `#/` and `#/banners` at 1440×900 and 390×844: no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), all blocks visible, countdown text present on active cards.
  - Reduced motion (`emulateMedia({ reducedMotion: 'reduce' })`): content visible without animation.
  - Ended state: `page.clock.setFixedTime(new Date('2026-10-23T00:00:00+07:00'))` → cards 2114/2115/2116 show "Đã kết thúc · chờ bản cập nhật", 340001 still counts down.
  - `banners.json` missing: `page.route('**/banners.json', r => r.fulfill({ status: 404 }))` → "Chưa tải được dữ liệu banner", shortcuts and new releases still render.
  - Broken art: `page.route('**/banners/2114.webp', r => r.fulfill({ status: 404 }))` → card 2114 shows UP avatars.
  - `#/characters`, a character page, `#/gallery`, `#calc` still work; Back from Home returns correctly; nav highlights "Trang chủ" / "Banner".
  - impeccable `detect` on `http://localhost:5173/#/` and `#/banners` at both viewports; fix what it reports.
- [ ] **Step 2: Self-review** with `ponytail:ponytail-review` on the branch diff; fix findings; state it is a self-review.
- [ ] **Step 3: Docs** — `WHMX_COMMANDS.md` §4 step C, after `publish_assets.py`:

```bash
python tools/publish_banner_art.py --dry-run     # key art + hero KV of the new snapshot
python tools/publish_banner_art.py               # ⚠️ upload WebP to R2 (owner yes)
python tools/build_banner_data.py                # MasterData → public/banners.json (commit it with data.json)
```

  Status row in the state file ("Home + Banner — built, not pushed" or "live" after Step 4), roadmap entry, spec status → implemented.
- [ ] **Step 4: Owner gates** — ask for yes, then in this order: (1) `python tools/publish_banner_art.py` (R2 upload, give the object count); (2) `git push origin HEAD:main` + `git push origin HEAD` (after `git fetch` and the ancestor check); (3) production check at `https://whmxsite.vercel.app/#/` and `#/banners` (1440 + 390); (4) Vercel prune to 5.

- [ ] **Step 5: Commit docs**

```bash
git add docs/WHMX_COMMANDS.md docs/WHMX_CURRENT_STATE_FINAL_2026-10-02.md docs/superpowers/specs/2026-09-30-home-banners-design.md docs/superpowers/plans/2026-09-30-home-banners.md
git commit -m "docs: Home + Banner release-day steps and status"
```
