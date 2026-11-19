# Dịch thoại Lồng tiếng — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ dự án dịch chữ thoại nhân vật trong Admin (module "Lồng tiếng"), bản dịch được phát hành thành `voice.<hash>.json` và tab Lồng Tiếng hiện câu Việt.

**Architecture:** Câu thoại thành `profile_texts` với khoá `voice.*`, nhập từ `public/data/voice/<ID>.json` cùng importer hồ sơ. 8 câu mở khoá thành `lore_terms` loại mới `voice_unlock`. Admin dùng lại `LoreModule` (scope `voice`) và Từ điển. Bộ phát hành lore thêm tài liệu thứ ba `voice.<hash>.json` + `voice.pointer.json`. Tab web tải tài liệu đó qua `loadPointed`, ghép vào `groupsOf`.

**Tech Stack:** Node ESM (node:test), Drizzle + Postgres, React 19 + Tailwind (Admin), React island (tab), Vite.

**Spec:** [`../specs/2026-11-19-voice-translation-design.md`](../specs/2026-11-19-voice-translation-design.md)

## Global Constraints

- Claude không dịch câu nào; không điền VI vào DB.
- Không git add/commit/push khi chủ dự án chưa nói. Bước "Commit" trong mỗi task = **chỉ báo lại danh sách file**, không chạy git.
- Mỗi lần ghi DB (migration, `--apply`) và lần phát hành đầu ở production phải có câu đồng ý riêng của chủ dự án.
- Không dùng subagent.
- File tạm để ở `D:\BaiTapCode\WHMX\_claude_scratch`.
- Không đụng `src/features/characters/views/detail/infoView.js` và `localization/localization_master.xlsx`. Thêm khoá vào `strings.mts` chỉ bằng Edit.
- Thiết kế: phẳng, không đổ bóng, bo 6px, đường kẻ 1px, chỉ dùng token.
- Khoá: `voice.<skin>.<type>` (gói chính = `langs[0]`), `voice.<skin>.<type>.<lang>` chỉ khi chữ khác gói chính. `source_ref` = `voice:<ID>/<lang>/<skin>/<type>`. Câu rỗng: không khoá.
- Mã mở khoá `VOICE_UNLOCK_<n>`: câu đã có giữ mã (tìm theo `name_cn`), câu mới lấy số lớn nhất + 1, lần đầu đánh số theo chữ Trung đã sắp xếp.
- Tài liệu: `{ version: 1, unlock: {cn: vi}, characters: {ID: {"<skin>.<type>[.<lang>]": vi}} }`, chỉ VI qua `publishableVi`.

**Khác spec một chỗ (nêu rõ để duyệt):** spec §4.2 viết "không cần `structure.voice`". Kế hoạch vẫn không lưu thứ tự câu trong `structure`, nhưng thêm `structure.voiceUnlocks: [mã]` (chỉ khi có) để `termUsage` đếm được "dùng ở N Khí giả" (spec §6). Đây là cùng cách `relicTags` đang làm.

## Review Focus

1. Câu gói phụ có chữ Trung giống gói chính nhưng khác khoảng trắng đầu/cuối: importer và web phải cùng coi là "giống" (cả hai `trim`), nếu không web sẽ mất bản dịch. → test ở Task 1 và Task 5.
2. Nhập lại sau khi có câu mở khoá mới: mã cũ không đổi, câu mới không chiếm số của câu cũ. → test `assignUnlockCodes` ở Task 1.
3. Câu đã dịch rồi chữ Trung đổi (`source_changed`) hoặc câu biến mất (`source_present = false`): không được phát hành. → test ở Task 3.
4. Bản dịch tải xong khi một câu đang phát: màn phát đổi sang câu Việt, không dừng tiếng. → kiểm ở Task 6 (trình duyệt).
5. Câu `voice.*` không được lọt vào bộ đếm Lore, mục "Mới dịch" (`vi_updated_at`), hay tài liệu lore. → test ở Task 2.

---

### Task 1: `voice-source.mjs` — câu thoại thành unit

**Files:**
- Create: `scripts/lib/voice-source.mjs`
- Test: `scripts/lib/voice-source.test.mjs`

**Interfaces:**
- Produces: `voiceUnits(doc) -> { units: {unitKey, sourceCn, sourceRef, sourceHash}[], unlocks: string[] }` (unlocks: chữ Trung, đã sắp xếp, không trùng); `assignUnlockCodes(cns: Iterable<string>, existing: Map<nameCn, code>) -> Map<cn, code>`.

- [ ] **Step 1: Viết test**

```js
// scripts/lib/voice-source.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignUnlockCodes, voiceUnits } from './voice-source.mjs';

const line = (o) => ({ skin: 'A0100001', type: 'regardsLine', order: 2, label: '问候', text: '今日吹的是北风。', key: 'k', ...o });
const DOC = { id: 'A0100', langs: [
  { lang: '1001', lines: [
    line({}),
    line({ type: 'dropLine', text: '吾乃愿望杯。' }),
    line({ type: 'touchLine_4', text: '', unlock: '感应达到投契解锁' }),
    line({ type: 'touchLine_5', text: '鹿鸣', unlock: '精研解锁' }),
  ] },
  { lang: '1007', lines: [
    line({ text: ' 今日吹的是北风。 ' }),           // same CN as the main pack → no key
    line({ type: 'dropLine', text: '另一句。' }),     // different CN → its own key
    line({ type: 'touchLine_4', text: '', unlock: '感应达到投契解锁' }),
  ] },
] };

test('main pack keys, alt pack only when the CN differs, empty lines skipped', () => {
  const { units } = voiceUnits(DOC);
  assert.deepEqual(units.map((u) => u.unitKey), [
    'voice.A0100001.regardsLine', 'voice.A0100001.dropLine', 'voice.A0100001.touchLine_5', 'voice.A0100001.dropLine.1007',
  ]);
  const alt = units.at(-1);
  assert.equal(alt.sourceCn, '另一句。');
  assert.equal(alt.sourceRef, 'voice:A0100/1007/A0100001/dropLine');
  assert.match(alt.sourceHash, /^[0-9a-f]{64}$/);
});

test('unlock texts: unique, sorted, empty ignored', () => {
  assert.deepEqual(voiceUnits(DOC).unlocks, ['感应达到投契解锁', '精研解锁'].sort());
  assert.deepEqual(voiceUnits({ id: 'X', langs: [{ lang: '1001', lines: [line({ unlock: '  ' })] }] }).unlocks, []);
});

test('unlock codes: existing kept, new ones numbered after the highest', () => {
  const first = assignUnlockCodes(['乙', '甲'], new Map());
  assert.deepEqual([...first], [['乙', 'VOICE_UNLOCK_1'], ['甲', 'VOICE_UNLOCK_2']]); // sorted CN order
  const again = assignUnlockCodes(['丙', '甲'], new Map([['乙', 'VOICE_UNLOCK_1'], ['甲', 'VOICE_UNLOCK_2']]));
  assert.deepEqual([...again], [['丙', 'VOICE_UNLOCK_3'], ['甲', 'VOICE_UNLOCK_2']]);
});
```

