# Lore Pipeline (character profile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Postgres the working authority for character profile/lore text and publish it to the public site through R2 without commits or redeploys (spec phases P1–P3 + backup + archive images).

**Architecture:** A read-only importer normalizes raw MasterData into `character_profiles` / `profile_texts` / `lore_terms`. One per-entity resolver (`resolveCharacterProfile`) shapes a profile in the `legacy` or `v2` shape. The shaped profiles feed the local `data.json` overlay (Python applies them, so key order is preserved) and a publisher that writes a versioned JSON + pointer to R2 and a gzipped backup to a private bucket. The frontend merges the R2 overlay over `data.json`, falling back to the CN already there.

**Tech Stack:** Node 24 ESM (`.mjs`), Drizzle ORM + `postgres` driver, `@aws-sdk/client-s3` (installed), Python 3 (build tools, openpyxl), Vite + vanilla JS loader, `node:test` for tests (built in, no new dependency).

**Spec:** `docs/superpowers/specs/2026-09-24-lore-pipeline-design.md` (approved 2026-09-24). Read it before any task.

> **Status 2026-09-26:** all 12 tasks done and live (see `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md` §7 log, 2026-09-24).

## Global Constraints

- Owner rules: no push/merge/reset/restore/clean; commit only your own files, only when verified; never stage `localization/localization_master.xlsx`.
- The workbook is **read-only** here (openpyxl `read_only=True`). No workbook writes in this plan.
- Any write to the live Neon DB (migration, `--apply`, restore `--apply`) is an **OWNER GATE**: print the exact plan/row list, stop, wait for the owner's "yes".
- One npm command at a time, in the background, no short timeout.
- Scratch/temp files go on drive D (`D:\BaiTapCode\WHMX\_claude_scratch\`), never C.
- After each task: update the status table and log in `docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md`, then commit.
- Only `vi_origin = 'admin'` **and** `state = 'ok'` VI is ever exported/published. Legacy VI is stored, never exported.
- No raw codes (`^[KTSP]\d{4}$`) and no report file IDs in the `v2` shape.
- Nothing is inferred from ID shape; only `UnlockType 2` is interpreted (as an affinity level).
- `package.json` is `"type": "commonjs"`: new Node modules use `.mjs`; frontend modules that need a Node test use `.mts` (`.ts` fails under CommonJS; verified).
- Replies to the owner in Vietnamese, "tôi/bạn".

## Review Focus

1. **Key-order drift in `data.json`:** Node's `JSON.parse`/`stringify` moves integer-like keys (`items: {"3", …, "1001"}`) — verified. The overlay therefore never re-serializes `data.json` in Node; `tools/apply_profile_overlay.py` does it (Task 6 test pins byte-identity).
2. **CN changes under saved VI:** a re-import with a changed CN must keep the VI, flag `source_changed`, and stop publishing that VI (Task 3 + Task 5 tests).
3. **A unit disappearing from raw:** it must be marked `source_present = false`, never deleted, and not exported (Task 3 + Task 5 tests).
4. **R2 unreachable / bad pointer / slow network on the public site:** the page must still render with the CN from `data.json` within 5 s (Task 10 tests).
5. **Two publishes at once:** the second returns `busy` and writes nothing; an older snapshot can never overwrite a newer pointer (Task 8 test).

---

## File map

| File | Responsibility |
|---|---|
| `db/schema/core.mjs` (modify) | add `character_profile`, `lore_term` to `managed_entity_type` |
| `db/schema/profile.mjs` (new) | enums + `character_profiles`, `profile_texts`, `lore_terms`, `lore_publish_state` |
| `db/schema/index.mjs` (modify) | export profile schema |
| `db/migrations/0005_*.sql` (generated) | migration |
| `scripts/lib/profile-source.mjs` (+ `.test.mjs`) | pure: raw MasterData → normalized profiles/units/terms |
| `scripts/lib/profile-legacy.mjs` (+ `.test.mjs`) | pure: workbook PROFILE rows → legacy VI seeds |
| `scripts/read_profile_legacy_vi.py` | read-only PROFILE sheet reader (stdout JSON) |
| `scripts/lib/profile-import-plan.mjs` (+ `.test.mjs`) | pure: normalized + current DB rows → write plan |
| `scripts/import-character-profile.mjs` | CLI: `--check`, plan (default, read-only), `--apply`, `--seed-legacy-workbook` |
| `server/profile/profile-code-maps.mjs` | `DEPARTMENT_VI`, `STAFF_STATUS_MAP`, `STORE_STATUS_MAP` (JS copies of the Python maps) |
| `server/profile/shape-character-profile.mjs` (+ `.test.mjs`) | pure: rows → `legacy` / `v2` profile |
| `server/profile/resolve-character-profile.mjs` | DB context loader + `resolveCharacterProfile(characterId, ctx, {shape})` |
| `scripts/export-profile-overlay.mjs` | prints `{characterId: profile}` JSON to stdout |
| `tools/apply_profile_overlay.py` (+ `tools/test_apply_profile_overlay.py`) | applies overlay JSON (stdin) to `data.json`, atomic, order-preserving |
| `scripts/check-profile-overlay.mjs` | gate-2 checker |
| `server/profile/lore-document.mjs` (+ `.test.mjs`) | pure: document/pointer/backup-key builders |
| `server/profile/lore-storage.mjs` | R2 client for the lore prefix + private backup bucket |
| `server/profile/lore-repository.mjs` | DB side of publishing (lock, load, state) |
| `server/profile/lore-publisher.mjs` (+ `.test.mjs`) | `publishLore({repo, storage, actorUserId, now})` |
| `server/admin-api-routes/lore.mjs`, `api/admin/[...].js` (modify) | `GET/POST /api/admin/lore/publish` |
| `scripts/publish-lore.mjs` | CLI: `--dry-run`, publish, `--repoint <file>` |
| `server/profile/lore-restore.mjs` (+ `.test.mjs`), `scripts/restore-lore-snapshot.mjs` | restore plan + CLI |
| `src/features/profile/api/loreOverlay.mts` (+ `.test.mts`), `src/data/loader.js` (modify), `tsconfig.json` (modify) | frontend overlay |
| `tools/asset_publish_manifest.py`, `tools/build_web_data.py` (modify) | archive images |

Run all JS tests with: `node --test scripts/lib/ server/profile/ src/features/profile/` (Node 24 discovers `*.test.mjs` / `*.test.mts`).

---

## Phase P1 — schema + importer

### Task 1: Raw source normalizer

**Files:**
- Create: `scripts/lib/profile-source.mjs`
- Test: `scripts/lib/profile-source.test.mjs`

**Interfaces:**
- Produces: `normalizeProfileSources(raw, characterIds) → { profiles: NormalizedProfile[], terms: NormalizedTerm[], skipped: string[] }` where
  - `raw = { characterFiles, characterFileTextMap, historicalRelicsMap, historicalTextMap, friendshipDescription, characterTable, typeJJHMap }` (parsed JSON objects keyed by ID),
  - `NormalizedProfile = { characterId, recordId, staffStatusCn, storeStatusCn, organisationCode, relicTypeCode, eraCode, museumCode, eraRangeCode, legacyRelicFields: {hasEntry, relicName, dynasty, museum}, structure: {reports: [{fileId, kind, unlock: {type, elementId}}], timeline: string[]}, sourceHash, units: [{unitKey, sourceCn, sourceRef, sourceHash}] }`,
  - `NormalizedTerm = { code, kind, nameCn, detailCn, sourceHash }`.
- Produces: `sha256(text) → hex`, `hashValue(value) → hex` (stable key order).

- [x] **Step 1: Write the failing test**

```js
// scripts/lib/profile-source.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProfileSources } from './profile-source.mjs';

const raw = {
  characterFiles: {
    V0053: {
      recordID: ' 1-131-100 ', stafflanText: '已登记', storelanText: '安全', cardIntrolanText: ' 介绍 ',
      basicFileID: ['V005301', 'V005302'], basicFileUnlock: [{ UnlockType: 2, ElementID: '1', Param: 1 }, { UnlockType: 2, ElementID: '5', Param: 1 }],
      specialFileID: ['V005305'], specialFileUnlock: [{ UnlockType: 3, ElementID: 'M700011', Param: 1 }],
    },
    W0021: { recordID: 'x', basicFileID: [] },
  },
  characterFileTextMap: {
    V005301: { titleLanText: '报告1', textLanText: '内容1' },
    V005302: { titleLanText: '', textLanText: '' },
    V005305: { titleLanText: '特别', textLanText: '特别内容' },
  },
  historicalRelicsMap: {
    V0053: {
      relics: 'K1001', dynasty: 'T2005', museum: 'S3059', photoDynasty: 'P8002',
      relicslanText: 'K1001', dynastylanText: 'T2005', museumlanText: 'S3059', introductionlanText: '本源',
      ageAlanText: '战国', ageStoryAlanText: '故事A', ageBlanText: '', ageStoryBlanText: '', ageElan: 'unused',
    },
  },
  historicalTextMap: {
    K1001: { Text: '玉器', TextIntroduce: '玉器介绍' }, T2005: { Text: '春秋战国', TextIntroduce: '' },
    S3059: { Text: '杭州博物馆', TextIntroduce: '馆' }, P8002: { Text: '夏商周', TextIntroduce: '' }, B5001: { Text: '墓', TextIntroduce: '' },
  },
  friendshipDescription: { 1: { level: 1, iconDescriptionLanText: '感应', descriptionLanText: '感应' }, 5: { level: 5, iconDescriptionLanText: '鹿鸣', descriptionLanText: '鹿鸣' } },
  characterTable: { V0053: { typeJJh: 2 }, W0021: { typeJJh: 1 } },
  typeJJHMap: { 2: { NameLanText: '商业部', FileLanText: '商业部介绍' }, 5: { NameLanText: '非冬谷', FileLanText: '测试' } },
};

test('builds units, structure and referenced terms only', () => {
  const out = normalizeProfileSources(raw, ['V0053']);
  assert.deepEqual(out.skipped, ['W0021']);
  const [p] = out.profiles;
  assert.equal(p.recordId, '1-131-100');
  assert.equal(p.organisationCode, '2');
  assert.deepEqual(p.legacyRelicFields, { hasEntry: true, relicName: 'K1001', dynasty: 'T2005', museum: 'S3059' });
  assert.deepEqual(p.structure.reports, [
    { fileId: 'V005301', kind: 'basic', unlock: { type: 2, elementId: '1' } },
    { fileId: 'V005302', kind: 'basic', unlock: { type: 2, elementId: '5' } },
    { fileId: 'V005305', kind: 'special', unlock: { type: 3, elementId: 'M700011' } },
  ]);
  assert.deepEqual(p.structure.timeline, ['A']);
  assert.deepEqual(p.units.map((u) => u.unitKey), [
    'card_intro', 'report.V005301.title', 'report.V005301.content',
    'report.V005305.title', 'report.V005305.content', 'relic_intro', 'timeline.A.label', 'timeline.A.story',
  ]);
  assert.equal(p.units[0].sourceCn, '介绍');
  assert.equal(p.units[1].sourceRef, 'characterFileTextMap:V005301.titleLanText');
  assert.deepEqual(out.terms.map((t) => t.code), ['AFFINITY_1', 'AFFINITY_5', 'K1001', 'ORG_2', 'P8002', 'S3059', 'T2005']);
  const org = out.terms.find((t) => t.code === 'ORG_2');
  assert.deepEqual([org.kind, org.nameCn, org.detailCn], ['organisation', '商业部', '商业部介绍']);
});

test('a referenced code missing from HistoricalTextMap aborts', () => {
  const broken = structuredClone(raw);
  delete broken.historicalTextMap.K1001;
  assert.throws(() => normalizeProfileSources(broken, ['V0053']), /K1001/);
});

test('hashes are stable across runs', () => {
  assert.equal(normalizeProfileSources(raw, ['V0053']).profiles[0].sourceHash, normalizeProfileSources(raw, ['V0053']).profiles[0].sourceHash);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/profile-source.test.mjs`
Expected: FAIL with `Cannot find module` / `ERR_MODULE_NOT_FOUND` for `profile-source.mjs`.

- [x] **Step 3: Write minimal implementation**

```js
// scripts/lib/profile-source.mjs
// Pure: raw MasterData tables -> normalized lore rows. No I/O, no DB.
import { createHash } from 'node:crypto';

export const sha256 = (text) => createHash('sha256').update(String(text)).digest('hex');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
export const hashValue = (value) => sha256(JSON.stringify(stable(value)));

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());
const SLOTS = ['A', 'B', 'C', 'D', 'E', 'F'];
// Kind comes from the raw field that references the code, never from the code's first letter.
const FIELD_KIND = { relics: 'relic_type', dynasty: 'era', museum: 'museum', photoDynasty: 'era_range' };

function unit(units, unitKey, sourceCn, sourceRef) {
  if (sourceCn) units.push({ unitKey, sourceCn, sourceRef, sourceHash: sha256(sourceCn) });
}

export function normalizeProfileSources(raw, characterIds) {
  const wanted = new Set(characterIds);
  const skipped = Object.keys(raw.characterFiles).filter((id) => !wanted.has(id)).sort();
  const terms = new Map();
  const profiles = [];

  for (const characterId of [...wanted].sort()) {
    const file = raw.characterFiles[characterId] || {};
    const relic = raw.historicalRelicsMap[characterId];
    const units = [];
    unit(units, 'card_intro', text(file.cardIntrolanText), `characterFiles:${characterId}.cardIntrolanText`);

    const reports = [];
    for (const [kind, ids, unlocks] of [
      ['basic', file.basicFileID, file.basicFileUnlock],
      ['special', file.specialFileID, file.specialFileUnlock],
    ]) {
      (Array.isArray(ids) ? ids : []).forEach((fileId, index) => {
        const lock = (Array.isArray(unlocks) ? unlocks[index] : null) || {};
        reports.push({ fileId, kind, unlock: { type: Number(lock.UnlockType ?? 0), elementId: text(lock.ElementID) } });
        const entry = raw.characterFileTextMap[fileId] || {};
        unit(units, `report.${fileId}.title`, text(entry.titleLanText), `characterFileTextMap:${fileId}.titleLanText`);
        unit(units, `report.${fileId}.content`, text(entry.textLanText), `characterFileTextMap:${fileId}.textLanText`);
        if (kind === 'basic' && lock.UnlockType === 2) {
          const level = text(lock.ElementID);
          const friend = raw.friendshipDescription[level];
          if (!friend) throw new Error(`friendshipDescription has no level ${level} (report ${fileId})`);
          addTerm(terms, `AFFINITY_${level}`, 'affinity_level', text(friend.iconDescriptionLanText), text(friend.descriptionLanText));
        }
      });
    }

    const timeline = [];
    if (relic) {
      unit(units, 'relic_intro', text(relic.introductionlanText), `historicalRelicsMap:${characterId}.introductionlanText`);
      for (const slot of SLOTS) {
        const label = text(relic[`age${slot}lanText`]);
        const story = text(relic[`ageStory${slot}lanText`]);
        if (!label && !story) continue;
        timeline.push(slot);
        unit(units, `timeline.${slot}.label`, label, `historicalRelicsMap:${characterId}.age${slot}lanText`);
        unit(units, `timeline.${slot}.story`, story, `historicalRelicsMap:${characterId}.ageStory${slot}lanText`);
      }
      for (const [field, kind] of Object.entries(FIELD_KIND)) {
        const code = text(relic[field]);
        if (!code) continue;
        const entry = raw.historicalTextMap[code];
        if (!entry) throw new Error(`HistoricalTextMap has no entry for ${code} (${characterId}.${field})`);
        addTerm(terms, code, kind, text(entry.Text), text(entry.TextIntroduce));
      }
    }

    const organisationCode = text((raw.characterTable[characterId] || {}).typeJJh) || null;
    if (organisationCode) {
      const org = raw.typeJJHMap[organisationCode];
      if (!org) throw new Error(`TypeJJHMap has no entry ${organisationCode} (${characterId})`);
      addTerm(terms, `ORG_${organisationCode}`, 'organisation', text(org.NameLanText), text(org.FileLanText));
    }

    const profile = {
      characterId,
      recordId: text(file.recordID),
      staffStatusCn: text(file.stafflanText),
      storeStatusCn: text(file.storelanText),
      organisationCode,
      relicTypeCode: text(relic?.relics) || null,
      eraCode: text(relic?.dynasty) || null,
      museumCode: text(relic?.museum) || null,
      eraRangeCode: text(relic?.photoDynasty) || null,
      legacyRelicFields: {
        hasEntry: Boolean(relic),
        relicName: text(relic?.relicslanText),
        dynasty: text(relic?.dynastylanText),
        museum: text(relic?.museumlanText),
      },
      structure: { reports, timeline },
      units,
    };
    const { units: _u, ...structural } = profile;
    profiles.push({ ...profile, sourceHash: hashValue(structural) });
  }

  return { profiles, terms: [...terms.values()].sort((a, b) => a.code.localeCompare(b.code)), skipped };
}

function addTerm(terms, code, kind, nameCn, detailCn) {
  if (!terms.has(code)) terms.set(code, { code, kind, nameCn, detailCn, sourceHash: hashValue({ nameCn, detailCn }) });
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/profile-source.test.mjs`
Expected: `ℹ pass 3`, `ℹ fail 0`.

- [x] **Step 5: Commit**

```bash
git add scripts/lib/profile-source.mjs scripts/lib/profile-source.test.mjs
git commit -m "feat(lore): pure raw profile source normalizer"
```

### Task 2: Legacy workbook VI matcher + read-only reader

**Files:**
- Create: `scripts/read_profile_legacy_vi.py`, `scripts/lib/profile-legacy.mjs`
- Test: `scripts/lib/profile-legacy.test.mjs`

**Interfaces:**
- Consumes: `NormalizedProfile` (Task 1).
- Produces: `matchLegacyCells(rows, profiles) → { seeds: [{characterId, unitKey, vi, sourceChanged}], ignored: [{profileId, reason}] }`; rows are `{profile_id, character_id, category, text_cn, text_vi}` from the reader.

- [x] **Step 1: Write the failing test**

```js
// scripts/lib/profile-legacy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchLegacyCells } from './profile-legacy.mjs';

const profiles = [{
  characterId: 'A0144',
  structure: { reports: [{ fileId: 'A014401', kind: 'basic' }, { fileId: 'A014402', kind: 'basic' }] },
  units: [
    { unitKey: 'card_intro', sourceCn: '介绍' },
    { unitKey: 'report.A014401.title', sourceCn: '观察报告1' },
    { unitKey: 'report.A014402.content', sourceCn: '内容2' },
    { unitKey: 'relic_intro', sourceCn: '本源' },
  ],
}];
const row = (profile_id, category, text_cn, text_vi) => ({ profile_id, character_id: 'A0144', category, text_cn, text_vi });

test('maps the four text categories and skips status/code rows', () => {
  const out = matchLegacyCells([
    row('A0144_intro', 'card_intro', '介绍', 'Giới thiệu'),
    row('A0144_report_title_1', 'report_title', '观察报告1', 'Báo cáo 1'),
    row('A0144_report_content_2', 'report_content', '内容2-旧', 'Nội dung 2'),
    row('A0144_relic_intro', 'relic_intro', '本源', 'Bản nguyên'),
    row('A0144_staff', 'staff_status', '已登记', 'Đã đăng ký'),
    row('A0144_relic_name', 'relic_name', 'K1028', 'K1028'),
    row('A0144_report_title_3', 'report_title', '观察报告3', 'Báo cáo 3'),
  ], profiles);
  assert.deepEqual(out.seeds, [
    { characterId: 'A0144', unitKey: 'card_intro', vi: 'Giới thiệu', sourceChanged: false },
    { characterId: 'A0144', unitKey: 'report.A014401.title', vi: 'Báo cáo 1', sourceChanged: false },
    { characterId: 'A0144', unitKey: 'report.A014402.content', vi: 'Nội dung 2', sourceChanged: true },
    { characterId: 'A0144', unitKey: 'relic_intro', vi: 'Bản nguyên', sourceChanged: false },
  ]);
  assert.deepEqual(out.ignored.map((i) => i.reason), ['code_map_category', 'raw_code_copy', 'no_matching_unit']);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/profile-legacy.test.mjs`
Expected: FAIL, module not found.

- [x] **Step 3: Write minimal implementation**

```js
// scripts/lib/profile-legacy.mjs
// Pure: legacy workbook PROFILE VI -> seeds for empty DB cells (spec §4 table).
const CODE_MAP = new Set(['staff_status', 'entity_status']);
const RAW_CODE = new Set(['relic_name', 'relic_dynasty', 'relic_museum']);

function unitKeyFor(row, profile) {
  if (row.category === 'card_intro') return 'card_intro';
  if (row.category === 'relic_intro') return 'relic_intro';
  const match = /_(\d+)$/.exec(row.profile_id);
  if (!match) return null;
  const report = profile.structure.reports.filter((r) => r.kind === 'basic')[Number(match[1]) - 1];
  if (!report) return null;
  return `report.${report.fileId}.${row.category === 'report_title' ? 'title' : 'content'}`;
}

export function matchLegacyCells(rows, profiles) {
  const byId = new Map(profiles.map((p) => [p.characterId, p]));
  const seeds = [];
  const ignored = [];
  for (const row of rows) {
    const vi = String(row.text_vi ?? '').trim();
    if (!vi) continue;
    if (CODE_MAP.has(row.category)) { ignored.push({ profileId: row.profile_id, reason: 'code_map_category' }); continue; }
    if (RAW_CODE.has(row.category)) { ignored.push({ profileId: row.profile_id, reason: 'raw_code_copy' }); continue; }
    const profile = byId.get(row.character_id);
    const unitKey = profile && unitKeyFor(row, profile);
    const unit = unitKey && profile.units.find((u) => u.unitKey === unitKey);
    if (!unit) { ignored.push({ profileId: row.profile_id, reason: 'no_matching_unit' }); continue; }
    seeds.push({ characterId: row.character_id, unitKey, vi, sourceChanged: String(row.text_cn ?? '').trim() !== unit.sourceCn });
  }
  return { seeds, ignored };
}
```

```python
# scripts/read_profile_legacy_vi.py
"""Read the workbook PROFILE sheet (read-only) and print rows with a VI cell as JSON.

Never writes the workbook. Used only by import-character-profile.mjs --seed-legacy-workbook.
"""
from __future__ import annotations

import argparse
import json
import sys

from openpyxl import load_workbook

sys.stdout.reconfigure(encoding="utf-8")
COLUMNS = ["profile_id", "character_id", "category", "text_cn", "text_vi"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", required=True)
    args = parser.parse_args()
    workbook = load_workbook(args.workbook, read_only=True, data_only=True)
    rows = workbook["PROFILE"].iter_rows(values_only=True)
    header = list(next(rows))
    missing = [name for name in COLUMNS if name not in header]
    if missing:
        raise SystemExit(f"PROFILE sheet is missing columns: {missing}")
    out = []
    for values in rows:
        record = dict(zip(header, values))
        if str(record.get("text_vi") or "").strip():
            out.append({name: (None if record.get(name) is None else str(record[name])) for name in COLUMNS})
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [x] **Step 4: Run tests and the reader**

Run: `node --test scripts/lib/profile-legacy.test.mjs` → Expected `ℹ pass 1`.
Run: `python scripts/read_profile_legacy_vi.py --workbook localization/localization_master.xlsx | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);const c={};r.forEach(x=>c[x.category]=(c[x.category]||0)+1);console.log(r.length,c)})"`
Expected: `195` rows; `card_intro 15, relic_intro 15, report_title 60, report_content 60, staff_status 15, entity_status 15, relic_name 5, relic_dynasty 5, relic_museum 5`. Then `git status --short localization/localization_master.xlsx` shows the same state as before (the reader never writes).

- [x] **Step 5: Commit**

```bash
git add scripts/lib/profile-legacy.mjs scripts/lib/profile-legacy.test.mjs scripts/read_profile_legacy_vi.py
git commit -m "feat(lore): legacy PROFILE VI matcher and read-only reader"
```

### Task 3: Import planner (pure diff)

**Files:**
- Create: `scripts/lib/profile-import-plan.mjs`
- Test: `scripts/lib/profile-import-plan.test.mjs`

**Interfaces:**
- Consumes: Task 1 output.
- Produces: `planProfileImport({ normalized, current }) → Plan` where
  - `current = { profiles: Map<characterId, {entityId, sourceHash, sourcePresent}>, texts: Map<"characterId|unitKey", {id, sourceCn, sourceHash, vi, state, sourcePresent}>, terms: Map<code, {entityId, sourceHash, nameVi, detailVi, state, sourcePresent}> }`,
  - `Plan = { profiles: [{characterId, action: 'insert'|'update'|'unchanged', row}], textInserts: [{characterId, unitKey, sourceCn, sourceRef, sourceHash}], textUpdates: [{id, characterId, unitKey, patch}], terms: [{code, action, row, patch}], audits: [{scope: 'profile'|'term', key, fieldName, oldValue, newValue}], touchedProfiles: Set<characterId>, touchedTerms: Set<code>, cnChanged: boolean, counts: {inserted, updated, unchanged, conflicted, absent} }`.

- [x] **Step 1: Write the failing test**

```js
// scripts/lib/profile-import-plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planProfileImport } from './profile-import-plan.mjs';

const profile = (units) => ({ characterId: 'V0053', recordId: 'r', sourceHash: 'P1', structure: { reports: [], timeline: [] }, units });
const u = (unitKey, sourceCn) => ({ unitKey, sourceCn, sourceRef: `ref:${unitKey}`, sourceHash: `h:${sourceCn}` });
const term = { code: 'K1001', kind: 'relic_type', nameCn: '玉器', detailCn: '', sourceHash: 'T1' };
const empty = () => ({ profiles: new Map(), texts: new Map(), terms: new Map() });

test('first import inserts everything', () => {
  const plan = planProfileImport({ normalized: { profiles: [profile([u('card_intro', 'A')])], terms: [term] }, current: empty() });
  assert.equal(plan.profiles[0].action, 'insert');
  assert.equal(plan.textInserts.length, 1);
  assert.equal(plan.terms[0].action, 'insert');
  assert.equal(plan.cnChanged, false);
});

test('re-running identical inputs changes nothing', () => {
  const current = empty();
  current.profiles.set('V0053', { entityId: 'e1', sourceHash: 'P1', sourcePresent: true });
  current.texts.set('V0053|card_intro', { id: 't1', sourceCn: 'A', sourceHash: 'h:A', vi: null, state: 'ok', sourcePresent: true });
  current.terms.set('K1001', { entityId: 'e2', sourceHash: 'T1', nameVi: null, detailVi: null, state: 'ok', sourcePresent: true });
  const plan = planProfileImport({ normalized: { profiles: [profile([u('card_intro', 'A')])], terms: [term] }, current });
  assert.equal(plan.textInserts.length + plan.textUpdates.length + plan.audits.length, 0);
  assert.equal(plan.profiles[0].action, 'unchanged');
  assert.equal(plan.counts.unchanged, 3);
});

test('CN change under VI keeps VI, flags source_changed and audits', () => {
  const current = empty();
  current.profiles.set('V0053', { entityId: 'e1', sourceHash: 'P1', sourcePresent: true });
  current.texts.set('V0053|card_intro', { id: 't1', sourceCn: 'A', sourceHash: 'h:A', vi: 'Việt', state: 'ok', sourcePresent: true });
  const plan = planProfileImport({ normalized: { profiles: [profile([u('card_intro', 'B')])], terms: [] }, current });
  assert.deepEqual(plan.textUpdates[0].patch, { sourceCn: 'B', sourceRef: 'ref:card_intro', sourceHash: 'h:B', sourcePresent: true, state: 'source_changed' });
  assert.equal(plan.audits[0].fieldName, 'card_intro');
  assert.equal(plan.counts.conflicted, 1);
  assert.equal(plan.cnChanged, true);
  assert.ok(plan.touchedProfiles.has('V0053'));
});

test('a unit missing from raw is marked absent, never deleted', () => {
  const current = empty();
  current.profiles.set('V0053', { entityId: 'e1', sourceHash: 'P1', sourcePresent: true });
  current.texts.set('V0053|timeline.A.story', { id: 't9', sourceCn: 'X', sourceHash: 'h:X', vi: 'Y', state: 'ok', sourcePresent: true });
  const plan = planProfileImport({ normalized: { profiles: [profile([])], terms: [] }, current });
  assert.deepEqual(plan.textUpdates, [{ id: 't9', characterId: 'V0053', unitKey: 'timeline.A.story', patch: { sourcePresent: false } }]);
  assert.equal(plan.counts.absent, 1);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/profile-import-plan.test.mjs`
Expected: FAIL, module not found.

- [x] **Step 3: Write minimal implementation**

```js
// scripts/lib/profile-import-plan.mjs
// Pure: what the importer must write. Never deletes; VI is never touched here.
export function planProfileImport({ normalized, current }) {
  const counts = { inserted: 0, updated: 0, unchanged: 0, conflicted: 0, absent: 0 };
  const plan = { profiles: [], textInserts: [], textUpdates: [], terms: [], audits: [], touchedProfiles: new Set(), touchedTerms: new Set(), cnChanged: false, counts };

  for (const profile of normalized.profiles) {
    const { units, ...row } = profile;
    const existing = current.profiles.get(profile.characterId);
    const action = !existing ? 'insert' : existing.sourceHash !== profile.sourceHash || !existing.sourcePresent ? 'update' : 'unchanged';
    plan.profiles.push({ characterId: profile.characterId, action, row });
    counts[action === 'insert' ? 'inserted' : action === 'update' ? 'updated' : 'unchanged'] += 1;
    if (action !== 'unchanged') plan.touchedProfiles.add(profile.characterId);

    const seen = new Set();
    for (const unit of units) {
      const key = `${profile.characterId}|${unit.unitKey}`;
      seen.add(key);
      const old = current.texts.get(key);
      if (!old) {
        plan.textInserts.push({ characterId: profile.characterId, ...unit });
        counts.inserted += 1;
        plan.touchedProfiles.add(profile.characterId);
        continue;
      }
      if (old.sourceHash === unit.sourceHash && old.sourcePresent) { counts.unchanged += 1; continue; }
      const patch = { sourceCn: unit.sourceCn, sourceRef: unit.sourceRef, sourceHash: unit.sourceHash, sourcePresent: true };
      if (old.sourceHash !== unit.sourceHash) {
        plan.cnChanged = true;
        if (old.vi !== null) { patch.state = 'source_changed'; counts.conflicted += 1; } else counts.updated += 1;
        plan.audits.push({ scope: 'profile', key: profile.characterId, fieldName: unit.unitKey, oldValue: { sourceCn: old.sourceCn }, newValue: { sourceCn: unit.sourceCn } });
      } else counts.updated += 1;
      plan.textUpdates.push({ id: old.id, characterId: profile.characterId, unitKey: unit.unitKey, patch });
      plan.touchedProfiles.add(profile.characterId);
    }
    for (const [key, old] of current.texts) {
      if (!key.startsWith(`${profile.characterId}|`) || seen.has(key) || !old.sourcePresent) continue;
      plan.textUpdates.push({ id: old.id, characterId: profile.characterId, unitKey: key.split('|')[1], patch: { sourcePresent: false } });
      counts.absent += 1;
      plan.touchedProfiles.add(profile.characterId);
    }
  }

  for (const term of normalized.terms) {
    const old = current.terms.get(term.code);
    if (!old) { plan.terms.push({ code: term.code, action: 'insert', row: term }); counts.inserted += 1; plan.touchedTerms.add(term.code); continue; }
    if (old.sourceHash === term.sourceHash && old.sourcePresent) { plan.terms.push({ code: term.code, action: 'unchanged' }); counts.unchanged += 1; continue; }
    const patch = { kind: term.kind, nameCn: term.nameCn, detailCn: term.detailCn, sourceHash: term.sourceHash, sourcePresent: true };
    if (old.sourceHash !== term.sourceHash) {
      plan.cnChanged = true;
      if (old.nameVi !== null || old.detailVi !== null) { patch.state = 'source_changed'; counts.conflicted += 1; } else counts.updated += 1;
      plan.audits.push({ scope: 'term', key: term.code, fieldName: 'name_detail', oldValue: { sourceHash: old.sourceHash }, newValue: { nameCn: term.nameCn, detailCn: term.detailCn } });
    } else counts.updated += 1;
    plan.terms.push({ code: term.code, action: 'update', patch });
    plan.touchedTerms.add(term.code);
  }
  return plan;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/profile-import-plan.test.mjs`
Expected: `ℹ pass 4`.

- [x] **Step 5: Commit**

```bash
git add scripts/lib/profile-import-plan.mjs scripts/lib/profile-import-plan.test.mjs
git commit -m "feat(lore): pure import planner (idempotent, never deletes, flags source_changed)"
```

### Task 4: Drizzle schema + migration file (no apply)

**Files:**
- Modify: `db/schema/core.mjs:22-27` (enum values), `db/schema/index.mjs`
- Create: `db/schema/profile.mjs`
- Generated: `db/migrations/0005_*.sql`, `db/migrations/meta/*`

**Interfaces:**
- Produces (Drizzle tables): `characterProfiles`, `profileTexts`, `loreTerms`, `lorePublishState`; enums `viOrigin`, `loreTextState`, `loreTermKind`. Column names below are what every later task uses.

- [x] **Step 1: Extend the entity enum**

In `db/schema/core.mjs` change the `managedEntityType` values to:

```js
export const managedEntityType = pgEnum('managed_entity_type', [
  'character',
  'skin',
  'series',
  'preview_character',
  'character_profile',
  'lore_term',
]);
```

- [x] **Step 2: Write the schema**

```js
// db/schema/profile.mjs
import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth.mjs';
import { characters } from './character-skin.mjs';
import { managedEntities, sourceSnapshots } from './core.mjs';

export const viOrigin = pgEnum('vi_origin', ['legacy_workbook', 'admin']);
export const loreTextState = pgEnum('lore_text_state', ['ok', 'source_changed']);
export const loreTermKind = pgEnum('lore_term_kind', ['relic_type', 'era', 'museum', 'era_range', 'affinity_level', 'organisation']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const characterProfiles = pgTable('character_profiles', {
  entityId: uuid('entity_id').primaryKey().references(() => managedEntities.id, { onDelete: 'restrict' }),
  characterEntityId: uuid('character_entity_id').notNull().references(() => characters.entityId, { onDelete: 'restrict' }),
  recordId: text('record_id').notNull().default(''),
  staffStatusCn: text('staff_status_cn').notNull().default(''),
  storeStatusCn: text('store_status_cn').notNull().default(''),
  organisationCode: text('organisation_code'),
  relicTypeCode: text('relic_type_code'),
  eraCode: text('era_code'),
  museumCode: text('museum_code'),
  eraRangeCode: text('era_range_code'),
  legacyRelicFields: jsonb('legacy_relic_fields').notNull(),
  structure: jsonb('structure').notNull(),
  sourceSnapshotId: uuid('source_snapshot_id').notNull().references(() => sourceSnapshots.id, { onDelete: 'restrict' }),
  sourceHash: text('source_hash').notNull(),
  sourcePresent: boolean('source_present').notNull().default(true),
  sourceSeenAt: timestamp('source_seen_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (table) => [uniqueIndex('character_profiles_character_unique').on(table.characterEntityId)]);

const viColumns = {
  viOrigin: viOrigin('vi_origin'),
  state: loreTextState('state').notNull().default('ok'),
  viUpdatedByUserId: uuid('vi_updated_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  viUpdatedAt: timestamp('vi_updated_at', { withTimezone: true }),
  sourceHash: text('source_hash').notNull(),
  sourcePresent: boolean('source_present').notNull().default(true),
};

export const profileTexts = pgTable('profile_texts', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileEntityId: uuid('profile_entity_id').notNull().references(() => characterProfiles.entityId, { onDelete: 'restrict' }),
  unitKey: text('unit_key').notNull(),
  sourceCn: text('source_cn').notNull(),
  sourceRef: text('source_ref').notNull(),
  vi: text('vi'),
  ...viColumns,
  ...timestamps,
}, (table) => [
  uniqueIndex('profile_texts_profile_unit_unique').on(table.profileEntityId, table.unitKey),
  index('profile_texts_state_idx').on(table.state),
  check('profile_texts_vi_origin_pairing', sql`(${table.vi} is null) = (${table.viOrigin} is null)`),
]);

export const loreTerms = pgTable('lore_terms', {
  entityId: uuid('entity_id').primaryKey().references(() => managedEntities.id, { onDelete: 'restrict' }),
  code: text('code').notNull(),
  kind: loreTermKind('kind').notNull(),
  nameCn: text('name_cn').notNull(),
  detailCn: text('detail_cn').notNull().default(''),
  nameVi: text('name_vi'),
  detailVi: text('detail_vi'),
  ...viColumns,
  ...timestamps,
}, (table) => [
  uniqueIndex('lore_terms_code_unique').on(table.code),
  check('lore_terms_vi_origin_pairing', sql`(${table.nameVi} is null and ${table.detailVi} is null) = (${table.viOrigin} is null)`),
]);

export const lorePublishState = pgTable('lore_publish_state', {
  id: smallint('id').primaryKey().default(1),
  publishedFile: text('published_file'),
  publishedHash: text('published_hash'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedByUserId: uuid('published_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  lastEditAt: timestamp('last_edit_at', { withTimezone: true }),
}, (table) => [check('lore_publish_state_single_row', sql`${table.id} = 1`)]);

export const lorePublishLockKey = 7_319_024; // pg advisory lock key for publishLore (any stable bigint)
```

Append to `db/schema/index.mjs`:

```js
export * from './profile.mjs';
```

- [x] **Step 3: Verify the schema loads**

Run: `node -e "import('./db/schema/index.mjs').then(s=>console.log(Object.keys(s).filter(k=>/profile|lore|viOrigin/i.test(k))))"`
Expected: lists `characterProfiles`, `profileTexts`, `loreTerms`, `lorePublishState`, `lorePublishLockKey`, `viOrigin`, `loreTextState`, `loreTermKind`.

- [x] **Step 4: Generate the migration (one npm command, background)**

Run: `npm run db:generate` (background).
Expected: a new `db/migrations/0005_<name>.sql` containing `ALTER TYPE "public"."managed_entity_type" ADD VALUE 'character_profile'`, `... ADD VALUE 'lore_term'`, `CREATE TYPE "public"."vi_origin"`, `CREATE TABLE "character_profiles"`, `"profile_texts"`, `"lore_terms"`, `"lore_publish_state"`, the two CHECKs, and **no** `DROP` statement. If it contains any `DROP` or touches existing tables other than the enum, stop and report.

- [x] **Step 5: Commit (migration not applied)**

```bash
git add db/schema/core.mjs db/schema/profile.mjs db/schema/index.mjs db/migrations/
git commit -m "feat(lore): profile/lore schema and migration 0005 (not applied)"
```

### Task 5: Importer CLI (`--check`, plan, `--apply`, `--seed-legacy-workbook`)

**Files:**
- Create: `scripts/import-character-profile.mjs`

**Interfaces:**
- Consumes: `normalizeProfileSources`, `hashValue` (Task 1), `matchLegacyCells` (Task 2), `planProfileImport` (Task 3), schema (Task 4).
- Produces: CLI. Default mode is a **read-only plan**; only `--apply` writes.

- [x] **Step 1: Write the CLI**

```js
// scripts/import-character-profile.mjs
// Profile/lore importer. Default: read-only plan. --apply writes (owner approval required).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq, inArray, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import { characters } from '../db/schema/character-skin.mjs';
import { editHistory, importRuns, managedEntities, sourceSnapshots } from '../db/schema/core.mjs';
import { characterProfiles, lorePublishState, loreTerms, profileTexts } from '../db/schema/profile.mjs';
import { matchLegacyCells } from './lib/profile-legacy.mjs';
import { planProfileImport } from './lib/profile-import-plan.mjs';
import { hashValue, normalizeProfileSources, sha256 } from './lib/profile-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = resolve(ROOT, '..', 'NeoArtifacts', 'MasterData', 'json');
const SOURCES = {
  characterFiles: 'characterFiles.json', characterFileTextMap: 'characterFileTextMap.json',
  historicalRelicsMap: 'historicalRelicsMap.json', historicalTextMap: 'HistoricalTextMap.json',
  friendshipDescription: 'friendshipDescription.json', characterTable: 'characterTable.json', typeJJHMap: 'TypeJJHMap.json',
};

function loadRaw(masterRoot) {
  const raw = {};
  const files = [];
  for (const [key, name] of Object.entries(SOURCES)) {
    const buffer = readFileSync(join(masterRoot, name));
    raw[key] = JSON.parse(buffer.toString('utf8'));
    files.push({ path: `NeoArtifacts/MasterData/json/${name}`, sha256: sha256(buffer) });
  }
  return { raw, receipt: { sourceKind: 'masterdata', sourceVersion: 'character-profile-masterdata-v1', contentHash: hashValue(files), sourcePath: 'NeoArtifacts/MasterData/json', manifest: { files } } };
}

function readLegacyRows(workbook) {
  const out = execFileSync('python', [join(ROOT, 'scripts', 'read_profile_legacy_vi.py'), '--workbook', workbook], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  return JSON.parse(out);
}

async function loadCurrent(db) {
  const profileRows = await db.select({ characterId: characters.characterId, entityId: characterProfiles.entityId, sourceHash: characterProfiles.sourceHash, sourcePresent: characterProfiles.sourcePresent })
    .from(characterProfiles).innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId));
  const byEntity = new Map(profileRows.map((r) => [r.entityId, r.characterId]));
  const textRows = await db.select().from(profileTexts);
  const termRows = await db.select().from(loreTerms);
  return {
    profiles: new Map(profileRows.map((r) => [r.characterId, r])),
    texts: new Map(textRows.map((r) => [`${byEntity.get(r.profileEntityId)}|${r.unitKey}`, r])),
    terms: new Map(termRows.map((r) => [r.code, r])),
  };
}

function summarize(plan, normalized, seeds) {
  return {
    counts: plan.counts,
    skippedRawCharacters: normalized.skipped,
    profiles: plan.profiles.filter((p) => p.action !== 'unchanged').map((p) => `${p.action} ${p.characterId}`),
    textInserts: plan.textInserts.length,
    textUpdates: plan.textUpdates.map((u) => `${u.characterId} ${u.unitKey} ${JSON.stringify(u.patch.state ?? (u.patch.sourcePresent === false ? 'absent' : 'source'))}`),
    terms: plan.terms.filter((t) => t.action !== 'unchanged').map((t) => `${t.action} ${t.code}`),
    legacySeeds: seeds ? seeds.map((s) => `${s.characterId} ${s.unitKey}${s.sourceChanged ? ' (source_changed)' : ''}`) : undefined,
  };
}

async function ensureEntities(tx, entityType, keys) {
  if (keys.length) await tx.insert(managedEntities).values(keys.map((sourceKey) => ({ entityType, sourceKey }))).onConflictDoNothing();
  const rows = keys.length ? await tx.select().from(managedEntities).where(inArray(managedEntities.sourceKey, keys)) : [];
  return new Map(rows.filter((r) => r.entityType === entityType).map((r) => [r.sourceKey, r.id]));
}

async function apply(db, { plan, receipt, seeds }) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [existingSnap] = await tx.select().from(sourceSnapshots).where(sql`${sourceSnapshots.sourceKind} = ${receipt.sourceKind} and ${sourceSnapshots.sourceVersion} = ${receipt.sourceVersion} and ${sourceSnapshots.contentHash} = ${receipt.contentHash}`);
    const snapshot = existingSnap ?? (await tx.insert(sourceSnapshots).values(receipt).returning())[0];
    const [run] = await tx.insert(importRuns).values({ sourceSnapshotId: snapshot.id, status: 'started', counts: {} }).returning();

    const characterRows = await tx.select({ entityId: characters.entityId, characterId: characters.characterId }).from(characters);
    const characterEntity = new Map(characterRows.map((r) => [r.characterId, r.entityId]));
    const profileEntity = await ensureEntities(tx, 'character_profile', plan.profiles.map((p) => p.characterId));
    const termEntity = await ensureEntities(tx, 'lore_term', plan.terms.map((t) => t.code));

    for (const p of plan.profiles) {
      if (p.action === 'unchanged') continue;
      const { characterId, ...row } = p.row;
      const values = { ...row, characterEntityId: characterEntity.get(characterId), sourceSnapshotId: snapshot.id, sourcePresent: true, sourceSeenAt: now, updatedAt: now };
      if (p.action === 'insert') await tx.insert(characterProfiles).values({ entityId: profileEntity.get(characterId), ...values });
      else await tx.update(characterProfiles).set(values).where(eq(characterProfiles.entityId, profileEntity.get(characterId)));
    }
    if (plan.textInserts.length) {
      await tx.insert(profileTexts).values(plan.textInserts.map(({ characterId, unitKey, sourceCn, sourceRef, sourceHash }) => ({ profileEntityId: profileEntity.get(characterId), unitKey, sourceCn, sourceRef, sourceHash })));
    }
    for (const u of plan.textUpdates) await tx.update(profileTexts).set({ ...u.patch, updatedAt: now }).where(eq(profileTexts.id, u.id));
    for (const t of plan.terms) {
      if (t.action === 'insert') await tx.insert(loreTerms).values({ entityId: termEntity.get(t.code), code: t.code, kind: t.row.kind, nameCn: t.row.nameCn, detailCn: t.row.detailCn, sourceHash: t.row.sourceHash });
      if (t.action === 'update') await tx.update(loreTerms).set({ ...t.patch, updatedAt: now }).where(eq(loreTerms.code, t.code));
    }

    const touched = new Set(plan.touchedProfiles);
    for (const seed of seeds ?? []) {
      const entityId = profileEntity.get(seed.characterId);
      const updated = await tx.update(profileTexts)
        .set({ vi: seed.vi, viOrigin: 'legacy_workbook', state: seed.sourceChanged ? 'source_changed' : 'ok', viUpdatedAt: now, updatedAt: now })
        .where(sql`${profileTexts.profileEntityId} = ${entityId} and ${profileTexts.unitKey} = ${seed.unitKey} and ${profileTexts.vi} is null`).returning({ id: profileTexts.id });
      if (updated.length) {
        touched.add(seed.characterId);
        plan.audits.push({ scope: 'profile', key: seed.characterId, fieldName: seed.unitKey, oldValue: null, newValue: { vi: seed.vi, viOrigin: 'legacy_workbook' }, metadata: { legacySeed: true } });
      }
    }

    const audits = plan.audits.map((a) => ({
      changeGroupId: run.id, requestId: run.id, importRunId: run.id, eventType: 'source_import',
      entityId: a.scope === 'profile' ? profileEntity.get(a.key) : termEntity.get(a.key),
      entityType: a.scope === 'profile' ? 'character_profile' : 'lore_term',
      fieldName: a.fieldName, oldValue: a.oldValue, newValue: a.newValue, metadata: a.metadata ?? {},
    }));
    if (audits.length) await tx.insert(editHistory).values(audits);

    const bumpIds = [...[...touched].map((id) => profileEntity.get(id)), ...[...plan.touchedTerms].map((code) => termEntity.get(code))];
    if (bumpIds.length) await tx.update(managedEntities).set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now }).where(inArray(managedEntities.id, bumpIds));
    if (plan.cnChanged || (seeds ?? []).length) {
      await tx.insert(lorePublishState).values({ id: 1, lastEditAt: now }).onConflictDoUpdate({ target: lorePublishState.id, set: { lastEditAt: now } });
    }
    const status = plan.counts.conflicted ? 'completed_with_conflicts' : 'completed';
    await tx.update(importRuns).set({ status, finishedAt: new Date(), counts: plan.counts }).where(eq(importRuns.id, run.id));
    return { importRunId: run.id, status, counts: plan.counts };
  });
}

function parseArgs(argv) {
  const args = { masterRoot: MASTER, workbook: join(ROOT, 'localization', 'localization_master.xlsx'), dataJson: join(ROOT, 'public', 'data.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--apply') args.apply = true;
    else if (a === '--seed-legacy-workbook') args.seedLegacy = true;
    else if (a === '--master-root') args.masterRoot = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const { raw, receipt } = loadRaw(args.masterRoot);
    if (args.check) {
      // --check: never opens a DB connection; data.json's character IDs stand in for the DB roster.
      const ids = Object.keys(JSON.parse(readFileSync(args.dataJson, 'utf8')).characters);
      const normalized = normalizeProfileSources(raw, ids);
      const legacy = args.seedLegacy ? matchLegacyCells(readLegacyRows(args.workbook), normalized.profiles) : null;
      console.log(JSON.stringify({ check: 'ok', characters: normalized.profiles.length, units: normalized.profiles.reduce((n, p) => n + p.units.length, 0), terms: normalized.terms.length, skipped: normalized.skipped, legacySeeds: legacy?.seeds.length, legacyIgnored: legacy?.ignored.length }));
    } else {
      const db = getDb();
      const ids = (await db.select({ id: characters.characterId }).from(characters)).map((r) => r.id);
      const normalized = normalizeProfileSources(raw, ids);
      const plan = planProfileImport({ normalized, current: await loadCurrent(db) });
      const seeds = args.seedLegacy ? matchLegacyCells(readLegacyRows(args.workbook), normalized.profiles).seeds : null;
      if (!args.apply) console.log(JSON.stringify({ mode: 'plan (read-only, nothing written)', ...summarize(plan, normalized, seeds) }, null, 2));
      else console.log(JSON.stringify(await apply(db, { plan, receipt, seeds })));
    }
  } catch (error) {
    console.error(`PROFILE_IMPORT_FAILED: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
```

- [x] **Step 2: Run `--check` (no DB)**

Run: `node scripts/import-character-profile.mjs --check --seed-legacy-workbook`
Expected: `{"check":"ok","characters":133,...,"skipped":["W0021"],"legacySeeds":150,"legacyIgnored":45}`. If `legacySeeds` is not 150, print the `ignored` list with reason `no_matching_unit` and stop to report — do not guess a mapping.

- [x] **Step 3: Commit**

```bash
git add scripts/import-character-profile.mjs
git commit -m "feat(lore): profile importer CLI (read-only plan by default, --apply writes)"
```

- [x] **Step 4: OWNER GATE — apply migration 0005**

Show the owner the full `db/migrations/0005_*.sql`. After an explicit yes, run (background): `npm run db:migrate -- --target=development`. Expected: `MIGRATION_CHAIN_OK target=development`. Then update the pipeline plan (P1: migration applied) and commit the plan file.

- [x] **Step 5: OWNER GATE — first import**

Run the read-only plan: `node --env-file=.env --env-file=.env.local scripts/import-character-profile.mjs`. Expected: 133 `insert` profiles, about 1,700–2,000 text inserts, the referenced terms (10 organisations, 10 affinity levels, K/T/S/P codes), `skippedRawCharacters: ["W0021"]`. Show the owner the counts and the term list; after a yes run the same command with `--apply`. Run the plan again: every row must be `unchanged` (idempotency). Update the plan file and commit it.

- [x] **Step 6: OWNER GATE — legacy seed**

Run `node --env-file=.env --env-file=.env.local scripts/import-character-profile.mjs --seed-legacy-workbook` (plan). Show the owner the 150 `legacySeeds` lines. After a yes, rerun with `--apply`. Then plan again with the flag: zero new seeds (they only fill empty cells).

- [x] **Step 7: CN-change check on the real DB (read-only)**

```bash
S=D:/BaiTapCode/WHMX/_claude_scratch/md && mkdir -p $S && cp ../NeoArtifacts/MasterData/json/{characterFiles,characterFileTextMap,historicalRelicsMap,HistoricalTextMap,friendshipDescription,characterTable,TypeJJHMap}.json $S/
node -e "const f='D:/BaiTapCode/WHMX/_claude_scratch/md/characterFiles.json';const fs=require('fs');const d=JSON.parse(fs.readFileSync(f,'utf8'));d.A0144.cardIntrolanText+='改';fs.writeFileSync(f,JSON.stringify(d))"
node --env-file=.env --env-file=.env.local scripts/import-character-profile.mjs --master-root $S
```
Expected (plan only, nothing written): exactly one `textUpdates` line, `A0144 card_intro "source_changed"` (A0144's intro has seeded legacy VI), `counts.conflicted: 1`. Delete `$S` afterwards. Update the plan file (P1 ✅) and commit it.

---

## Phase P2 — resolver + parity

### Task 6: Code maps + pure profile shaper

**Files:**
- Create: `server/profile/profile-code-maps.mjs`, `server/profile/shape-character-profile.mjs`
- Test: `server/profile/shape-character-profile.test.mjs`

**Interfaces:**
- Produces: `shapeCharacterProfile(entry, terms, { shape }) → object` where `entry = { profile: characterProfiles row, texts: Map<unitKey, profileTexts row (sourcePresent only)> }`, `terms = Map<code, loreTerms row>`, `shape ∈ {'legacy','v2'}`.
- Produces: `publishableVi(row, field = 'vi') → string|null` (only `viOrigin === 'admin' && state === 'ok'`).

- [x] **Step 1: Write the failing test**

```js
// server/profile/shape-character-profile.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeCharacterProfile } from './shape-character-profile.mjs';

const t = (sourceCn, vi = null, viOrigin = null, state = 'ok') => ({ sourceCn, vi, viOrigin, state });
const term = (nameCn, nameVi = null, viOrigin = null, state = 'ok') => ({ nameCn, nameVi, viOrigin, state });
const profile = {
  recordId: '1-131-100', staffStatusCn: '已登记', storeStatusCn: '安全', organisationCode: '2',
  relicTypeCode: 'K1001', eraCode: 'T2005', museumCode: 'S3059', eraRangeCode: 'P8002',
  legacyRelicFields: { hasEntry: true, relicName: 'K1001', dynasty: 'T2005', museum: 'S3059' },
  structure: {
    reports: [
      { fileId: 'V005301', kind: 'basic', unlock: { type: 2, elementId: '1' } },
      { fileId: 'V005302', kind: 'basic', unlock: { type: 2, elementId: '5' } },
      { fileId: 'V005305', kind: 'special', unlock: { type: 3, elementId: 'M700011' } },
    ],
    timeline: ['A'],
  },
};
const texts = new Map([
  ['card_intro', t('介绍', 'Giới thiệu', 'admin')],
  ['report.V005301.title', t('报告1', 'Báo cáo 1', 'legacy_workbook')],
  ['report.V005301.content', t('内容1', 'Nội dung 1', 'admin', 'source_changed')],
  ['report.V005302.title', t('报告2')],
  ['report.V005305.title', t('特别')],
  ['relic_intro', t('本源')],
  ['timeline.A.label', t('战国', 'Chiến Quốc', 'admin')],
  ['timeline.A.story', t('故事')],
]);
const terms = new Map([
  ['ORG_2', term('商业部')], ['K1001', term('玉器', 'Ngọc Khí', 'admin')], ['T2005', term('春秋战国')],
  ['S3059', term('杭州博物馆')], ['AFFINITY_1', term('感应')], ['AFFINITY_5', term('鹿鸣', 'Lộc Minh', 'admin')],
]);

test('legacy shape reproduces the old build', () => {
  assert.deepEqual(shapeCharacterProfile({ profile, texts }, terms, { shape: 'legacy' }), {
    record_id: '1-131-100', department: 'Bộ Thương Mại', staff_status: 'Đã đăng ký', entity_status: 'An toàn',
    eval_intro: '介绍',
    reports: [{ id: 'V005301', title: '报告1', content: '内容1' }, { id: 'V005302', title: '报告2', content: '' }],
    relic_info: { relic_name: 'K1001', dynasty: 'T2005', museum: 'S3059', intro: '本源' },
  });
});

test('v2 shape publishes only admin+ok VI and resolves codes', () => {
  const v2 = shapeCharacterProfile({ profile, texts }, terms, { shape: 'v2' });
  assert.equal(v2.eval_intro_vi, 'Giới thiệu');
  assert.equal(v2.reports[0].title_vi, null);   // legacy_workbook is never exported
  assert.equal(v2.reports[0].content_vi, null); // source_changed is withheld
  assert.deepEqual(v2.reports.map((r) => [r.kind, r.unlock_level, r.unlock_name, r.unlock_name_vi]), [
    ['basic', 1, '感应', null], ['basic', 5, '鹿鸣', 'Lộc Minh'], ['special', null, null, null],
  ]);
  assert.deepEqual(v2.relic_info.type, { cn: '玉器', vi: 'Ngọc Khí' });
  assert.deepEqual(v2.relic_info.timeline, [{ label: '战国', label_vi: 'Chiến Quốc', story: '故事', story_vi: null }]);
  assert.ok(!JSON.stringify(v2).match(/"[KTSP]\d{4}"|V0053\d\d/), 'no raw codes or file ids');
});

test('v2 department prefers published admin VI, then the code map, then CN', () => {
  const custom = new Map(terms); custom.set('ORG_2', term('商业部', 'Bộ Thương Nghiệp', 'admin'));
  assert.equal(shapeCharacterProfile({ profile, texts }, custom, { shape: 'v2' }).department, 'Bộ Thương Nghiệp');
  const unknown = new Map(terms); unknown.set('ORG_2', term('冬谷·繁星花协会'));
  assert.equal(shapeCharacterProfile({ profile, texts }, unknown, { shape: 'v2' }).department, '冬谷·繁星花协会');
});

test('no relic entry gives an empty legacy relic_info', () => {
  const noRelic = { ...profile, legacyRelicFields: { hasEntry: false, relicName: '', dynasty: '', museum: '' } };
  assert.deepEqual(shapeCharacterProfile({ profile: noRelic, texts: new Map() }, terms, { shape: 'legacy' }).relic_info, {});
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test server/profile/shape-character-profile.test.mjs` → FAIL, module not found.

- [x] **Step 3: Write minimal implementation**

```js
// server/profile/profile-code-maps.mjs
// JS copies of the maps in tools/build_web_data.py. DEPARTMENT_VI moves into lore_terms
// once owners translate organisations in Admin (spec §5); keep both copies in sync until then.
export const DEPARTMENT_VI = Object.freeze({
  资料部: 'Bộ Tư Liệu',
  商业部: 'Bộ Thương Mại',
  技术部: 'Bộ Kỹ Thuật',
  执行部: 'Bộ Hành Chính',
  航海家联盟: 'Liên Minh Hàng Hải',
  '冬谷·航海家联盟': 'Đông Cốc · Liên Minh Hàng Hải',
  塞纳回廊: 'Hành Lang Seine',
  不列颠学会: 'Học Viện Anh Quốc',
  方塔联合会: 'Liên Minh Tháp Phương',
  繁星花协会: 'Hiệp Hội Hoa Phồn Tinh',
});
export const STAFF_STATUS_MAP = Object.freeze({ 已登记: 'Đã đăng ký', 待登记: 'Chờ đăng ký' });
export const STORE_STATUS_MAP = Object.freeze({ 安全: 'An toàn', 观察: 'Theo dõi', 特勤: 'Đặc cần' });
```

(Before writing this file, copy the current values from `DEPARTMENT_VI`, `STAFF_STATUS_MAP`, `STORE_STATUS_MAP` in `tools/build_web_data.py`; if the owner has renamed any organisation there by then, use the new names. Gate 1 fails on any mismatch.)

```js
// server/profile/shape-character-profile.mjs
// Pure: DB rows -> public profile. 'legacy' = today's build output; 'v2' = spec §5.
import { DEPARTMENT_VI, STAFF_STATUS_MAP, STORE_STATUS_MAP } from './profile-code-maps.mjs';

export function publishableVi(row, field = 'vi') {
  return row && row.viOrigin === 'admin' && row.state === 'ok' && row[field] ? row[field] : null;
}

const cnOf = (texts, key) => texts.get(key)?.sourceCn ?? '';
const viOf = (texts, key) => publishableVi(texts.get(key));
const map = (table, cn) => (Object.hasOwn(table, cn) ? table[cn] : cn);

function department(profile, terms, shape) {
  const org = profile.organisationCode ? terms.get(`ORG_${profile.organisationCode}`) : null;
  const cn = org?.nameCn ?? '';
  if (shape === 'v2') return publishableVi(org, 'nameVi') ?? map(DEPARTMENT_VI, cn);
  return map(DEPARTMENT_VI, cn);
}

function termPair(terms, code) {
  const row = code ? terms.get(code) : null;
  return { cn: row?.nameCn ?? '', vi: publishableVi(row, 'nameVi') };
}

export function shapeCharacterProfile({ profile, texts }, terms, { shape }) {
  const base = {
    record_id: profile.recordId ?? '',
    department: department(profile, terms, shape),
    staff_status: map(STAFF_STATUS_MAP, profile.staffStatusCn ?? ''),
    entity_status: map(STORE_STATUS_MAP, profile.storeStatusCn ?? ''),
  };
  const reports = profile.structure.reports;

  if (shape === 'legacy') {
    const legacy = profile.legacyRelicFields;
    return {
      ...base,
      eval_intro: cnOf(texts, 'card_intro'),
      reports: reports.filter((r) => r.kind === 'basic').map((r) => ({
        id: r.fileId, title: cnOf(texts, `report.${r.fileId}.title`), content: cnOf(texts, `report.${r.fileId}.content`),
      })).filter((r) => r.title || r.content),
      relic_info: legacy.hasEntry
        ? { relic_name: legacy.relicName, dynasty: legacy.dynasty, museum: legacy.museum, intro: cnOf(texts, 'relic_intro') }
        : {},
    };
  }

  return {
    ...base,
    eval_intro: cnOf(texts, 'card_intro'),
    eval_intro_vi: viOf(texts, 'card_intro'),
    reports: reports.map((r) => {
      const level = r.kind === 'basic' && r.unlock.type === 2 ? Number(r.unlock.elementId) : null;
      const levelTerm = level === null ? null : terms.get(`AFFINITY_${level}`);
      return {
        kind: r.kind,
        title: cnOf(texts, `report.${r.fileId}.title`), title_vi: viOf(texts, `report.${r.fileId}.title`),
        content: cnOf(texts, `report.${r.fileId}.content`), content_vi: viOf(texts, `report.${r.fileId}.content`),
        unlock_level: level, unlock_name: levelTerm?.nameCn ?? null, unlock_name_vi: publishableVi(levelTerm, 'nameVi'),
      };
    }).filter((r) => r.title || r.content),
    relic_info: profile.legacyRelicFields.hasEntry ? {
      type: termPair(terms, profile.relicTypeCode),
      era: termPair(terms, profile.eraCode),
      museum: termPair(terms, profile.museumCode),
      intro: cnOf(texts, 'relic_intro'), intro_vi: viOf(texts, 'relic_intro'),
      timeline: profile.structure.timeline.map((slot) => ({
        label: cnOf(texts, `timeline.${slot}.label`), label_vi: viOf(texts, `timeline.${slot}.label`),
        story: cnOf(texts, `timeline.${slot}.story`), story_vi: viOf(texts, `timeline.${slot}.story`),
      })),
    } : {},
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test server/profile/shape-character-profile.test.mjs` → `ℹ pass 4`.

- [x] **Step 5: Commit**

```bash
git add server/profile/profile-code-maps.mjs server/profile/shape-character-profile.mjs server/profile/shape-character-profile.test.mjs
git commit -m "feat(lore): pure profile shaper (legacy + v2 shapes)"
```

### Task 7: DB resolver + overlay export + Python apply + gate checker

**Files:**
- Create: `server/profile/resolve-character-profile.mjs`, `scripts/export-profile-overlay.mjs`, `tools/apply_profile_overlay.py`, `tools/test_apply_profile_overlay.py`, `scripts/check-profile-overlay.mjs`

**Interfaces:**
- Consumes: `shapeCharacterProfile` (Task 6), schema (Task 4).
- Produces: `loadProfileContext(db) → { terms: Map, entries: Map<characterId, {profile, texts}> }`; `resolveCharacterProfile(characterId, ctx, { shape }) → object|null`; `resolveAllProfiles(ctx, { shape }) → Array<[characterId, profile]>` sorted by ID.
- Produces: `node scripts/export-profile-overlay.mjs --shape legacy|v2` → stdout JSON `{characterId: profile}`; `python tools/apply_profile_overlay.py [--in P] [--out P] < overlay.json`.

- [x] **Step 1: Write the failing Python test (key order + byte identity)**

```python
# tools/test_apply_profile_overlay.py
import json
import subprocess
import sys
import tempfile
from pathlib import Path

TOOL = Path(__file__).with_name("apply_profile_overlay.py")


def run(data: dict, overlay: dict) -> str:
    with tempfile.TemporaryDirectory(dir="D:/BaiTapCode/WHMX/_claude_scratch") as tmp:
        path = Path(tmp) / "data.json"
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        subprocess.run([sys.executable, str(TOOL), "--in", str(path), "--out", str(path)],
                       input=json.dumps(overlay, ensure_ascii=False).encode("utf-8"), check=True)
        return path.read_text(encoding="utf-8")


def test_same_profile_is_byte_identical_and_keeps_integer_key_order():
    data = {"characters": {"A0001": {"name": "x", "profile": {"record_id": "1"}, "z": 1}}, "items": {"3": 1, "1001": 2}}
    original = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    assert run(data, {"A0001": {"record_id": "1"}}) == original


def test_profile_is_replaced_in_place():
    data = {"characters": {"A0001": {"name": "x", "profile": {"record_id": "1"}, "z": 1}}}
    out = json.loads(run(data, {"A0001": {"record_id": "2", "eval_intro_vi": None}}))
    assert list(out["characters"]["A0001"]) == ["name", "profile", "z"]
    assert out["characters"]["A0001"]["profile"] == {"record_id": "2", "eval_intro_vi": None}


def test_unknown_character_fails():
    data = {"characters": {"A0001": {"profile": {}}}}
    try:
        run(data, {"Z9999": {}})
    except subprocess.CalledProcessError:
        return
    raise AssertionError("expected failure for unknown character")


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("OK")
```

- [x] **Step 2: Run it to verify it fails**

Run: `python tools/test_apply_profile_overlay.py` → FAIL (`apply_profile_overlay.py` missing).

- [x] **Step 3: Implement the four files**

```python
# tools/apply_profile_overlay.py
"""Apply a {characterId: profile} overlay (JSON on stdin) to public/data.json.

Python does the write because it preserves key order exactly (Node reorders
integer-like keys such as items["3"]). The write is atomic: temp file + os.replace.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

DEFAULT = Path(__file__).resolve().parent.parent / "public" / "data.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="src", default=str(DEFAULT))
    parser.add_argument("--out", dest="dst", default=str(DEFAULT))
    args = parser.parse_args()
    overlay = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    data = json.loads(Path(args.src).read_text(encoding="utf-8"))
    characters = data["characters"]
    unknown = sorted(set(overlay) - set(characters))
    if unknown:
        raise SystemExit(f"overlay has characters missing from data.json: {unknown}")
    for character_id, profile in overlay.items():
        characters[character_id]["profile"] = profile
    dst = Path(args.dst)
    tmp = dst.with_name(dst.name + ".overlay.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, dst)
    print(f"applied {len(overlay)} profiles; {len(characters) - len(overlay)} characters kept their build profile", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

```js
// server/profile/resolve-character-profile.mjs
// Per-entity resolver (engineering principles §2). Batch callers load one context and loop.
import { eq } from 'drizzle-orm';

import { characters } from '../../db/schema/character-skin.mjs';
import { characterProfiles, loreTerms, profileTexts } from '../../db/schema/profile.mjs';
import { shapeCharacterProfile } from './shape-character-profile.mjs';

export async function loadProfileContext(db) {
  const rows = await db.select({ characterId: characters.characterId, profile: characterProfiles })
    .from(characterProfiles).innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId))
    .where(eq(characterProfiles.sourcePresent, true));
  const entries = new Map(rows.map((r) => [r.characterId, { profile: r.profile, texts: new Map() }]));
  const byEntity = new Map(rows.map((r) => [r.profile.entityId, r.characterId]));
  for (const text of await db.select().from(profileTexts).where(eq(profileTexts.sourcePresent, true))) {
    const id = byEntity.get(text.profileEntityId);
    if (id) entries.get(id).texts.set(text.unitKey, text);
  }
  const terms = new Map((await db.select().from(loreTerms)).map((t) => [t.code, t]));
  return { entries, terms };
}

export function resolveCharacterProfile(characterId, ctx, { shape }) {
  const entry = ctx.entries.get(characterId);
  return entry ? shapeCharacterProfile(entry, ctx.terms, { shape }) : null;
}

export function resolveAllProfiles(ctx, { shape }) {
  return [...ctx.entries.keys()].sort().map((id) => [id, resolveCharacterProfile(id, ctx, { shape })]);
}
```

```js
// scripts/export-profile-overlay.mjs
// Prints {characterId: profile} for every official character. Reads the DB only.
import { closeDb, getDb } from '../db/client.mjs';
import { loadProfileContext, resolveAllProfiles } from '../server/profile/resolve-character-profile.mjs';

const shapeArg = process.argv.find((a) => a.startsWith('--shape='))?.slice(8) ?? process.argv[process.argv.indexOf('--shape') + 1];
if (!['legacy', 'v2'].includes(shapeArg)) {
  console.error('usage: export-profile-overlay.mjs --shape legacy|v2');
  process.exit(2);
}
try {
  const ctx = await loadProfileContext(getDb());
  process.stdout.write(JSON.stringify(Object.fromEntries(resolveAllProfiles(ctx, { shape: shapeArg }))));
} catch (error) {
  console.error(`OVERLAY_EXPORT_FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
```

```js
// scripts/check-profile-overlay.mjs
// Gate 2: only characters.*.profile may differ, no raw codes, list department changes.
import { readFileSync } from 'node:fs';

const [beforePath, afterPath] = process.argv.slice(2);
const before = JSON.parse(readFileSync(beforePath, 'utf8'));
const after = JSON.parse(readFileSync(afterPath, 'utf8'));
const strip = (data) => ({ ...data, characters: Object.fromEntries(Object.entries(data.characters).map(([id, c]) => [id, { ...c, profile: null }])) });
const problems = [];
if (JSON.stringify(strip(before)) !== JSON.stringify(strip(after))) problems.push('data outside characters.*.profile changed');
const codeLeaks = Object.entries(after.characters).filter(([, c]) => /"[KTSP]\d{4}"/.test(JSON.stringify(c.profile ?? {}))).map(([id]) => id);
if (codeLeaks.length) problems.push(`raw codes in profile: ${codeLeaks.join(', ')}`);
const departments = Object.keys(after.characters)
  .filter((id) => before.characters[id]?.profile?.department !== after.characters[id].profile?.department)
  .map((id) => `${id}: ${before.characters[id]?.profile?.department} -> ${after.characters[id].profile?.department}`);
console.log(JSON.stringify({ ok: problems.length === 0, problems, departmentChanges: departments }, null, 2));
process.exitCode = problems.length ? 1 : 0;
```

- [x] **Step 4: Run the Python test**

Run: `python tools/test_apply_profile_overlay.py` → `OK`.

- [x] **Step 5: Gate 1 (legacy, byte-identical) — needs P1 done**

```bash
S=/d/BaiTapCode/WHMX/_claude_scratch/gate && mkdir -p $S && cp public/data.json $S/before.json
node --env-file=.env --env-file=.env.local scripts/export-profile-overlay.mjs --shape legacy | python tools/apply_profile_overlay.py --in $S/before.json --out $S/legacy.json
cmp $S/before.json $S/legacy.json && echo GATE1_OK
```
Expected: `applied 133 profiles; 0 characters kept their build profile` and `GATE1_OK`. (`public/data.json` must equal a fresh deterministic build; if `tools/build_web_data.py` inputs changed since the last commit, rebuild first with outputs redirected to `$S`.) If it fails, locate the first difference with `D:\BaiTapCode\WHMX\_claude_scratch\dept\jdiff.py` and fix the resolver/code maps; nothing proceeds until `GATE1_OK`.

- [x] **Step 6: Gate 2 (v2)**

```bash
node --env-file=.env --env-file=.env.local scripts/export-profile-overlay.mjs --shape v2 | python tools/apply_profile_overlay.py --in $S/before.json --out $S/v2.json
node scripts/check-profile-overlay.mjs $S/before.json $S/v2.json
```
Expected: `"ok": true`, `"departmentChanges": []` (the old pipeline already uses `typeJJh`). Then copy `$S/v2.json` to `public/data.json`, run the four validators (`python tools/validate_data.py`, `validate_public_output.py`, `validate_skin_roster.py`, `validate_skin_assets.py`) and `npm run build` (background). All must pass. The public site renders only the 4 unchanged fields, so no UI check is needed beyond the character overview of one character.

- [x] **Step 7: Commit + runbook**

Add to the N2 runbook (pipeline plan §4, step 5) after `build_web_data.py`: `node --env-file=.env --env-file=.env.local scripts/export-profile-overlay.mjs --shape v2 | python tools/apply_profile_overlay.py`. Update the status table (P2 ✅) and log.

```bash
git add server/profile/resolve-character-profile.mjs scripts/export-profile-overlay.mjs scripts/check-profile-overlay.mjs tools/apply_profile_overlay.py tools/test_apply_profile_overlay.py public/data.json docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md
git commit -m "feat(lore): DB resolver, data.json profile overlay, parity gates passed"
```

---

## Phase P3 — publish to R2 + backup + frontend

### Task 8: Lore document, storage, repository, publisher

**Files:**
- Create: `server/profile/lore-document.mjs`, `server/profile/lore-storage.mjs`, `server/profile/lore-repository.mjs`, `server/profile/lore-publisher.mjs`
- Test: `server/profile/lore-document.test.mjs`, `server/profile/lore-publisher.test.mjs`

**Interfaces:**
- Consumes: `loadProfileContext`, `resolveAllProfiles` (Task 7).
- Produces:
  - `buildLoreDocument(profiles: Array<[id, profile]>) → { body: string, hash: string(12 hex), fileName: 'lore.<hash>.json' }` (no timestamp inside, so the same DB gives the same file);
  - `buildPointer(fileName, date) → string`; `POINTER_NAME = 'lore.pointer.json'`; `backupKey(envName, date) → 'backups/lore/<env>/<YYYY-MM-DD>.json.gz'`;
  - `loadLoreStorageConfig(env) → config`, `createLoreStorage(config) → { envName, putPublic(name, body, {cacheControl}), putBackup(key, buffer) }`;
  - `createLoreRepository(db) → { withPublishLock(fn), loadPublishProfiles(tx), loadBackupPayload(tx), readState(tx), writeState(tx, patch) }`;
  - `publishLore({ repo, storage, actorUserId = null, now = new Date() }) → { status: 'published'|'unchanged'|'busy', file? }`.

- [x] **Step 1: Write the failing tests**

```js
// server/profile/lore-document.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupKey, buildLoreDocument, buildPointer } from './lore-document.mjs';

test('same profiles give the same immutable file name', () => {
  const a = buildLoreDocument([['A0001', { record_id: '1' }]]);
  assert.equal(a.fileName, buildLoreDocument([['A0001', { record_id: '1' }]]).fileName);
  assert.match(a.fileName, /^lore\.[0-9a-f]{12}\.json$/);
  assert.notEqual(a.fileName, buildLoreDocument([['A0001', { record_id: '2' }]]).fileName);
  assert.deepEqual(JSON.parse(a.body), { version: 1, characters: { A0001: { record_id: '1' } } });
});

test('pointer and backup key', () => {
  const now = new Date('2026-09-24T23:59:00Z');
  assert.deepEqual(JSON.parse(buildPointer('lore.abc.json', now)), { file: 'lore.abc.json', publishedAt: '2026-09-24T23:59:00.000Z' });
  assert.equal(backupKey('production', now), 'backups/lore/production/2026-09-24.json.gz');
});
```

```js
// server/profile/lore-publisher.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { publishLore } from './lore-publisher.mjs';

function fakes({ locked = true, publishedHash = null, failPointer = false } = {}) {
  const writes = [];
  let state = { publishedHash };
  const repo = {
    withPublishLock: async (fn) => (locked ? fn('tx') : { status: 'busy' }),
    loadPublishProfiles: async () => [['A0001', { record_id: '1' }]],
    loadBackupPayload: async () => ({ version: 1, profileTexts: [] }),
    readState: async () => state,
    writeState: async (_tx, patch) => { state = { ...state, ...patch }; writes.push(['state', patch]); },
  };
  const storage = {
    envName: 'development',
    putPublic: async (name, body, opts) => { if (failPointer && name === 'lore.pointer.json') throw new Error('R2 down'); writes.push(['public', name, opts.cacheControl, body]); },
    putBackup: async (key, buffer) => writes.push(['backup', key, JSON.parse(gunzipSync(buffer).toString())]),
  };
  return { repo, storage, writes, getState: () => state };
}
const now = new Date('2026-09-24T10:00:00Z');

test('publishes content, then pointer, then state; always writes the backup', async () => {
  const f = fakes();
  const result = await publishLore({ repo: f.repo, storage: f.storage, actorUserId: 'u1', now });
  assert.equal(result.status, 'published');
  assert.deepEqual(f.writes.map((w) => w[0] === 'public' ? `${w[1].startsWith('lore.pointer') ? 'pointer' : 'content'}:${w[2]}` : w[0]), [
    'backup', 'content:public, max-age=31536000, immutable', 'pointer:public, max-age=60', 'state',
  ]);
  assert.equal(f.writes[0][1], 'backups/lore/development/2026-09-24.json.gz');
  assert.equal(f.getState().publishedByUserId, 'u1');
});

test('unchanged content writes only the backup', async () => {
  const first = fakes();
  await publishLore({ repo: first.repo, storage: first.storage, now });
  const f = fakes({ publishedHash: first.getState().publishedHash });
  assert.equal((await publishLore({ repo: f.repo, storage: f.storage, now })).status, 'unchanged');
  assert.deepEqual(f.writes.map((w) => w[0]), ['backup']);
});

test('a concurrent publish returns busy and writes nothing', async () => {
  const f = fakes({ locked: false });
  assert.deepEqual(await publishLore({ repo: f.repo, storage: f.storage, now }), { status: 'busy' });
  assert.equal(f.writes.length, 0);
});

test('a pointer failure leaves state untouched so the old version stays live', async () => {
  const f = fakes({ failPointer: true });
  await assert.rejects(publishLore({ repo: f.repo, storage: f.storage, now }), /R2 down/);
  assert.equal(f.writes.some((w) => w[0] === 'state'), false);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test server/profile/lore-document.test.mjs server/profile/lore-publisher.test.mjs` → FAIL, modules not found.

- [x] **Step 3: Implement**

```js
// server/profile/lore-document.mjs
import { createHash } from 'node:crypto';

export const POINTER_NAME = 'lore.pointer.json';
export const IMMUTABLE = 'public, max-age=31536000, immutable';
export const POINTER_CACHE = 'public, max-age=60';

export function buildLoreDocument(profiles) {
  const body = JSON.stringify({ version: 1, characters: Object.fromEntries(profiles) });
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
  return { body, hash, fileName: `lore.${hash}.json` };
}
export const buildPointer = (fileName, date) => JSON.stringify({ file: fileName, publishedAt: date.toISOString() });
export const backupKey = (envName, date) => `backups/lore/${envName}/${date.toISOString().slice(0, 10)}.json.gz`;
```

```js
// server/profile/lore-storage.mjs
// R2 access for lore: public bucket under LORE_PUBLISH_PREFIX + a private backup bucket.
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export function loadLoreStorageConfig(env = process.env) {
  const need = (name) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is not configured`);
    return value;
  };
  const prefix = need('LORE_PUBLISH_PREFIX');
  const match = /^lore\/(production|preview|development)\/$/.exec(prefix);
  if (!match) throw new Error('LORE_PUBLISH_PREFIX must be lore/<production|preview|development>/');
  return {
    endpoint: need('R2_ENDPOINT'), bucket: need('R2_BUCKET'), backupBucket: need('R2_BACKUP_BUCKET'),
    accessKeyId: need('R2_ACCESS_KEY_ID'), secretAccessKey: need('R2_SECRET_ACCESS_KEY'), prefix, envName: match[1],
  };
}

export function createLoreStorage(config) {
  const client = new S3Client({ region: 'auto', endpoint: config.endpoint, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  return {
    envName: config.envName,
    async putPublic(name, body, { cacheControl }) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: `${config.prefix}${name}`, Body: body, ContentType: 'application/json; charset=utf-8', CacheControl: cacheControl }));
    },
    async putBackup(key, buffer) {
      await client.send(new PutObjectCommand({ Bucket: config.backupBucket, Key: key, Body: buffer, ContentType: 'application/gzip' }));
    },
  };
}
```

```js
// server/profile/lore-repository.mjs
import { inArray, sql } from 'drizzle-orm';

import { editHistory } from '../../db/schema/core.mjs';
import { characterProfiles, lorePublishLockKey, lorePublishState, loreTerms, profileTexts } from '../../db/schema/profile.mjs';
import { loadProfileContext, resolveAllProfiles } from './resolve-character-profile.mjs';

export function createLoreRepository(db) {
  return {
    async withPublishLock(fn) {
      return db.transaction(async (tx) => {
        const [row] = await tx.execute(sql`select pg_try_advisory_xact_lock(${lorePublishLockKey}) as locked`);
        return row?.locked ? fn(tx) : { status: 'busy' };
      });
    },
    async loadPublishProfiles(tx) {
      return resolveAllProfiles(await loadProfileContext(tx), { shape: 'v2' });
    },
    async loadBackupPayload(tx) {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        characterProfiles: await tx.select().from(characterProfiles),
        profileTexts: await tx.select().from(profileTexts),
        loreTerms: await tx.select().from(loreTerms),
        lorePublishState: await tx.select().from(lorePublishState),
        editHistory: await tx.select().from(editHistory).where(inArray(editHistory.entityType, ['character_profile', 'lore_term'])),
      };
    },
    async readState(tx) {
      const [row] = await tx.select().from(lorePublishState);
      return row ?? null;
    },
    async writeState(tx, patch) {
      await tx.insert(lorePublishState).values({ id: 1, ...patch }).onConflictDoUpdate({ target: lorePublishState.id, set: patch });
    },
  };
}
```

```js
// server/profile/lore-publisher.mjs
// Publish order: backup -> content (new hash only) -> pointer (atomic swap) -> state.
import { gzipSync } from 'node:zlib';

import { IMMUTABLE, POINTER_CACHE, POINTER_NAME, backupKey, buildLoreDocument, buildPointer } from './lore-document.mjs';

export async function publishLore({ repo, storage, actorUserId = null, now = new Date() }) {
  return repo.withPublishLock(async (tx) => {
    const doc = buildLoreDocument(await repo.loadPublishProfiles(tx));
    await storage.putBackup(backupKey(storage.envName, now), gzipSync(JSON.stringify(await repo.loadBackupPayload(tx))));
    const state = await repo.readState(tx);
    if (state?.publishedHash === doc.hash) return { status: 'unchanged', file: doc.fileName };
    await storage.putPublic(doc.fileName, doc.body, { cacheControl: IMMUTABLE });
    await storage.putPublic(POINTER_NAME, buildPointer(doc.fileName, now), { cacheControl: POINTER_CACHE });
    await repo.writeState(tx, { publishedFile: doc.fileName, publishedHash: doc.hash, publishedAt: now, publishedByUserId: actorUserId });
    return { status: 'published', file: doc.fileName };
  });
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test server/profile/lore-document.test.mjs server/profile/lore-publisher.test.mjs` → `ℹ pass 6`.

- [x] **Step 5: Commit**

```bash
git add server/profile/lore-document.mjs server/profile/lore-storage.mjs server/profile/lore-repository.mjs server/profile/lore-publisher.mjs server/profile/lore-document.test.mjs server/profile/lore-publisher.test.mjs
git commit -m "feat(lore): R2 lore publisher with advisory lock and daily private backup"
```

### Task 9: Admin endpoint + publish CLI

**Files:**
- Create: `server/admin-api-routes/lore.mjs`, `scripts/publish-lore.mjs`
- Modify: `api/admin/[...].js` (add a `lore` case before `default`)

**Interfaces:**
- Consumes: Task 8.
- Produces: `GET /api/admin/lore/publish` → `lore_publish_state` + `{ hasUnpublishedChanges }`; `POST` → `publishLore` result (`409` when `busy`). Any active signed-in admin (owner or editor) may POST — the P4 auto-publish runs in an editor's browser too; the "Xuất bản" button is shown to owners only (P4).

- [x] **Step 1: Route + dispatcher**

```js
// server/admin-api-routes/lore.mjs
export async function lorePublish(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser }, { getDb }, { createLoreRepository }, storageModule, { publishLore }] = await Promise.all([
      import('../admin-api.mjs'), import('../../db/client.mjs'), import('../profile/lore-repository.mjs'),
      import('../profile/lore-storage.mjs'), import('../profile/lore-publisher.mjs'),
    ]);
    const user = await authenticatedUser(request, { requireOrigin: request.method !== 'GET' });
    const repo = createLoreRepository(getDb());
    if (request.method === 'GET') {
      const state = await repo.readState(getDb());
      const hasUnpublishedChanges = Boolean(state?.lastEditAt && (!state.publishedAt || state.lastEditAt > state.publishedAt));
      return response.status(200).json({ state, hasUnpublishedChanges });
    }
    const storage = storageModule.createLoreStorage(storageModule.loadLoreStorageConfig());
    const result = await publishLore({ repo, storage, actorUserId: user.id });
    return response.status(result.status === 'busy' ? 409 : 200).json(result);
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}
```

In `api/admin/[...].js`, add before `default:`:

```js
      case 'lore': {
        const { lorePublish } = await import('../../server/admin-api-routes/lore.mjs');
        if (rest.length === 1 && rest[0] === 'publish') return lorePublish(request, response);
        return response.status(404).json({ error: { code: 'NOT_FOUND' } });
      }
```

- [x] **Step 2: CLI**

```js
// scripts/publish-lore.mjs
// --dry-run <file>: write the lore JSON locally, no R2, no DB writes.
// (no flag): publish (writes R2 + lore_publish_state) — owner approval required.
// --repoint <lore.<hash>.json>: point production at an older file (rollback) — owner approval required.
import { writeFileSync } from 'node:fs';

import { closeDb, getDb } from '../db/client.mjs';
import { POINTER_CACHE, POINTER_NAME, buildLoreDocument, buildPointer } from '../server/profile/lore-document.mjs';
import { createLoreRepository } from '../server/profile/lore-repository.mjs';
import { createLoreStorage, loadLoreStorageConfig } from '../server/profile/lore-storage.mjs';
import { loadProfileContext, resolveAllProfiles } from '../server/profile/resolve-character-profile.mjs';
import { publishLore } from '../server/profile/lore-publisher.mjs';

const argv = process.argv.slice(2);
try {
  if (argv[0] === '--dry-run') {
    const doc = buildLoreDocument(resolveAllProfiles(await loadProfileContext(getDb()), { shape: 'v2' }));
    writeFileSync(argv[1], doc.body);
    console.log(JSON.stringify({ dryRun: true, file: doc.fileName, bytes: Buffer.byteLength(doc.body) }));
  } else if (argv[0] === '--repoint') {
    if (!/^lore\.[0-9a-f]{12}\.json$/.test(argv[1] ?? '')) throw new Error('usage: --repoint lore.<12 hex>.json');
    const storage = createLoreStorage(loadLoreStorageConfig());
    const now = new Date();
    await storage.putPublic(POINTER_NAME, buildPointer(argv[1], now), { cacheControl: POINTER_CACHE });
    await createLoreRepository(getDb()).writeState(getDb(), { publishedFile: argv[1], publishedHash: argv[1].slice(5, 17), publishedAt: now });
    console.log(JSON.stringify({ repointed: argv[1] }));
  } else {
    const storage = createLoreStorage(loadLoreStorageConfig());
    console.log(JSON.stringify(await publishLore({ repo: createLoreRepository(getDb()), storage })));
  }
} catch (error) {
  console.error(`LORE_PUBLISH_FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
```

- [x] **Step 3: Dry run (read-only)**

Run: `node --env-file=.env --env-file=.env.local scripts/publish-lore.mjs --dry-run D:/BaiTapCode/WHMX/_claude_scratch/lore.json` twice.
Expected: the same `file` name both times; size roughly 1–2 MB; `node -e` check that no value matches `^[KTSP]\d{4}$`.

- [x] **Step 4: OWNER GATE — env vars + first publish**

Confirm with the owner that spec §12 step C is done (Vercel env vars) and that `.env.local` has `R2_ENDPOINT`, `R2_BUCKET`, `R2_BACKUP_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `LORE_PUBLISH_PREFIX=lore/development/`. After a yes run `node --env-file=.env --env-file=.env.local scripts/publish-lore.mjs`. Expected `{"status":"published","file":"lore.<hash>.json"}`; running it again gives `unchanged`. Fetch `https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev/lore/development/lore.pointer.json` and confirm its `file` matches and a CORS `Access-Control-Allow-Origin` header is present.

- [x] **Step 5: Endpoint check under `vercel dev`**

Start `whmxcalc-vercel-dev` (launch.json). The owner signs in (or approves a temp account per state doc 09-23_v2 §3). In the page: `await fetch('/api/admin/lore/publish', {method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body:'{}'})` → `200` with `unchanged`; a signed-out call → `401`. Stop the server afterwards.

- [x] **Step 6: Commit**

```bash
git add server/admin-api-routes/lore.mjs "api/admin/[...].js" scripts/publish-lore.mjs docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md
git commit -m "feat(lore): admin publish endpoint and publish/repoint CLI"
```

### Task 10: Frontend overlay loader

**Files:**
- Create: `src/features/profile/api/loreOverlay.mts`
- Test: `src/features/profile/api/loreOverlay.test.mts`
- Modify: `src/data/loader.js`, `tsconfig.json` (`include` += `"src/**/*.mts"`)

**Interfaces:**
- Produces: `loadLoreOverlay(pointerUrl?: string, fetchImpl = fetch, timeoutMs = 5000) → Promise<LoreOverlay | null>`; `mergeLoreOverlay(gameData, overlay) → number` (profiles replaced).

- [x] **Step 1: Write the failing test**

```ts
// src/features/profile/api/loreOverlay.test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLoreOverlay, mergeLoreOverlay } from './loreOverlay.mts';

const POINTER = 'https://cdn.example/lore/production/lore.pointer.json';
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

test('loads pointer then content relative to the pointer', async () => {
  const seen: string[] = [];
  const fetchImpl = async (url: string) => {
    seen.push(url);
    return url.endsWith('pointer.json') ? ok({ file: 'lore.0123456789ab.json' }) : ok({ version: 1, characters: { A0001: { record_id: '1' } } });
  };
  const overlay = await loadLoreOverlay(POINTER, fetchImpl as typeof fetch);
  assert.deepEqual(seen, [POINTER, 'https://cdn.example/lore/production/lore.0123456789ab.json']);
  assert.deepEqual(overlay?.characters, { A0001: { record_id: '1' } });
});

test('returns null on 404, bad pointer, bad version, or missing URL', async () => {
  assert.equal(await loadLoreOverlay(undefined), null);
  assert.equal(await loadLoreOverlay(POINTER, (async () => new Response('', { status: 404 })) as typeof fetch), null);
  assert.equal(await loadLoreOverlay(POINTER, (async () => ok({ file: '../evil.json' })) as typeof fetch), null);
  const wrongVersion = async (url: string) => (url.endsWith('pointer.json') ? ok({ file: 'lore.0123456789ab.json' }) : ok({ version: 2, characters: {} }));
  assert.equal(await loadLoreOverlay(POINTER, wrongVersion as typeof fetch), null);
});

test('times out instead of blocking the page', async () => {
  const hang = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  })) as typeof fetch;
  const started = Date.now();
  assert.equal(await loadLoreOverlay(POINTER, hang, 50), null);
  assert.ok(Date.now() - started < 1000);
});

test('merge replaces only known characters', () => {
  const data = { characters: { A0001: { profile: { record_id: 'old' } }, A0002: { profile: { record_id: 'keep' } } } };
  const count = mergeLoreOverlay(data, { version: 1, characters: { A0001: { record_id: 'new' }, Z9999: { record_id: 'x' } } });
  assert.equal(count, 1);
  assert.deepEqual(data.characters.A0001.profile, { record_id: 'new' });
  assert.deepEqual(data.characters.A0002.profile, { record_id: 'keep' });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `node --test src/features/profile/api/loreOverlay.test.mts` → FAIL, module not found.

- [x] **Step 3: Implement**

```ts
// src/features/profile/api/loreOverlay.mts
// DB-owned lore text published on R2 (architecture §11). Any failure keeps the CN in data.json.
export type LoreOverlay = { version: 1; characters: Record<string, unknown> };
type GameData = { characters?: Record<string, { profile?: unknown }> };

export async function loadLoreOverlay(pointerUrl?: string, fetchImpl: typeof fetch = fetch, timeoutMs = 5000): Promise<LoreOverlay | null> {
  if (!pointerUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const pointerResponse = await fetchImpl(pointerUrl, { signal: controller.signal });
    if (!pointerResponse.ok) throw new Error(`pointer HTTP ${pointerResponse.status}`);
    const pointer = await pointerResponse.json();
    if (typeof pointer?.file !== 'string' || !/^lore\.[0-9a-f]{12}\.json$/.test(pointer.file)) throw new Error('invalid pointer');
    const response = await fetchImpl(new URL(pointer.file, pointerUrl).toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`lore HTTP ${response.status}`);
    const doc = await response.json();
    if (doc?.version !== 1 || typeof doc.characters !== 'object' || doc.characters === null) throw new Error('invalid lore document');
    return doc as LoreOverlay;
  } catch (error) {
    console.warn('[lore] overlay not loaded; showing CN from data.json:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function mergeLoreOverlay(gameData: GameData, overlay: LoreOverlay | null): number {
  if (!overlay || !gameData.characters) return 0;
  let merged = 0;
  for (const [id, profile] of Object.entries(overlay.characters)) {
    const character = gameData.characters[id];
    if (character && profile && typeof profile === 'object') {
      character.profile = profile;
      merged += 1;
    }
  }
  return merged;
}
```

In `src/data/loader.js`:

```js
import { loadLoreOverlay, mergeLoreOverlay } from '../features/profile/api/loreOverlay.mts';

let gameData = null;

export async function loadGameData() {
  if (gameData) return gameData;
  try {
    // Started in parallel with data.json; resolves to null on any failure (CN fallback).
    const overlayPromise = loadLoreOverlay(import.meta.env.VITE_LORE_POINTER_URL);
    const res = await fetch('/data.json');
    gameData = await res.json();
    // ...existing icon/skin path normalisation unchanged...
    mergeLoreOverlay(gameData, await overlayPromise);
    return gameData;
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}
```

(Keep the existing `if (gameData && gameData.characters) { … }` block exactly where it is, between `gameData = await res.json();` and `mergeLoreOverlay(...)`.) In `tsconfig.json` set `"include": ["src/admin/layout", "src/**/*.tsx", "src/**/*.mts"]`.

- [x] **Step 4: Run tests + build**

Run: `node --test src/features/profile/api/loreOverlay.test.mts` → `ℹ pass 4`. Then `npm run build` (background) → `✓ built`.

- [x] **Step 5: Browser check**

Start `whmxcalc-dev` with `VITE_LORE_POINTER_URL` pointing at the development pointer (in `.env.local`). On `#/characters/thuy-tinh-boi` (V0053): no console errors, and in the console `(await import('/src/data/loader.js')).getGameData().characters.V0053.profile.relic_info.type` returns `{cn: '玉器', vi: null}` (v2 shape from R2). Then block the pointer request (Playwright `page.route('**/lore.pointer.json', r => r.abort())`): the page still renders and the profile is the `data.json` one. Stop the server.

- [x] **Step 6: Commit**

```bash
git add src/features/profile/api/loreOverlay.mts src/features/profile/api/loreOverlay.test.mts src/data/loader.js tsconfig.json docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md
git commit -m "feat(lore): public lore overlay loader with CN fallback"
```

### Task 11: Restore command

**Files:**
- Create: `server/profile/lore-restore.mjs`, `scripts/restore-lore-snapshot.mjs`
- Test: `server/profile/lore-restore.test.mjs`

**Interfaces:**
- Consumes: backup payload shape from `loadBackupPayload` (Task 8).
- Produces: `planRestore(snapshot, current) → { texts: [{id, before, after}], terms: [{code, before, after}] }` comparing `vi, viOrigin, state` (texts) and `nameVi, detailVi, viOrigin, state` (terms), matched by `profileEntityId+unitKey` and `code`.

- [x] **Step 1: Write the failing test**

```js
// server/profile/lore-restore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRestore } from './lore-restore.mjs';

test('lists only VI fields that differ; never CN', () => {
  const snapshot = {
    profileTexts: [
      { profileEntityId: 'p1', unitKey: 'card_intro', sourceCn: 'OLD CN', vi: 'Cũ', viOrigin: 'admin', state: 'ok' },
      { profileEntityId: 'p1', unitKey: 'relic_intro', sourceCn: 'x', vi: null, viOrigin: null, state: 'ok' },
    ],
    loreTerms: [{ code: 'K1001', nameVi: 'Ngọc Khí', detailVi: null, viOrigin: 'admin', state: 'ok' }],
  };
  const current = {
    profileTexts: [
      { id: 't1', profileEntityId: 'p1', unitKey: 'card_intro', sourceCn: 'NEW CN', vi: 'Mới', viOrigin: 'admin', state: 'ok' },
      { id: 't2', profileEntityId: 'p1', unitKey: 'relic_intro', sourceCn: 'x', vi: null, viOrigin: null, state: 'ok' },
    ],
    loreTerms: [{ code: 'K1001', nameVi: null, detailVi: null, viOrigin: null, state: 'ok' }],
  };
  const plan = planRestore(snapshot, current);
  assert.deepEqual(plan.texts, [{ id: 't1', unitKey: 'card_intro', before: { vi: 'Mới', viOrigin: 'admin', state: 'ok' }, after: { vi: 'Cũ', viOrigin: 'admin', state: 'ok' } }]);
  assert.deepEqual(plan.terms, [{ code: 'K1001', before: { nameVi: null, detailVi: null, viOrigin: null, state: 'ok' }, after: { nameVi: 'Ngọc Khí', detailVi: null, viOrigin: 'admin', state: 'ok' } }]);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `node --test server/profile/lore-restore.test.mjs` → FAIL.

- [x] **Step 3: Implement**

```js
// server/profile/lore-restore.mjs
const pick = (row, fields) => Object.fromEntries(fields.map((f) => [f, row?.[f] ?? null]));
const TEXT_FIELDS = ['vi', 'viOrigin', 'state'];
const TERM_FIELDS = ['nameVi', 'detailVi', 'viOrigin', 'state'];

export function planRestore(snapshot, current) {
  const snapTexts = new Map(snapshot.profileTexts.map((r) => [`${r.profileEntityId}|${r.unitKey}`, r]));
  const snapTerms = new Map(snapshot.loreTerms.map((r) => [r.code, r]));
  const texts = [];
  for (const row of current.profileTexts) {
    const old = snapTexts.get(`${row.profileEntityId}|${row.unitKey}`);
    if (!old) continue;
    const before = pick(row, TEXT_FIELDS);
    const after = pick(old, TEXT_FIELDS);
    if (JSON.stringify(before) !== JSON.stringify(after)) texts.push({ id: row.id, unitKey: row.unitKey, before, after });
  }
  const terms = [];
  for (const row of current.loreTerms) {
    const old = snapTerms.get(row.code);
    if (!old) continue;
    const before = pick(row, TERM_FIELDS);
    const after = pick(old, TERM_FIELDS);
    if (JSON.stringify(before) !== JSON.stringify(after)) terms.push({ code: row.code, before, after });
  }
  return { texts, terms };
}
```

```js
// scripts/restore-lore-snapshot.mjs
// Usage: restore-lore-snapshot.mjs <file.json.gz> --actor <owner email> [--apply]
// Default is a dry run. --apply writes the DB (owner approval required).
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import { eq, inArray, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import { users } from '../db/schema/auth.mjs';
import { editHistory, managedEntities } from '../db/schema/core.mjs';
import { lorePublishState, loreTerms, profileTexts } from '../db/schema/profile.mjs';
import { planRestore } from '../server/profile/lore-restore.mjs';

const [file, ...rest] = process.argv.slice(2);
const actorEmail = rest[rest.indexOf('--actor') + 1];
const applyChanges = rest.includes('--apply');
try {
  if (!file || !actorEmail || rest.indexOf('--actor') < 0) throw new Error('usage: <file.json.gz> --actor <owner email> [--apply]');
  const snapshot = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
  const db = getDb();
  const [actor] = await db.select().from(users).where(eq(users.email, actorEmail));
  if (!actor || actor.role !== 'owner' || actor.status !== 'active') throw new Error('actor must be an active owner');
  const plan = planRestore(snapshot, { profileTexts: await db.select().from(profileTexts), loreTerms: await db.select().from(loreTerms) });
  console.log(JSON.stringify({ mode: applyChanges ? 'apply' : 'dry run (nothing written)', texts: plan.texts, terms: plan.terms }, null, 2));
  if (applyChanges && (plan.texts.length || plan.terms.length)) {
    await db.transaction(async (tx) => {
      const now = new Date();
      const group = randomUUID();
      const byId = new Map((await tx.select().from(profileTexts)).map((r) => [r.id, r]));
      const history = [];
      for (const change of plan.texts) {
        await tx.update(profileTexts).set({ ...change.after, viUpdatedByUserId: actor.id, viUpdatedAt: now, updatedAt: now }).where(eq(profileTexts.id, change.id));
        history.push({ entityId: byId.get(change.id).profileEntityId, entityType: 'character_profile', fieldName: change.unitKey, oldValue: change.before, newValue: change.after });
      }
      const termIds = new Map((await tx.select().from(loreTerms)).map((r) => [r.code, r.entityId]));
      for (const change of plan.terms) {
        await tx.update(loreTerms).set({ ...change.after, viUpdatedByUserId: actor.id, viUpdatedAt: now, updatedAt: now }).where(eq(loreTerms.code, change.code));
        history.push({ entityId: termIds.get(change.code), entityType: 'lore_term', fieldName: 'vi', oldValue: change.before, newValue: change.after });
      }
      await tx.insert(editHistory).values(history.map((h) => ({ ...h, changeGroupId: group, requestId: group, eventType: 'human_edit', actorUserId: actor.id, metadata: { restoredFrom: file } })));
      await tx.update(managedEntities).set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now }).where(inArray(managedEntities.id, [...new Set(history.map((h) => h.entityId))]));
      await tx.insert(lorePublishState).values({ id: 1, lastEditAt: now }).onConflictDoUpdate({ target: lorePublishState.id, set: { lastEditAt: now } });
    });
    console.log('RESTORE_APPLIED');
  }
} catch (error) {
  console.error(`LORE_RESTORE_FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
```

- [x] **Step 4: Run tests + a dry run**

Run: `node --test server/profile/lore-restore.test.mjs` → pass. Download today's backup from the `whmx-backups` bucket (owner can do it in the Cloudflare dashboard, saved on drive D) and run `node --env-file=.env --env-file=.env.local scripts/restore-lore-snapshot.mjs <file> --actor <owner email>`. Expected: `texts: []`, `terms: []` (nothing changed since the backup). **Never run `--apply` without the owner's yes.**

- [x] **Step 5: Commit**

```bash
git add server/profile/lore-restore.mjs server/profile/lore-restore.test.mjs scripts/restore-lore-snapshot.mjs docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md
git commit -m "feat(lore): snapshot restore (dry run by default)"
```

Update the status table: P3 ✅ and P6 (backup/restore) ✅.

---

## Phase A — archive (hiện vật) images (independent of P1–P3)

### Task 12: Publish archive images and emit `char.archive`

**Files:**
- Modify: `tools/asset_publish_manifest.py:17` (`REMOTE_CATEGORIES`), `tools/build_web_data.py` (next to `char_cards`, and the character output dict)

**Interfaces:**
- Produces: `data.json` `characters.<id>.archive = { "image": <url>, "head": <url> }` (absent when the character has no archive folder).

- [x] **Step 1: Add the category**

```python
REMOTE_CATEGORIES = {"card": "cards", "drawing": "drawings", "archive": "archives"}
```

`publish_assets.discover_assets()` already loops over `REMOTE_CATEGORIES` and globs `<character>/<category>/*.png`, so the 268 archive PNGs are picked up with no other change.

- [x] **Step 2: OWNER GATE — upload**

`tools/publish_assets.py` uploads to R2 with the owner's credentials. Show the owner the dry count (`python -c "import sys; sys.path.insert(0,'tools'); import publish_assets as p; a=[x for x in p.discover_assets() if x['category']=='archive']; print(len(a))"` → expected `268`). After a yes, the owner runs `python tools/publish_assets.py`; `asset-publish-manifest.json` gains 268 `characters/<id>/archives/…webp` keys.

- [x] **Step 3: Emit URLs in the build**

In `tools/build_web_data.py`, after the `char_cards` loop add a helper (called only for characters that end up in `chars_db`, so the NPC `W0021`, which is not published, is never looked up):

```python
    def archive_urls(cid):
        """Archive (hiện vật) image URLs, or None when the character has no archive folder."""
        archive_dir = MASTER.parent.parent / "Assets" / "characters" / cid / "archive"
        image, head = archive_dir / f"{cid.lower()}.png", archive_dir / f"head_{cid.lower()}.png"
        if not (image.exists() and head.exists()):
            return None
        return {
            "image": require_asset_url(remote_asset_manifest, cid, "archive", image.name),
            "head": require_asset_url(remote_asset_manifest, cid, "archive", head.name),
        }
```

(Use the same base-path expression as `card_dir` a few lines above if it differs from `MASTER.parent.parent / "Assets"`.) Where each character dict is assembled into `chars_db`, add `**({"archive": archive} if (archive := archive_urls(cid)) else {}),` next to the card entry.

- [x] **Step 4: Build to scratch and verify**

Build with outputs redirected (`D:\BaiTapCode\WHMX\_claude_scratch\dept\run_build.py <D path>`), then compare with `public/data.json`: the only differences are 133 new `characters.<id>.archive` objects (use `jdiff.py`). Open one URL from the output in the browser: it shows the relic image. Copy to `public/data.json`, run the four validators and `npm run build`.

- [x] **Step 5: Commit**

```bash
git add tools/asset_publish_manifest.py tools/build_web_data.py asset-publish-manifest.json public/data.json docs/plans/WHMX_DATA_PIPELINE_PLAN_2026-09-24.md
git commit -m "feat(assets): publish archive (hiện vật) images and emit char.archive"
```

---

## Spec adjustments made while planning (already applied to the spec)

1. §6: the overlay is JS resolver → stdout → `tools/apply_profile_overlay.py` (Node reorders integer-like keys, verified on `items`).
2. §6 gate 2: `departmentChanges` is expected to be empty, because the old pipeline already uses `typeJJh` (commit `d3e9689`).
3. §7.1: `publishedAt` lives in the pointer only, so the same DB state always yields the same immutable file name.
4. §7.3: `POST /api/admin/lore/publish` is allowed for any active signed-in admin (the P4 auto-publish runs in editors' browsers too); the button is owner-only in the UI.
5. §8: backup keys include the environment: `backups/lore/<env>/<YYYY-MM-DD>.json.gz` (the 90-day lifecycle on `backups/lore/` still matches).