- [ ] **Step 2: Chạy test, phải lỗi**

Run: `node --test scripts/lib/voice-source.test.mjs`
Expected: FAIL, "Cannot find module ... voice-source.mjs".

- [ ] **Step 3: Viết code**

```js
// scripts/lib/voice-source.mjs
// Pure: one public/data/voice/<ID>.json → profile_texts units (spec 2026-11-19-voice-translation §4).
// Main pack = langs[0]: voice.<skin>.<type>. Another pack gets voice.<skin>.<type>.<lang> only when its CN differs (V1).
import { createHash } from 'node:crypto';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const clean = (value) => String(value ?? '').trim();

export function voiceUnits(doc) {
  const units = [];
  const unlocks = new Set();
  const [main] = doc?.langs ?? [];
  const mainCn = new Map((main?.lines ?? []).map((l) => [`${l.skin}.${l.type}`, clean(l.text)]));
  for (const lang of doc?.langs ?? []) {
    for (const l of lang.lines ?? []) {
      if (clean(l.unlock)) unlocks.add(clean(l.unlock));
      const cn = clean(l.text);
      const base = `${l.skin}.${l.type}`;
      if (!cn || (lang !== main && cn === mainCn.get(base))) continue;
      units.push({ unitKey: `voice.${base}${lang === main ? '' : `.${lang.lang}`}`, sourceCn: cn, sourceRef: `voice:${doc.id}/${lang.lang}/${l.skin}/${l.type}`, sourceHash: sha(cn) });
    }
  }
  return { units, unlocks: [...unlocks].sort() };
}

// VOICE_UNLOCK_<n>: an existing text keeps its code (matched by name_cn); new texts, in CN order, take the next numbers.
export function assignUnlockCodes(cns, existing) {
  let next = Math.max(0, ...[...existing.values()].map((code) => Number(String(code).replace('VOICE_UNLOCK_', '')) || 0));
  return new Map([...new Set(cns)].sort().map((cn) => [cn, existing.get(cn) ?? `VOICE_UNLOCK_${++next}`]));
}
```

- [ ] **Step 4: Chạy test, phải qua**

Run: `node --test scripts/lib/voice-source.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Báo file** — `scripts/lib/voice-source.mjs`, `scripts/lib/voice-source.test.mjs` (không git).

---

### Task 2: Enum, migration 0010, importer, bộ đếm

**Files:**
- Modify: `db/schema/profile.mjs:11` (enum)
- Create (do `npm run db:generate` sinh): `db/migrations/0010_*.sql`, `db/migrations/meta/0010_snapshot.json`, cập nhật `meta/_journal.json`
- Modify: `scripts/lib/profile-source.mjs` (`normalizeProfileSources`)
- Modify: `scripts/import-character-profile.mjs` (`loadRaw`, nhánh plan/apply, `--check`)
- Modify: `server/profile/lore-edit.mjs` (`loreProgress`, `termUsage`)
- Modify: `server/profile/shape-character-profile.mjs:15` (`viUpdatedAt`)
- Test: `scripts/lib/profile-source.test.mjs`, `server/profile/lore-edit.test.mjs`, `server/profile/shape-character-profile.test.mjs`

**Interfaces:**
- Consumes: `voiceUnits`, `assignUnlockCodes` (Task 1).
- Produces: `normalizeProfileSources(raw, ids, { voiceCodes } = {})` với `raw.voice: Record<ID, VoiceDoc>`; profile có `structure.voiceUnlocks?: string[]`; terms loại `voice_unlock`. Enum `lore_term_kind` có `voice_unlock`.

- [ ] **Step 1: Viết test**

Thêm vào `scripts/lib/profile-source.test.mjs`:

```js
test('voice lines become units; unlock texts become voice_unlock terms named on the profile', () => {
  const doc = { id: 'A0100', langs: [{ lang: '1001', lines: [
    { skin: 'A0100001', type: 'regardsLine', text: '北风。' },
    { skin: 'A0100001', type: 'touchLine_4', text: '', unlock: '精研解锁' },
  ] }] };
  const raw = { characterFiles: { A0100: {} }, characterFileTextMap: {}, historicalRelicsMap: {}, historicalTextMap: {}, friendshipDescription: {}, characterTable: {}, typeJJHMap: {}, voice: { A0100: doc } };
  const out = normalizeProfileSources(raw, ['A0100'], { voiceCodes: new Map([['旧', 'VOICE_UNLOCK_4']]) });
  const [p] = out.profiles;
  assert.deepEqual(p.units.map((u) => u.unitKey), ['voice.A0100001.regardsLine']);
  assert.deepEqual(p.structure.voiceUnlocks, ['VOICE_UNLOCK_5']);
  assert.deepEqual(out.terms.filter((t) => t.kind === 'voice_unlock').map((t) => [t.code, t.nameCn]), [['VOICE_UNLOCK_5', '精研解锁']]);
  const plain = normalizeProfileSources({ ...raw, voice: undefined }, ['A0100']).profiles[0];
  assert.equal('voiceUnlocks' in plain.structure, false); // no voice → same structure (and hash) as before
});
```

Thêm vào `server/profile/lore-edit.test.mjs`:

```js
test('lore progress skips voice units; term usage counts voice unlocks', () => {
  const rows = [{ characterId: 'A1', unitKey: 'voice.A1001.regardsLine', vi: 'x', viOrigin: 'admin', state: 'ok' }, { characterId: 'A1', unitKey: 'quote', vi: null, viOrigin: null, state: 'ok' }];
  assert.deepEqual(loreProgress(rows), { A1: { total: 1, done: 0, legacy: 0, changed: 0 } });
  assert.deepEqual(termUsage([{ characterId: 'A1', structure: { reports: [], voiceUnlocks: ['VOICE_UNLOCK_1'] } }]), { VOICE_UNLOCK_1: ['A1'] });
});
```

Thêm vào `server/profile/shape-character-profile.test.mjs`, ngay sau test `v2 vi_updated_at is the latest published main-text VI, else null` (dùng `profile`, `terms`, `t` có sẵn của file):

```js
test('v2 vi_updated_at ignores voice lines (they have their own module)', () => {
  const at = (iso) => new Date(iso);
  const dated = new Map([
    ['card_intro', { ...t('介绍', 'Giới thiệu', 'admin'), viUpdatedAt: at('2026-09-20T01:00:00Z') }],
    ['voice.A0100001.regardsLine', { ...t('北风', 'Gió bấc', 'admin'), viUpdatedAt: at('2026-12-01T01:00:00Z') }],
  ]);
  assert.equal(shapeCharacterProfile({ profile, texts: dated }, terms, { shape: 'v2' }).vi_updated_at, '2026-09-20T01:00:00.000Z');
});
```

- [ ] **Step 2: Chạy test, phải lỗi**

Run: `node --test scripts/lib/profile-source.test.mjs server/profile/lore-edit.test.mjs server/profile/shape-character-profile.test.mjs`
Expected: FAIL ở 3 test mới (không có unit voice, `voiceUnlocks` undefined, progress tính cả voice, vi_updated_at lấy ngày voice).

- [ ] **Step 3: Enum + migration**

`db/schema/profile.mjs:11`: thêm `'voice_unlock'` vào cuối mảng `loreTermKind`.

Run: `npm run db:generate` (chỉ đọc schema + snapshot, **không** nối DB).
Expected: file mới `db/migrations/0010_<tên>.sql` có đúng một dòng `ALTER TYPE "public"."lore_term_kind" ADD VALUE 'voice_unlock';`, cùng snapshot 0010 và journal. Nếu sinh thêm gì khác → dừng, báo chủ dự án.

- [ ] **Step 4: Normalizer**

`scripts/lib/profile-source.mjs`:

```js
import { assignUnlockCodes, voiceUnits } from './voice-source.mjs';
// …
export function normalizeProfileSources(raw, characterIds, { voiceCodes = new Map() } = {}) {
  // …existing setup…
  // Voice lines (spec 2026-11-19-voice-translation §4): units per character, shared unlock texts as voice_unlock terms.
  const voice = new Map(Object.entries(raw.voice ?? {}).map(([id, doc]) => [id, voiceUnits(doc)]));
  const unlockCode = assignUnlockCodes([...voice.values()].flatMap((v) => v.unlocks), voiceCodes);
  for (const [cn, code] of unlockCode) addTerm(terms, code, 'voice_unlock', cn, '');
```

Trong vòng `for (const characterId …)`, ngay sau dòng `const tea = teaFor(…)`:

```js
    const spoken = voice.get(characterId);
    if (spoken) units.push(...spoken.units);
    const voiceUnlocks = (spoken?.unlocks ?? []).map((cn) => unlockCode.get(cn));
```

và trong `structure`: `...(voiceUnlocks.length ? { voiceUnlocks } : {})` (đặt sau `...(tea ? { tea } : {})`).

- [ ] **Step 5: Importer**

`scripts/import-character-profile.mjs`:

```js
const VOICE = join(ROOT, 'public', 'data', 'voice'); // tools/build_voice_data.py output, same game build as the mp3 (r3177)

function loadRaw(masterRoot, voiceRoot = VOICE) {
  // …existing body up to the tea language file…
  // A missing index.json or <ID>.json throws ENOENT with the path, before anything is written.
  raw.voice = {};
  for (const id of JSON.parse(readFileSync(join(voiceRoot, 'index.json'), 'utf8')).ids) {
    const buffer = readFileSync(join(voiceRoot, `${id}.json`));
    raw.voice[id] = JSON.parse(buffer.toString('utf8'));
    files.push({ path: `WhmxCalc/public/data/voice/${id}.json`, sha256: sha256(buffer) });
  }
  return { raw, receipt: { sourceKind: 'masterdata', sourceVersion: 'character-profile-masterdata-v3', /* …rest unchanged… */ } };
}
```

Nhánh DB (không phải `--check`): tải `current` trước, lấy mã có sẵn, rồi mới chuẩn hoá:

```js
      const current = await loadCurrent(db);
      const voiceCodes = new Map([...current.terms.values()].filter((t) => t.kind === 'voice_unlock').map((t) => [t.nameCn, t.code]));
      const normalized = normalizeProfileSources(raw, ids, { voiceCodes });
      const plan = planProfileImport({ normalized, current });
```

`--check`: thêm vào JSON in ra `voiceUnits: normalized.profiles.reduce((n, p) => n + p.units.filter((u) => u.unitKey.startsWith('voice.')).length, 0)` và `voiceUnlocks: normalized.terms.filter((t) => t.kind === 'voice_unlock').length`.

- [ ] **Step 6: Bộ đếm**

`server/profile/lore-edit.mjs` `loreProgress`: đổi dòng bỏ qua thành
`if (/^(tea|voice)\./.test(String(r.unitKey ?? ''))) continue; // tea and voice units have their own counters`
`termUsage`: thêm `for (const code of p.structure?.voiceUnlocks ?? []) add(code, p.characterId);`

`server/profile/shape-character-profile.mjs:15`: `key.startsWith('tea.')` → `/^(tea|voice)\./.test(key)`.

- [ ] **Step 7: Chạy test + check**

Run: `node --test scripts/lib/profile-source.test.mjs server/profile/lore-edit.test.mjs server/profile/shape-character-profile.test.mjs`
Expected: PASS.

Run: `node scripts/import-character-profile.mjs --check`
Expected: `"check":"ok"`, `voiceUnits` = **6237** (6214 câu có chữ ở gói chính + 23 câu gói phụ khác chữ, đo từ `public/data/voice/` r3177), `voiceUnlocks` = **8**. Không nối DB.

- [ ] **Step 8: Báo file** (không git).

---

### Task 3: Tài liệu `voice.<hash>.json` và bộ phát hành

**Files:**
- Create: `server/profile/voice-document.mjs`
- Test: `server/profile/voice-document.test.mjs`
- Modify: `server/profile/lore-document.mjs` (thêm `VOICE_POINTER_NAME`)
- Modify: `server/profile/lore-repository.mjs` (thêm `loadVoiceDocumentInput`)
- Modify: `server/profile/lore-publisher.mjs`
- Modify: `server/profile/lore-publisher.test.mjs`

**Interfaces:**
- Produces: `buildVoiceDocument({ texts: {characterId, unitKey, vi, viOrigin, state, sourcePresent}[], unlocks: {nameCn, nameVi, viOrigin, state, sourcePresent}[] }) -> { body, hash, fileName }`; `VOICE_POINTER_NAME = 'voice.pointer.json'`; `repo.loadVoiceDocumentInput(tx)`; `publishLore` trả thêm `voice: fileName`.

- [ ] **Step 1: Viết test**

```js
// server/profile/voice-document.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVoiceDocument } from './voice-document.mjs';

const row = (unitKey, vi, o = {}) => ({ characterId: 'A0100', unitKey, vi, viOrigin: vi ? 'admin' : null, state: 'ok', sourcePresent: true, ...o });

test('only published VI, key without the voice. prefix, characters without VI left out', () => {
  const doc = JSON.parse(buildVoiceDocument({
    texts: [
      row('voice.A0100001.regardsLine', 'Gió bấc'),
      row('voice.A0100001.dropLine.1007', 'Câu riêng'),
      row('voice.A0100001.touchLine_1', null),
      row('voice.A0100001.touchLine_2', 'Cũ', { state: 'source_changed' }),
      row('voice.A0100001.touchLine_3', 'Mất', { sourcePresent: false }),
      row('voice.A0100001.touchLine_5', 'Bản cũ', { viOrigin: 'legacy_workbook' }),
      row('voice.A0200001.regardsLine', null, { characterId: 'A0200' }),
    ],
    unlocks: [
      { nameCn: '精研解锁', nameVi: 'Mở khi Tinh Nghiên', viOrigin: 'admin', state: 'ok', sourcePresent: true },
      { nameCn: '功能模块开发中', nameVi: null, viOrigin: null, state: 'ok', sourcePresent: true },
    ],
  }).body);
  assert.deepEqual(doc, {
    version: 1,
    unlock: { '精研解锁': 'Mở khi Tinh Nghiên' },
    characters: { A0100: { 'A0100001.dropLine.1007': 'Câu riêng', 'A0100001.regardsLine': 'Gió bấc' } },
  });
});

test('nothing translated still makes a valid document; same input, same file name', () => {
  const a = buildVoiceDocument({ texts: [], unlocks: [] });
  assert.deepEqual(JSON.parse(a.body), { version: 1, unlock: {}, characters: {} });
  assert.match(a.fileName, /^voice\.[0-9a-f]{12}\.json$/);
  assert.equal(buildVoiceDocument({ texts: [], unlocks: [] }).fileName, a.fileName);
});
```

Sửa `server/profile/lore-publisher.test.mjs`:
- `fakes(...)` thêm tham số `liveVoiceFile = null`; `repo` thêm `loadVoiceDocumentInput: async () => ({ texts: [], unlocks: [] })`; `readPointerFile` đổi thành `async (name) => ({ 'game.pointer.json': liveGameFile, 'voice.pointer.json': liveVoiceFile }[name] ?? livePointerFile)`.
- Test 1: danh sách thứ tự thêm `'voice.<hash>.json', 'voice.pointer.json'` trước `'state'`; danh sách cache thêm `'public, max-age=31536000, immutable', 'public, max-age=60'` ở cuối.
- Test 2: `const { file, game, voice } = await publishLore(...)` và truyền `liveVoiceFile: voice`.

- [ ] **Step 2: Chạy test, phải lỗi**

Run: `node --test server/profile/voice-document.test.mjs server/profile/lore-publisher.test.mjs`
Expected: FAIL (thiếu module; thứ tự ghi chưa có voice).

- [ ] **Step 3: Viết code**

```js
// server/profile/voice-document.mjs
// Pure: published voice-line VI → voice.<hash>.json (spec 2026-11-19-voice-translation §5). Its own file, loaded only
// by the Lồng Tiếng tab: once translated it can pass 1 MB, and the lore file is loaded on every page.
//   { version: 1, unlock: { <cn>: <vi> }, characters: { <ID>: { "<skin>.<type>[.<lang>]": <vi> } } }
import { createHash } from 'node:crypto';

import { publishableVi } from './shape-character-profile.mjs';

export function buildVoiceDocument({ texts, unlocks }) {
  const characters = {};
  for (const t of [...texts].sort((a, b) => a.characterId.localeCompare(b.characterId) || a.unitKey.localeCompare(b.unitKey))) {
    const vi = t.sourcePresent && t.unitKey.startsWith('voice.') ? publishableVi(t) : null;
    if (vi) (characters[t.characterId] ??= {})[t.unitKey.slice('voice.'.length)] = vi;
  }
  const unlock = {};
  for (const u of [...unlocks].sort((a, b) => a.nameCn.localeCompare(b.nameCn))) {
    const vi = u.sourcePresent ? publishableVi(u, 'nameVi') : null;
    if (vi) unlock[u.nameCn] = vi;
  }
  const body = JSON.stringify({ version: 1, unlock, characters });
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
  return { body, hash, fileName: `voice.${hash}.json` };
}
```

`server/profile/lore-document.mjs`: thêm `export const VOICE_POINTER_NAME = 'voice.pointer.json'; // server/profile/voice-document.mjs`.

`server/profile/lore-repository.mjs`: import `like` từ `drizzle-orm`, thêm vào object trả về:

```js
    // voice.<hash>.json input (server/profile/voice-document.mjs): voice lines and the shared unlock texts.
    async loadVoiceDocumentInput(tx) {
      return {
        texts: await selectProfileTextsWithCharacterId(tx).where(like(profileTexts.unitKey, 'voice.%')),
        unlocks: await tx.select().from(loreTerms).where(eq(loreTerms.kind, 'voice_unlock')),
      };
    },
```

`server/profile/lore-publisher.mjs`:

```js
import { buildVoiceDocument } from './voice-document.mjs';
import { GAME_POINTER_NAME, IMMUTABLE, POINTER_CACHE, POINTER_NAME, VOICE_POINTER_NAME, backupKey, buildLoreDocument, buildPointer } from './lore-document.mjs';
// …
    const voice = buildVoiceDocument(await repo.loadVoiceDocumentInput(tx));
// …
    for (const [doc, pointer] of [[lore, POINTER_NAME], [game, GAME_POINTER_NAME], [voice, VOICE_POINTER_NAME]]) {
// …both return statements gain `voice: voice.fileName`
```

Sửa chú thích đầu hàm: "the lore file, the game file and the voice file".

- [ ] **Step 4: Chạy test, phải qua**

Run: `node --test server/profile/voice-document.test.mjs server/profile/lore-publisher.test.mjs`
Expected: PASS.

- [ ] **Step 5: Báo file** (không git).

---

### Task 4: Admin — module Lồng tiếng, nút nghe, Từ điển

**Files:**
- Modify: `src/features/characters/voice/voiceView.mts` (export `GROUP_ORDER`)
- Modify: `src/admin/characters/lib/loreUnits.mts` (`Scope`, `inScope`, `voiceUnitGroups`, `LoreItem.audio`)
- Test: `src/admin/characters/lib/loreUnits.test.mts`
- Create: `src/admin/characters/components/PlayButton.tsx`
- Modify: `src/admin/characters/components/BilingualText.tsx` (prop `audio`)
- Modify: `src/admin/characters/modules/LoreModule.tsx`
- Modify: `src/admin/characters/lib/route.mts` (`MODULE_IDS` thêm `'voice'` sau `'tea'`)
- Modify: `src/admin/characters/CharacterRecord.tsx`
- Modify: `src/admin/characters/DictionaryView.tsx:48`

**Interfaces:**
- Consumes: `GROUP_OF`, `GROUP_ORDER`, `LABEL_VI`, `VoiceDoc` (`voiceView.mts`); `audioUrl`, `loadVoiceDoc` (`voiceData.mts`).
- Produces: `type Scope = 'lore' | 'tea' | 'voice'`; `inScope(unitKey, scope)`; `voiceUnitGroups(doc: VoiceDoc | null, unitKeys: string[], skinName?: (id) => string) -> { group, items: LoreItem[] }[]`.

- [ ] **Step 1: Viết test**

Thêm vào `src/admin/characters/lib/loreUnits.test.mts` (import thêm `voiceUnitGroups`):

```ts
test('inScope: three scopes by prefix', () => {
  assert.equal(inScope('voice.A0100001.regardsLine', 'voice'), true);
  assert.equal(inScope('voice.A0100001.regardsLine', 'lore'), false);
  assert.equal(inScope('voice.A0100001.regardsLine', 'tea'), false);
  assert.equal(inScope('quote', 'voice'), false);
});

test('voiceUnitGroups: groups like the tab, labels VI · CN, skin and pack names, unlock / zone, audio', () => {
  const ln = (o: object) => ({ skin: 'A0100001', type: 'regardsLine', order: 2, label: '问候', text: '北风', key: 'voice/a0100/1001/a0100001_regardsLine.mp3', ...o });
  const doc = { version: 'r3177', asset_base_url: 'https://cdn.example/', id: 'A0100', langs: [
    { lang: '1001', name: '中文-普通话', cv: '', lines: [
      ln({ type: 'levelUpLine', label: '升级' }), ln({}), ln({ type: 'touchLine_4', label: '投契之谈', unlock: '精研解锁', key: null }),
      ln({ type: 'timeLine_1', label: '时间1', zone: '6:00–18:00' }), ln({ skin: 'A0100002' }),
    ] },
    { lang: '1007', name: '古埃及语（女收藏家）', cv: '', lines: [ln({ type: 'dropLine', label: '招集' })] },
  ] };
  const keys = ['voice.A0100001.levelUpLine', 'voice.A0100001.regardsLine', 'voice.A0100001.touchLine_4', 'voice.A0100001.timeLine_1', 'voice.A0100002.regardsLine', 'voice.A0100001.dropLine.1007'];
  const g = voiceUnitGroups(doc, keys, (id) => (id === 'A0100002' ? 'Áo mới' : id));
  assert.deepEqual(g.map((x) => x.group), ['Đời thường', 'Phát triển']);
  assert.deepEqual(g[0].items, [
    { unitKey: 'voice.A0100001.regardsLine', label: 'Chào hỏi · 问候', audio: 'https://cdn.example/voice/a0100/1001/a0100001_regardsLine.mp3' },
    { unitKey: 'voice.A0100001.touchLine_4', label: 'Đầu Khế chi đàm · 投契之谈', extra: 'Mở khoá: 精研解锁' },
    { unitKey: 'voice.A0100001.timeLine_1', label: 'Trò chuyện theo giờ 1 · 时间1', extra: 'Khung giờ 6:00–18:00', audio: 'https://cdn.example/voice/a0100/1001/a0100001_regardsLine.mp3' },
    { unitKey: 'voice.A0100002.regardsLine', label: 'Chào hỏi · 问候 · Áo mới', audio: 'https://cdn.example/voice/a0100/1001/a0100001_regardsLine.mp3' },
    { unitKey: 'voice.A0100001.dropLine.1007', label: 'Chiêu mộ · 招集 · 古埃及语（女收藏家）', audio: 'https://cdn.example/voice/a0100/1001/a0100001_regardsLine.mp3' },
  ]);
  assert.deepEqual(voiceUnitGroups(null, keys), []);
  assert.deepEqual(voiceUnitGroups(doc, []), []);
});
```

(Sửa test `inScope splits tea units from lore units` có sẵn nếu TS báo lỗi kiểu; giá trị không đổi.)

- [ ] **Step 2: Chạy test, phải lỗi**

Run: `node --test src/admin/characters/lib/loreUnits.test.mts`
Expected: FAIL (`voiceUnitGroups` không có; `inScope('voice…','lore')` đang trả true).

- [ ] **Step 3: `voiceView.mts` + `loreUnits.mts`**

`voiceView.mts:19`: `const GROUP_ORDER` → `export const GROUP_ORDER`.

`loreUnits.mts`: thay dòng `inScope` và kiểu `LoreItem`:

```ts
import { audioUrl } from '../../../features/characters/voice/voiceData.mts';
import { GROUP_OF, GROUP_ORDER, LABEL_VI, type GroupId, type VoiceDoc } from '../../../features/characters/voice/voiceView.mts';

export type LoreItem = { unitKey: string; label: string; extra?: string; audio?: string };
export type Scope = 'lore' | 'tea' | 'voice';
const scopeOf = (unitKey: string): Scope => (unitKey.startsWith('tea.') ? 'tea' : unitKey.startsWith('voice.') ? 'voice' : 'lore');
export const inScope = (unitKey: string, scope: Scope) => scopeOf(unitKey) === scope;

// The Lồng tiếng module (spec 2026-11-19-voice-translation §6): the tab's groups and labels (one table, voiceView.mts),
// line order from public/data/voice/<ID>.json, a play button per line that has an mp3.
const VOICE_GROUP: Record<GroupId, string> = { daily: 'Đời thường', growth: 'Phát triển', battle: 'Chiến đấu', base: 'Căn cứ & tương tác', other: 'Khác' };
export function voiceUnitGroups(doc: VoiceDoc | null, unitKeys: string[], skinName: (id: string) => string = (id) => id) {
  if (!doc?.langs.length) return [];
  const present = new Set(unitKeys);
  const baseSkin = doc.langs[0].lines[0]?.skin;
  const by = new Map<GroupId, LoreItem[]>(GROUP_ORDER.map((g) => [g, []]));
  doc.langs.forEach((lang, i) => {
    for (const l of lang.lines) {
      const unitKey = `voice.${l.skin}.${l.type}${i ? `.${lang.lang}` : ''}`;
      if (!present.has(unitKey)) continue;
      const label = [`${LABEL_VI[l.type] ?? l.label} · ${l.label}`, l.skin !== baseSkin ? skinName(l.skin) : '', i ? lang.name : ''].filter(Boolean).join(' · ');
      const extra = l.unlock ? `Mở khoá: ${l.unlock}` : l.zone ? `Khung giờ ${l.zone}` : '';
      by.get(GROUP_OF[l.type] ?? 'other')!.push({ unitKey, label, ...(extra ? { extra } : {}), ...(l.key ? { audio: audioUrl(doc, l.key) } : {}) });
    }
  });
  return GROUP_ORDER.map((id) => ({ group: VOICE_GROUP[id], items: by.get(id)! })).filter((g) => g.items.length);
}
```

(Test cho mọi dòng chung một `key` mặc định nên `audio` giống nhau; dòng `touchLine_4` có `key: null` nên không có `audio`.)

- [ ] **Step 4: Chạy test, phải qua**

Run: `node --test src/admin/characters/lib/loreUnits.test.mts`
Expected: PASS.

- [ ] **Step 5: `PlayButton.tsx`**

```tsx
// src/admin/characters/components/PlayButton.tsx
import { useEffect, useState } from 'react';

// One player for the page (spec voice-translation §6 V3): starting a line stops the one before. The mp3 lives on R2;
// a missing file only says so — the line can still be translated.
type State = 'idle' | 'playing' | 'failed';
let player: HTMLAudioElement | null = null;
let owner: ((s: State) => void) | null = null;

export function PlayButton({ src }: { src: string }) {
  const [state, setState] = useState<State>('idle');
  useEffect(() => () => { if (owner === setState) { player?.pause(); owner = null; } }, []);
  const toggle = () => {
    const a = (player ??= new Audio());
    if (owner === setState && state === 'playing') { a.pause(); setState('idle'); return; }
    owner?.('idle');
    owner = setState;
    a.onended = () => setState('idle');
    a.onerror = () => setState('failed');
    a.src = src;
    a.play().then(() => setState('playing'), (e: unknown) => { if ((e as Error)?.name !== 'AbortError') setState('failed'); });
  };
  return (
    <button type="button" onClick={toggle} className="hover:text-(--text-main)" aria-pressed={state === 'playing'}>
      {state === 'playing' ? '■ Dừng' : state === 'failed' ? 'Không phát được' : '▶ Nghe'}
    </button>
  );
}
```

- [ ] **Step 6: `BilingualText.tsx`**

Thêm `audio?: string` vào `Props` và tham số; trong `notes`, ngay trước `<span className="ml-auto tabular-nums">`: `{audio && <PlayButton src={audio} />}`. Import `PlayButton` từ `./PlayButton`.

- [ ] **Step 7: `LoreModule.tsx`**

1. Import: `type Scope`, `voiceUnitGroups` từ `../lib/loreUnits.mts`; `loadVoiceDoc` từ `../../../features/characters/voice/voiceData.mts`; `type VoiceDoc` từ `../../../features/characters/voice/voiceView.mts`. Xoá dòng `type Scope = 'lore' | 'tea';`.
2. Bảng chữ thay cho các ternary `scope === 'tea' ? … : …` (aria-label của nav/select/section/aside, tiêu đề cột thông tin, dòng `<summary>`):

```tsx
const TEXT: Record<Scope, { name: string; pick: string; nav: string; info: string; terms: string | null; empty: string }> = {
  lore: { name: 'Lore', pick: 'Chọn đoạn lore', nav: 'Các đoạn lore', info: 'Hiện vật và thuật ngữ', terms: 'Hiện vật', empty: '' },
  tea: { name: 'Phòng trà', pick: 'Chọn đoạn phòng trà', nav: 'Các đoạn phòng trà', info: 'Trà và thuật ngữ', terms: 'Trà yêu thích', empty: 'Nhân vật này chưa có dữ liệu phòng trà.' },
  voice: { name: 'Lồng tiếng', pick: 'Chọn câu thoại', nav: 'Các câu thoại', info: 'Lịch sử gần đây', terms: null, empty: 'Nhân vật này chưa có thoại.' },
};
```

3. Tải file thoại (chỉ scope voice), sau `useEffect(() => { reload()… })`:

```tsx
  const [voiceDoc, setVoiceDoc] = useState<VoiceDoc | null | undefined>(scope === 'voice' ? undefined : null);
  useEffect(() => { if (scope === 'voice') void loadVoiceDoc(id).then(setVoiceDoc); }, [id, scope]);
```

và điều kiện chờ: `if (!lore || !record || voiceDoc === undefined) return <SkeletonRows />;`

4. Nhóm:

```tsx
  const skinName = (sid: string) => { const k = data.skins.find((x) => x.skinId === sid); return k?.skinNameVi.value || k?.skinNameCn || sid; };
  const groups = scope === 'tea' ? teaUnitGroups(lore.structure.tea, keys, lore.teaTerms ?? {})
    : scope === 'voice' ? voiceUnitGroups(voiceDoc ?? null, keys, skinName)
      : loreUnitGroups(lore.structure, keys, lore.affinity);
  const t = TEXT[scope];
  if (scope !== 'lore' && !groups.length) return <Notice className="m-4">{t.empty}</Notice>;
```

5. `termRows`: `scope === 'voice' ? [] : scope === 'tea' ? …(như cũ) : …(như cũ)`.
6. Trong `info`: bọc `<h3>{t.terms}</h3>`, ảnh, `<dl>`, và đoạn "Thuật ngữ dùng chung…" trong `{t.terms && <>…</>}`; mục "Lịch sử gần đây" giữ nguyên. Ở thanh đếm và `<summary>`: phần `· thuật ngữ x/y` chỉ hiện khi `t.terms`.
7. `<BilingualText … audio={i.audio} />`.

- [ ] **Step 8: Route, CharacterRecord, Từ điển**

`route.mts:1`: `['overview', 'lore', 'tea', 'voice', 'build', 'skins', 'source', 'history']`.

`CharacterRecord.tsx`: `const VoiceModule = (props: ModuleProps) => <LoreModule {...props} scope="voice" />;` và thêm `{ id: 'voice', label: 'Lồng tiếng', Component: VoiceModule },` ngay sau dòng `tea`.

`DictionaryView.tsx:48`: `['tea', 'Trà'], ['tea_text', 'Phòng trà'], ['voice_unlock', 'Lồng tiếng'],`.

- [ ] **Step 9: Kiểm**

Run: `npm test` → toàn bộ PASS (kể cả `route.test.mts` nếu có so danh sách module — sửa giá trị mong đợi nếu có).
Run: `npx tsc --noEmit -p .` → không lỗi.

- [ ] **Step 10: Báo file** (không git).

---

### Task 5: Web — tab Lồng Tiếng hiện câu Việt

**Files:**
- Modify: `src/features/profile/api/loreOverlay.mts` (export `loadPointed`)
- Modify: `src/features/characters/voice/voiceData.mts` (`loadVoiceVi`, `loadVoiceViCached`)
- Modify: `src/features/characters/voice/voiceView.mts` (`VoiceTr`, `Take.cn`, `groupsOf(lang, skin, tr?)`)
- Modify: `src/features/characters/voice/VoiceTab.tsx`
- Modify: `src/features/characters/styles/voiceTab.css`
- Test: `src/features/characters/voice/voiceView.test.mts`

**Interfaces:**
- Consumes: tài liệu Task 3 (`{version:1, unlock, characters}`).
- Produces: `type VoiceVi = { version: 1; unlock: Record<string,string>; characters: Record<string, Record<string,string>> }`; `loadVoiceVi(lorePointerUrl?, fetchImpl?, timeoutMs?) -> Promise<VoiceVi | null>`; `type VoiceTr = { vi: Record<string,string>; unlock: Record<string,string>; main: VoiceLang }`; `Take` thêm `cn: string`, còn `text` giờ là câu Việt nếu có (ghi chú: spec §7 gọi là `vi`, nhưng `Take.vi` đã là nhãn loại câu nên giữ `text` = `pick(vi, cn)`).

- [ ] **Step 1: Viết test**

Thêm vào `voiceView.test.mts` (import thêm `loadVoiceVi`):

```ts
test('VI: main key; an alt pack uses its own key, else the main VI when its CN is the same; else CN', () => {
  const alt: VoiceLang = { lang: '1007', name: '古埃及语（女收藏家）', cv: '', lines: [
    ln({ type: 'dropLine', order: 1, label: '招集', text: '另一句。' }),
    ln({ text: ' 今日吹的是北风。 ' }),
  ] };
  const tr = { vi: { 'A0100001.regardsLine': 'Gió bấc.', 'A0100001.dropLine': 'Ta là…' }, unlock: { '感应达到投契解锁': 'Mở khi Đầu Khế' }, main: lang };
  const [daily] = groupsOf(lang, 'A0100001', tr);
  assert.deepEqual(daily.takes[1].text, { text: 'Gió bấc.', untranslated: false });
  assert.equal(daily.takes[1].cn, '今日吹的是北风。');
  assert.deepEqual(daily.takes[2].unlock, { text: 'Mở khi Đầu Khế', untranslated: false });
  const [a] = groupsOf(alt, 'A0100001', tr);
  assert.deepEqual(a.takes[0].text, { text: '另一句。', untranslated: true }); // different CN, no .1007 key
  assert.deepEqual(a.takes[1].text, { text: 'Gió bấc.', untranslated: false }); // same CN (trimmed) → main VI
  const own = groupsOf(alt, 'A0100001', { ...tr, vi: { ...tr.vi, 'A0100001.dropLine.1007': 'Câu riêng' } })[0];
  assert.deepEqual(own.takes[0].text, { text: 'Câu riêng', untranslated: false });
  assert.deepEqual(groupsOf(lang, 'A0100001')[0].takes[1].text, { text: '今日吹的是北风。', untranslated: true }); // no file
});

test('loadVoiceVi: pointer next to the lore pointer → file; any failure → null', async () => {
  const doc = { version: 1, unlock: {}, characters: { A0100: { 'A0100001.regardsLine': 'Gió bấc.' } } };
  const seen: string[] = [];
  const ok = (async (url: string) => { seen.push(url); return new Response(JSON.stringify(url.endsWith('voice.pointer.json') ? { file: 'voice.0123456789ab.json' } : doc)); }) as typeof fetch;
  assert.deepEqual(await loadVoiceVi('https://cdn.example/lore/lore.pointer.json', ok), doc);
  assert.deepEqual(seen, ['https://cdn.example/lore/voice.pointer.json', 'https://cdn.example/lore/voice.0123456789ab.json']);
  const missing = (async () => new Response('', { status: 404 })) as typeof fetch;
  assert.equal(await loadVoiceVi('https://cdn.example/lore/lore.pointer.json', missing), null);
  assert.equal(await loadVoiceVi(undefined, ok), null);
});
```

- [ ] **Step 2: Chạy test, phải lỗi**

Run: `node --test src/features/characters/voice/voiceView.test.mts`
Expected: FAIL (`loadVoiceVi` không có; `cn` undefined).

- [ ] **Step 3: `loreOverlay.mts`**

`async function loadPointed<T>(` → `export async function loadPointed<T>(`.

- [ ] **Step 4: `voiceData.mts`**

```ts
import { loadPointed } from '../../profile/api/loreOverlay.mts';

// Published VI (server/profile/voice-document.mjs), next to the lore pointer. Any failure → null: the tab keeps the CN.
export type VoiceVi = { version: 1; unlock: Record<string, string>; characters: Record<string, Record<string, string>> };
const isMap = (v: unknown) => typeof v === 'object' && v !== null;
export function loadVoiceVi(lorePointerUrl?: string, fetchImpl: typeof fetch = fetch, timeoutMs = 20000): Promise<VoiceVi | null> {
  const pointerUrl = lorePointerUrl ? new URL('voice.pointer.json', lorePointerUrl).toString() : undefined;
  return loadPointed(pointerUrl, /^voice\.[0-9a-f]{12}\.json$/, (d) => d?.version === 1 && isMap(d.unlock) && isMap(d.characters), fetchImpl, timeoutMs, 'voice');
}
// ponytail: one request per page load, shared by every character.
let viCached: Promise<VoiceVi | null> | null = null;
export const loadVoiceViCached = (lorePointerUrl?: string) => (viCached ??= loadVoiceVi(lorePointerUrl));
```

- [ ] **Step 5: `voiceView.mts`**

```ts
export type Take = { n: number; line: VoiceLine; vi: string; text: LoreUnit | null; cn: string; unlock: LoreUnit | null; zone: string; playable: boolean };
/** Published VI for one character (spec voice-translation §7): `main` is the pack the unprefixed keys belong to. */
export type VoiceTr = { vi: Record<string, string>; unlock: Record<string, string>; main: VoiceLang };

export function groupsOf(lang: VoiceLang, skin: string, tr?: VoiceTr | null): Group[] {
  // An alt pack without its own key shares the main pack's VI when the CN is the same (V1; importer trims too).
  const mainCn = new Map((tr?.main.lines ?? []).map((l) => [`${l.skin}.${l.type}`, l.text.trim()]));
  const viOf = (l: VoiceLine) => {
    if (!tr) return '';
    const base = `${l.skin}.${l.type}`;
    if (lang.lang === tr.main.lang) return tr.vi[base] ?? '';
    return tr.vi[`${base}.${lang.lang}`] ?? (mainCn.get(base) === l.text.trim() ? tr.vi[base] ?? '' : '');
  };
  // …existing grouping; the take becomes:
  //   n: ++n, line, vi: LABEL_VI[line.type] ?? line.label,
  //   text: pick(viOf(line), line.text), cn: line.text,
  //   unlock: pick(tr?.unlock[line.unlock ?? ''] ?? '', line.unlock ?? ''),
  //   zone: line.zone ?? '', playable: !!line.key,
}
```

- [ ] **Step 6: Chạy test, phải qua**

Run: `node --test src/features/characters/voice/voiceView.test.mts`
Expected: PASS (8 tests).

- [ ] **Step 7: `VoiceTab.tsx`**

1. Import `loadVoiceViCached`, `type VoiceVi` từ `./voiceData.mts`.
2. State + tải (không chặn trang):

```tsx
  const [tr, setTr] = useState<VoiceVi | null>(null);
  useEffect(() => {
    let live = true;
    void loadVoiceViCached(import.meta.env.VITE_LORE_POINTER_URL).then((v) => { if (live) setTr(v); });
    return () => { live = false; };
  }, []);
```

3. `const groups = groupsOf(lang, sk, tr && { vi: tr.characters[doc.id] ?? {}, unlock: tr.unlock, main: doc.langs[0] });`
4. Câu đang phát lấy bản mới nhất, để bản dịch tới sau vẽ lại mà không dừng tiếng: `const shown = take ? groups.flatMap((g) => g.takes).find((x) => x.n === take.n) ?? take : null;` và thay `take` bằng `shown` trong khối `.voice-read` (dòng `voice-row` và câu).
5. Màn phát (V4):

```tsx
          {failed ? <p className="voice-msg">{s('voiceFail')}</p>
            : shown?.text ? <>
                <Text unit={shown.text} as="p" className="voice-line" />
                {!shown.text.untranslated && <p className="voice-cn" lang="zh">{shown.cn}</p>}
              </>
              : <p className="voice-msg">{shown ? s('voiceNoText') : s('voiceHint')}</p>}
```

Dòng trong danh sách giữ `<Text unit={t.text} … />` — tự hiện câu Việt, hoặc câu Trung + "chưa dịch".

- [ ] **Step 8: `voiceTab.css`**

```css
.voice-line { font: 500 20px/1.6 var(--font-serif); min-height: 64px; margin: 0; }
.voice-line:has(+ .voice-cn) { min-height: 0; }
.voice-cn { margin: 0; font: 400 15px/1.6 'Noto Serif SC', var(--font-serif); color: var(--text-muted); }
.voice-text { /* đổi font-family đầu dòng thành var(--font-serif) */ }
.voice-line[lang="zh"], .voice-text[lang="zh"] { font-family: 'Noto Serif SC', var(--font-serif); }
```

(Thay dòng `.voice-line` cũ; ở `.voice-text` đổi `'Noto Serif SC', var(--font-serif)` thành `var(--font-serif)`. Lý do: `Text` gắn `lang="zh"` cho câu chưa dịch, nên chữ Việt dùng font serif chung, còn chữ Trung giữ Noto Serif SC.)

- [ ] **Step 9: Kiểm**

Run: `npm test` → PASS. Run: `npx tsc --noEmit -p .` → không lỗi.

- [ ] **Step 10: Báo file** (không git).

---

### Task 6: Chạy thật trên development (cần đồng ý từng bước DB)

- [ ] **Step 1:** `node scripts/import-character-profile.mjs --check` → in `voiceUnits` 6237, `voiceUnlocks` 8.
- [ ] **Step 2 — hỏi chủ dự án:** "Chạy migration 0010 trên development?" → khi có "đồng ý": `npm run db:migrate` (development).
- [ ] **Step 3:** `node --env-file=.env.local scripts/import-character-profile.mjs` (plan, chỉ đọc) → báo số `textInserts`, `terms` mới (8 `VOICE_UNLOCK_*`), 138 profile `update` (vì thêm `voiceUnlocks`).
- [ ] **Step 4 — hỏi chủ dự án:** "Chạy importer `--apply` trên development?" → khi có "đồng ý": thêm `--apply`.
- [ ] **Step 5:** Mở dev 3003, Admin → một Khí giả → module **Lồng tiếng**:
  - đủ 4 nhóm, nhãn `Chào hỏi · 问候`, câu trang phục khác có tên trang phục, câu gói phụ có tên gói;
  - ▶ Nghe phát mp3 từ R2, bấm câu khác thì câu trước dừng; file thiếu hiện "Không phát được";
  - chủ dự án nhập một bản dịch thử (Claude không gõ VI), Lưu → tiến độ x/y tăng; bộ đếm Lore và "Mới dịch" không đổi;
  - Từ điển → Lore → loại "Lồng tiếng" có 8 câu, mỗi câu ghi số Khí giả dùng.
- [ ] **Step 6:** Xuất bản trên development (nút "Xuất bản ngay") → R2 development có `voice.<hash>.json` + `voice.pointer.json`.
- [ ] **Step 7:** Tab `/characters/<slug>/voice` trên dev ở 1440 và 390: câu đã dịch hiện chữ Việt 20px, câu Trung 15px bên dưới; câu chưa dịch giữ như cũ; bấm phát một câu rồi tải lại trang khi tài liệu chưa về → câu đổi sang Việt mà tiếng không dừng (Review Focus 4); không tràn ngang, không lỗi console.
- [ ] **Step 8 — production, mỗi bước hỏi riêng:** migration 0010 → importer `--apply` → lần phát hành đầu.
- [ ] **Step 9:** Báo lại tất cả file đã đổi, chờ chủ dự án quyết commit.
