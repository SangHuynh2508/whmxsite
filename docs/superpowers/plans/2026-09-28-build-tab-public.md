# Public Build tab (direction C) + rotation notes — Implementation Plan

> **Status: done — executed 2026-09-28 (native, TDD per task), final review fixes `b970d83`, live and verified on production.** Rulings and deferred minors are in `docs/WHMX_CURRENT_STATE_FINAL_2026-10-04.md` §2.1 / §8. The state file this plan names was renamed `…_2026-09-28.md` after execution.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render published builds as the approved direction-C build sheet and let a rotation carry a note per rotation and per step.

**Architecture:** The build document's `rotations` become `{ label, note, steps: [{ skillId, note }] }`; a pure `withSteps` converts the old `skillIds` shape wherever `withDeepens` already converts old documents (validator, admin read, game document). The public tab keeps its island mount; the pure view model (`buildView.mts`) gains frame/emblem/serial/tag fields, a pure `sheetLayout.mts` decides spans, and one React component per block renders inside a shared `Block` that has an `action` slot for later public edit buttons.

**Tech Stack:** Node `node --test` (JS + `.mts` type stripping), React 19 + TypeScript island (Vite), plain CSS with site tokens, admin React + Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-28-build-tab-public-design.md` (visual: `docs/public-redesign/build-tab/direction-approved.md`, demo `docs/public-redesign/build-tab/design-demos/direction-c-sheet.html`).

## Global Constraints

- Colours only from `src/styles/tokens.css` variables; no hex in new CSS.
- Dark interface only (PRODUCT.md); no horizontal page scroll at 390 px.
- One corner radius: 6 px. Headings plain (no numbers, no uppercase tracked eyebrows). UI text ≥ 12 px.
- Untranslated game names = CN + dot (`build-cn` class), as today.
- Limits: rotation `label` ≤ 60, rotation `note` ≤ 500, step `note` ≤ 60.
- Skill tags: `skill1` ATK, `skill6` SKILL, `skill2` ULT, `skill3/4/5` P1/P2/P3, any other slot → the skill's type text.
- Pair 1 = weapons 4 | affixes 8 while weapons ≤ 2, tiers ≤ 3, each tier ≤ 5 items; pair 2 = rotations 6 | deepens 6 while deepens ≤ 3, rotations ≤ 2, each ≤ 5 steps, no rotation note; otherwise 12 (spec C1, after `/impeccable critique` 22/40).
- Critique fixes in scope (spec §4.1): variant chips, phone fixes, popover cue/close/bottom sheet, tag key + a11y labels, demoted build name. Tips and teams always 12. `teamSpan = min(6, max(2, members, ceil(label/9), ceil(note/30)))`.
- Never write to production DB/R2, never push, without the owner's yes. Commit author is the owner's local git config. Never add files under `api/`.

## Review Focus

- Production game document still holds `skillIds` until the next publish → the public tab must show those rotations (steps without notes). Pinned in Task 3.
- Admin tips textarea keeps empty lines (`''` entries survive validation) → no empty bullets, and an all-empty tips list hides the block. Pinned in Task 3 + Task 4.
- A rotation with a note but whose skills are all unknown (character data changed) → still shown with its label and note; a rotation note always breaks pair 2. Pinned in Task 4.
- The same skill twice in one rotation (SKILL › ULT › SKILL) → both steps kept, each with its own note. Pinned in Task 1 and Task 3.
- A style or weapon without an icon (`icon: null`) → no broken image: empty `icon` string, the frame still renders. Pinned in Task 3.

---

### Task 1: Rotation steps in the build document (server)

**Files:**
- Modify: `server/builds/build-validate.mjs` (add `withSteps`, `normalizeBuild`; rotations block lines 104–107)
- Modify: `server/builds/build-editor.mjs:5,25` (use `normalizeBuild`)
- Modify: `server/game/game-document.mjs:11,22,40` (use `normalizeBuild`)
- Test: `server/builds/build-validate.test.mjs`, `server/game/game-document.test.mjs`

**Interfaces:**
- Produces: `withSteps(doc)`, `normalizeBuild(doc) = withSteps(withDeepens(doc))` exported from `server/builds/build-validate.mjs`; validated rotation shape `{ label: string, note: string, steps: { skillId: string, note: string }[] }`; error paths `rotations.<i>.note`, `rotations.<i>.steps.<j>`, `rotations.<i>.steps.<j>.skillId`, `rotations.<i>.steps.<j>.note`.

- [ ] **Step 1: Write the failing tests** — in `server/builds/build-validate.test.mjs` change the import to `import { normalizeBuild, validateBuild, withDeepens, withSteps } from './build-validate.mjs';`, replace the line asserting `'rotations.0.skillIds.0 UNKNOWN_SKILL'` (line 79) with the steps form, and append:

```js
test('rotations: steps with notes; old `skillIds` rotations become steps (spec 2026-09-28 §3.1)', () => {
  assert.deepEqual(withSteps({ rotations: [{ label: 'x', skillIds: ['D001701', 'D001701'] }] }).rotations,
    [{ label: 'x', note: '', steps: [{ skillId: 'D001701', note: '' }, { skillId: 'D001701', note: '' }] }]);
  const doc = { rotations: [{ label: 'x', note: '', steps: [] }] };
  assert.equal(withSteps(doc), doc); // already new: untouched
  assert.deepEqual(normalizeBuild({ deepen: null, rotations: [{ label: '', skillIds: [] }] }),
    { deepens: [], rotations: [{ label: '', note: '', steps: [] }] });

  const { errors, doc: out } = validateBuild(build({ rotations: [{ label: ' Lượt đầu ', note: ' Tam Trí ', steps: [
    { skillId: 'D001702', note: ' dùng lên Thố Động ' }, { skillId: 'D001702', note: '' }] }] }), ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual(out.rotations, [{ label: 'Lượt đầu', note: 'Tam Trí', steps: [{ skillId: 'D001702', note: 'dùng lên Thố Động' }, { skillId: 'D001702', note: '' }] }]);
  // a document saved before 2026-09-28 still validates and comes out in the new shape
  assert.deepEqual(validateBuild(build(), ctx).doc.rotations, [{ label: '0 dupe', note: '', steps: [{ skillId: 'D001701', note: '' }, { skillId: 'D001702', note: '' }] }]);
});

test('rotations: note ≤ 500, step note ≤ 60, a step must be an object with a skill of the character', () => {
  const r = (patch) => ({ rotations: [{ label: '', note: '', steps: [{ skillId: 'D001701', note: '' }], ...patch }] });
  assert.deepEqual(codes(r({ note: 'a'.repeat(501) })), ['rotations.0.note TOO_LONG']);
  assert.deepEqual(codes(r({ steps: [{ skillId: 'D001701', note: 'a'.repeat(61) }] })), ['rotations.0.steps.0.note TOO_LONG']);
  assert.deepEqual(codes(r({ steps: ['D001701'] })), ['rotations.0.steps.0 BAD_SHAPE']);
  assert.deepEqual(codes(r({ steps: 'D001701' })), ['rotations.0.steps BAD_SHAPE']);
});
```

and the replaced line 79:

```js
  assert.deepEqual(codes({ rotations: [{ label: '', skillIds: ['A000101'] }] }), ['rotations.0.steps.0.skillId UNKNOWN_SKILL']);
```

In `server/game/game-document.test.mjs` append (reuse that file's existing `refs`, `texts` fixtures and import; add `build` fixture inline):

```js
test('a build saved before 2026-09-28 is published with rotation steps', () => {
  const builds = [{ characterId: 'D0017', position: 0, doc: { name: 'Cũ', weapons: [], affixes: { groups: [] }, deepens: [], rotations: [{ label: '0 dupe', skillIds: ['D001701'] }] } }];
  const doc = JSON.parse(buildGameDocument({ refs, texts, builds }).body);
  assert.deepEqual(doc.builds.D0017[0].rotations, [{ label: '0 dupe', note: '', steps: [{ skillId: 'D001701', note: '' }] }]);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test server/builds/build-validate.test.mjs server/game/game-document.test.mjs`
Expected: FAIL (`withSteps` / `normalizeBuild` not exported; rotations still `skillIds`).

- [ ] **Step 3: Implement** — in `server/builds/build-validate.mjs`, after `withDeepens`:

```js
// Rotations saved before 2026-09-28 hold `skillIds`: read, saved and published as `steps` with notes (spec 2026-09-28
// §3.1). A non-array `skillIds` is passed through as `steps` so the validator reports it.
const oldRotation = (r) => isObject(r) && 'skillIds' in r && !('steps' in r);
export function withSteps(doc) {
  if (!isObject(doc) || !Array.isArray(doc.rotations) || !doc.rotations.some(oldRotation)) return doc;
  return {
    ...doc,
    rotations: doc.rotations.map((r) => (oldRotation(r)
      ? { label: r.label ?? '', note: r.note ?? '', steps: Array.isArray(r.skillIds) ? r.skillIds.map((skillId) => ({ skillId, note: '' })) : r.skillIds }
      : r)),
  };
}

// Every stored or published build goes through this: the validator, the admin read and the game document.
export const normalizeBuild = (doc) => withSteps(withDeepens(doc));
```

In `validateBuild` replace `input = withDeepens(input);` with `input = normalizeBuild(input);` and replace the `rotations:` entry of `doc` with:

```js
    rotations: list(input.rotations, 'rotations').map((r, i) => ({
      label: str(r?.label, `rotations.${i}.label`, LIMITS.label),
      note: str(r?.note, `rotations.${i}.note`, LIMITS.note),
      steps: list(r?.steps, `rotations.${i}.steps`).map((s, j) => {
        const at = `rotations.${i}.steps.${j}`;
        if (!isObject(s)) { fail(at, 'BAD_SHAPE'); return null; }
        const skillId = String(s.skillId ?? '');
        if (!skills.has(skillId)) fail(`${at}.skillId`, 'UNKNOWN_SKILL');
        return { skillId, note: str(s.note, `${at}.note`, LIMITS.label) };
      }).filter(Boolean),
    })),
```

In `server/builds/build-editor.mjs` change the import to `normalizeBuild` and line 25 `doc: withDeepens(b.doc)` → `doc: normalizeBuild(b.doc)`. In `server/game/game-document.mjs` import `normalizeBuild` instead of `withDeepens`, use `normalizeBuild(doc).deepens` in `usedByBuilds` and `push(normalizeBuild(doc))` in `buildGameDocument`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test`
Expected: all pass (the existing `withDeepens` tests unchanged).

- [ ] **Step 5: Commit** (ask the owner once whether per-task commits are fine; if yes:)

```bash
git add server/builds/build-validate.mjs server/builds/build-validate.test.mjs server/builds/build-editor.mjs server/game/game-document.mjs server/game/game-document.test.mjs
git commit -m "feat(build): rotation steps with notes; old skillIds rotations converted on read/save/publish"
```

---

### Task 2: Admin reads/writes rotation steps with notes (minimal)

**Files:**
- Modify: `src/admin/characters/lib/buildDoc.mts:9` (types)
- Modify: `src/admin/characters/modules/BuildModule.tsx:225-238` (rotation editor)
- Test: `src/admin/characters/lib/buildDoc.test.mts`

**Interfaces:**
- Consumes: server shape from Task 1 (`GET /api/admin/builds/characters/:id` returns normalized docs).
- Produces: `export type Step = { skillId: string; note: string }`, `export type Rotation = { label: string; note: string; steps: Step[] }`, `BuildDoc.rotations: Rotation[]`.

- [ ] **Step 1: Write the failing test** — append to `src/admin/characters/lib/buildDoc.test.mts`:

```ts
test('server errors inside a rotation step name the rotation', () => {
  assert.deepEqual(buildErrors([{ path: 'rotations.1.steps.0.note', code: 'TOO_LONG' }, { path: 'rotations.0.steps.2.skillId', code: 'UNKNOWN_SKILL' }]),
    ['Xoay vòng 2: quá dài', 'Xoay vòng 1: kỹ năng không thuộc nhân vật']);
});

test('a rotation is { label, note, steps }', () => {
  const doc: BuildDoc = { ...emptyBuild(null), rotations: [{ label: 'Lượt đầu', note: '', steps: [{ skillId: 'V005502', note: '' }] }] };
  assert.equal(doc.rotations[0].steps[0].skillId, 'V005502');
});
```

(add `type BuildDoc` to the file's import from `./buildDoc.mts`).

- [ ] **Step 2: Run to see it fail**

Run: `node --test src/admin/characters/lib/buildDoc.test.mts`
Expected: the type test fails type-stripping only at `tsc`; the runtime assertion passes already — so also run `npx tsc --noEmit -p tsconfig.json` and expect an error on `steps` not existing in the rotation type. (Record any pre-existing tsc errors first so only new ones count.)

- [ ] **Step 3: Implement** — `buildDoc.mts`:

```ts
export type Step = { skillId: string; note: string };
export type Rotation = { label: string; note: string; steps: Step[] }; // notes: owner 2026-09-28 (新月's V0055 card)
```

and in `BuildDoc` replace `rotations: { label: string; skillIds: string[] }[];` with `rotations: Rotation[];`.

`BuildModule.tsx`, replace the rotation block (the `draft.rotations.map` body and the "+ Thêm xoay vòng" button) with:

```tsx
          {draft.rotations.map((r, i) => {
            const set = (patch: Partial<typeof r>) => upd({ rotations: draft.rotations.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            const setStep = (k: number, note: string) => set({ steps: r.steps.map((s, j) => (j === k ? { ...s, note } : s)) });
            return (
              <div key={i} className="mb-3 grid gap-2 border-b border-(--border-color) pb-3">
                <span className="flex gap-2">
                  <input aria-label={`Nhãn xoay vòng ${i + 1}`} className={cn(inputClass, 'h-9')} value={r.label} maxLength={60} placeholder="Lượt đầu, Tam Trí…" onChange={(e) => set({ label: e.target.value })} />
                  <Button variant="ghost" onClick={() => upd({ rotations: draft.rotations.filter((_, j) => j !== i) })}>Bỏ</Button>
                </span>
                <textarea aria-label={`Ghi chú xoay vòng ${i + 1}`} className={cn(inputClass, 'min-h-16 py-2')} value={r.note} maxLength={500} placeholder="Ghi chú cho cả vòng (tuỳ chọn): điều kiện, lượt đầu…" onChange={(e) => set({ note: e.target.value })} />
                <Chips items={r.steps.map((s) => [s.skillId, skillName(s.skillId)])} onRemove={(k) => set({ steps: r.steps.filter((_, j) => j !== k) })} onMove={(k, d) => set({ steps: move(r.steps, k, d) })} />
                {r.steps.map((s, k) => (
                  <label key={k} className="flex items-center gap-2 text-xs text-(--text-muted)">
                    <span className="w-44 truncate">{k + 1}. {skillName(s.skillId)}</span>
                    <input aria-label={`Ghi chú bước ${k + 1} của xoay vòng ${i + 1}`} className={cn(inputClass, 'h-8')} value={s.note} maxLength={60} placeholder="Ghi chú bước (tuỳ chọn), vd: dùng lên Thố Động" onChange={(e) => setStep(k, e.target.value)} />
                  </label>
                ))}
                <Adder label="Thêm kỹ năng…" options={site.skills.map((s) => [s.id, s.name])} onAdd={(s) => set({ steps: [...r.steps, { skillId: s, note: '' }] })} />
              </div>
            );
          })}
          <Button onClick={() => upd({ rotations: [...draft.rotations, { label: '', note: '', steps: [] }] })}>+ Thêm xoay vòng</Button>
```

- [ ] **Step 4: Run tests + types**

Run: `npm test` then `npx tsc --noEmit -p tsconfig.json`
Expected: tests pass; no new tsc errors compared with Step 2's record.

- [ ] **Step 5: Commit**

```bash
git add src/admin/characters/lib/buildDoc.mts src/admin/characters/lib/buildDoc.test.mts src/admin/characters/modules/BuildModule.tsx
git commit -m "feat(admin): rotation and step notes in the Build module"
```

---

### Task 3: View model — frames, emblems, serials, step tags, notes (+ assets)

**Files:**
- Modify: `src/features/characters/build/buildView.mts`
- Test: `src/features/characters/build/buildView.test.mts`
- Create (copy): `public/assets/styles/Speciality_{101,102,103,201,202,203,301,302,303,401,402,403,501,502,503}.png`, `public/assets/frames/itemRare{2,3,4,5,K}.png`

**Interfaces:**
- Consumes: published docs (new or old rotation shape), `game.refs.job_style.<id>.icon` (e.g. `"Speciality_401"`), data.json skills `{ group_id, slot, levels: [{ name_vi, name_cn, icon, type }] }`.
- Produces (additions to `BuildView`): `weapons[].frame: string`, `weapons[].variant: string`, `weapons[].labelRest: string` (skills with empty name+text dropped); `deepens[].variant: string`; `variantOf(label: string, variants: string[]): { variant: string; rest: string }`; `deepens[].icon: string`, `deepens[].serial: string`; `rotations[]: { label: string; note: string; steps: { id: string; name: string; type: string; tag: string; icon: string; note: string }[] }` (replaces `skills`); `tips` without empty entries.

- [ ] **Step 1: Copy the assets**

```bash
src=/d/BaiTapCode/WHMX/NeoArtifacts/Assets/Packet61_AllSprites/cf505fca6c96071b630baedc779241f6
mkdir -p public/assets/styles && cp $src/Speciality_*.png public/assets/styles/ && ls public/assets/styles | wc -l   # 15
cp docs/public-redesign/build-tab/design-demos/assets/itemRare{2,3,4,5,K}.png public/assets/frames/
```

- [ ] **Step 2: Write the failing tests** — in `buildView.test.mts` change the import to `import { buildViews, variantOf } from './buildView.mts';`, add `icon: 'Speciality_102'` to `refs.job_style.102`, give D0017 two skills with slots (`{ group_id: 'D001701', slot: 'skill1', levels: [{ name_vi: 'Bát Dứu', icon: 'assets/skills/a.png', type: 'Đánh Thường' }] }`, `{ group_id: 'D001702', slot: 'skill6', levels: [{ name_vi: 'Hộ', icon: '', type: 'Kỹ Năng Nghề' }] }`), set `doc.tips = ['Mở khiên', '']`, add `frame: '/assets/frames/itemRare3.png', variant: '', labelRest: 'Chịu đòn'` to the expected weapon in the first test, and replace the rotations test with:

```ts
test('rotations: steps with their slot tag, type, icon and notes; a rotation note is kept', () => {
  const rotations = [{ label: 'Lượt đầu', note: 'Tam Trí', steps: [
    { skillId: 'D001702', note: 'dùng lên Thố Động' }, { skillId: 'X', note: '' }, { skillId: 'D001701', note: '' }, { skillId: 'D001702', note: '' }] }];
  const [v] = buildViews([{ ...doc, rotations }], game, characters, 'D0017');
  assert.deepEqual(v.rotations, [{ label: 'Lượt đầu', note: 'Tam Trí', steps: [
    { id: 'D001702', name: 'Hộ', type: 'Kỹ Năng Nghề', tag: 'SKILL', icon: '', note: 'dùng lên Thố Động' },
    { id: 'D001701', name: 'Bát Dứu', type: 'Đánh Thường', tag: 'ATK', icon: '/assets/skills/a.png', note: '' },
    { id: 'D001702', name: 'Hộ', type: 'Kỹ Năng Nghề', tag: 'SKILL', icon: '', note: '' },
  ] }]);
});

test('rotations published before 2026-09-28 (`skillIds`) show as steps without notes', () => {
  const [v] = buildViews([doc], game, characters, 'D0017'); // doc.rotations = [{ label: '0 dupe', skillIds: ['D001701', 'X'] }]
  assert.deepEqual(v.rotations, [{ label: '0 dupe', note: '', steps: [{ id: 'D001701', name: 'Bát Dứu', type: 'Đánh Thường', tag: 'ATK', icon: '/assets/skills/a.png', note: '' }] }]);
});

test('深造 emblem + serial; a style without an icon gets no image; empty tips are dropped', () => {
  const [v] = buildViews([doc], game, characters, 'D0017');
  assert.deepEqual(v.deepens.map((d) => [d.icon, d.serial]), [['/assets/styles/Speciality_102.png', '2000'], ['/assets/styles/Speciality_102.png', '0700']]);
  const noIcon = { ...game, refs: { ...game.refs, job_style: { 102: { sectorIds: ['D2_01'] } } } };
  assert.equal(buildViews([doc], noIcon, characters, 'D0017')[0].deepens[0].icon, '');
  assert.deepEqual(v.tips, ['Mở khiên']);
});

test('variantOf: a weapon label names a 深造 variant exactly or as a prefix + separator; longest wins', () => {
  const v = ['Chuẩn', 'Lục Trí', 'Lục Trí 2'];
  assert.deepEqual(variantOf('Lục Trí, đơn mục tiêu', v), { variant: 'Lục Trí', rest: 'đơn mục tiêu' });
  assert.deepEqual(variantOf('Chuẩn', v), { variant: 'Chuẩn', rest: '' });
  assert.deepEqual(variantOf('Lục Trí 2 | hồi năng', v), { variant: 'Lục Trí 2', rest: 'hồi năng' });
  assert.deepEqual(variantOf('Tốc độ | Sát thương', v), { variant: '', rest: 'Tốc độ | Sát thương' });
  assert.deepEqual(variantOf('Chuẩnxác', v), { variant: '', rest: 'Chuẩnxác' }); // no separator → not a variant
  assert.deepEqual(variantOf('Lục Trí', []), { variant: '', rest: 'Lục Trí' });
});

test('weapons carry their variant chip; 深造 are variants; empty weapon skills are dropped', () => {
  const w = { ...game.refs.weapon[30111], skillIds: ['ED2031', 'EMPTY'] };
  const g = { ...game, refs: { ...game.refs, weapon: { 30111: w } }, texts: { ...game.texts, weapon_skill: { ...game.texts.weapon_skill, EMPTY: { cn: '', vi: null, detail: '', detail_vi: null } } } };
  const [v] = buildViews([{ ...doc, weapons: [{ weaponId: '30111', label: 'Lục Trí, đơn mục tiêu' }] }], g, characters, 'D0017');
  assert.deepEqual([v.weapons[0].variant, v.weapons[0].labelRest, v.weapons[0].skills.length], ['Lục Trí', 'đơn mục tiêu', 1]);
  assert.deepEqual(v.deepens.map((d) => d.variant), ['Chuẩn', 'Lục Trí']);
});

test('weapon frame: itemRare{2..5}, itemRareK for anything else', () => {
  const odd = { ...game, refs: { ...game.refs, weapon: { 30111: { ...game.refs.weapon[30111], rare: 7 } } } };
  assert.equal(buildViews([doc], odd, characters, 'D0017')[0].weapons[0].frame, '/assets/frames/itemRareK.png');
});
```

- [ ] **Step 3: Run to see them fail**

Run: `node --test src/features/characters/build/buildView.test.mts`
Expected: FAIL (no `frame`, `icon`, `serial`, `steps`; empty tip kept).

- [ ] **Step 4: Implement** — in `buildView.mts`:

```ts
type Step = { skillId: string; note?: string };
type Rotation = { label: string; note?: string; steps?: Step[]; skillIds?: string[] }; // skillIds: published before 2026-09-28
```

In `Doc` use `rotations?: Rotation[];`. Extend `SiteCharacter.skills` items with `slot?: string` and levels with `type?: string`. Add:

```ts
// Skill slot (data.json) → the short tag under a rotation step (owner 2026-09-28).
const TAGS: Record<string, string> = { skill1: 'ATK', skill6: 'SKILL', skill2: 'ULT', skill3: 'P1', skill4: 'P2', skill5: 'P3' };
const frameOf = (rare: number) => `/assets/frames/itemRare${[2, 3, 4, 5].includes(rare) ? rare : 'K'}.png`;

// Spec C2: each 深造 label is a variant ("Chuẩn", "Lục Trí"); a weapon label naming one (exactly, or followed by a
// separator) gets its chip, the rest stays as text. Longest variant first so "Lục Trí 2" beats "Lục Trí".
const SEP = /^[\s,|–:(-]+/;
export function variantOf(label: string, variants: string[]) {
  const text = label.trim();
  for (const v of [...variants].filter(Boolean).sort((a, b) => b.length - a.length)) {
    if (text === v) return { variant: v, rest: '' };
    if (text.startsWith(v) && SEP.test(text.slice(v.length))) return { variant: v, rest: text.slice(v.length).replace(SEP, '').trim() };
  }
  return { variant: '', rest: text };
}
```

At the top of the `docs.map` callback (after `deepens` is computed) add `const variants = deepens.map((d) => d.label.trim()).filter(Boolean);`. In the weapon object add `...(({ variant, rest }) => ({ variant, labelRest: rest }))(variantOf(w.label, variants)),` and end its `skills` mapping with `.filter((s) => s.name.text || s.text.text)`. In the deepen object add `variant: d.label.trim(),`.

Change the skills map to keep the slot: `new Map((characters[characterId]?.skills ?? []).map((s) => [s.group_id, { ...(s.levels?.[0] ?? {}), slot: s.slot }]))`. In the weapon object add `frame: frameOf(weapon.rare as number),`. In the deepen object add `icon: style.icon ? \`/assets/styles/${style.icon}.png\` : '', serial: d.points.join(''),`. Replace `rotations` and `tips`:

```ts
      rotations: (doc.rotations ?? []).map((r) => ({
        label: r.label, note: r.note ?? '',
        steps: (r.steps ?? (r.skillIds ?? []).map((skillId) => ({ skillId, note: '' }))).filter((s) => skills.has(s.skillId)).map((s) => {
          const k = skills.get(s.skillId)!;
          return { id: s.skillId, name: k.name_vi || k.name_cn || s.skillId, type: k.type ?? '', tag: TAGS[k.slot ?? ''] ?? k.type ?? '', icon: asset(k.icon), note: s.note ?? '' };
        }),
      })),
      tips: (doc.tips ?? []).filter((t) => t.trim()),
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/characters/build/buildView.mts src/features/characters/build/buildView.test.mts public/assets/styles public/assets/frames/itemRare*.png
git commit -m "feat(build): view model for the build sheet (frames, 深造 emblems, step tags and notes)"
```

---

### Task 4: `sheetLayout` — spans and pairing rules

**Files:**
- Create: `src/features/characters/build/sheetLayout.mts`
- Test: `src/features/characters/build/sheetLayout.test.mts`

**Interfaces:**
- Consumes: the `BuildView` fields from Task 3 (structural subset below).
- Produces: `type BlockId = 'weapons' | 'affixes' | 'rotations' | 'deepens' | 'tips' | 'teams'`, `type Span = 4 | 6 | 8 | 12`, `sheetLayout(view): { id: BlockId; span: Span }[]`, `teamSpan(team: { label: string; note: string; members: unknown[] }): number`.

- [ ] **Step 1: Write the failing tests** — `sheetLayout.test.mts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetLayout, teamSpan } from './sheetLayout.mts';

const items = (n: number) => Array.from({ length: n }, () => ({}));
// W0182's production build: 2 weapons, tiers 1/3/2, one 4-step rotation, 2 深造, 4 tips, 10 teams
const w0182 = {
  weapons: items(2), affixes: { noReroll: false, groups: [{ items: items(1) }, { items: items(3) }, { items: items(2) }] },
  rotations: [{ note: '', steps: items(4) }], deepens: items(2), tips: ['a', 'b', 'c', 'd'], teams: items(10), teamOther: '',
};
const spans = (v: typeof w0182) => sheetLayout(v).map((b) => `${b.id}:${b.span}`);

test('W0182: content-sized staggered pairs 4|8 and 6|6, then tips and teams full width', () => {
  assert.deepEqual(spans(w0182), ['weapons:4', 'affixes:8', 'rotations:6', 'deepens:6', 'tips:12', 'teams:12']);
});

test('pair 1 goes full width past 2 weapons, 3 tiers or 5 affixes in a tier', () => {
  assert.deepEqual(spans({ ...w0182, weapons: items(3) }).slice(0, 2), ['weapons:12', 'affixes:12']);
  assert.deepEqual(spans({ ...w0182, affixes: { noReroll: false, groups: [...w0182.affixes.groups, { items: items(1) }] } }).slice(0, 2), ['weapons:12', 'affixes:12']);
  assert.deepEqual(spans({ ...w0182, affixes: { noReroll: false, groups: [{ items: items(6) }] } }).slice(0, 2), ['weapons:12', 'affixes:12']);
});

test('pair 2 goes full width with a rotation note, > 2 rotations, > 5 steps or > 3 深造', () => {
  assert.deepEqual(spans({ ...w0182, rotations: [{ note: 'Tam Trí', steps: [] }] }).slice(2, 4), ['rotations:12', 'deepens:12']);
  assert.deepEqual(spans({ ...w0182, rotations: [0, 1, 2].map(() => ({ note: '', steps: items(1) })) }).slice(2, 4), ['rotations:12', 'deepens:12']);
  assert.deepEqual(spans({ ...w0182, rotations: [{ note: '', steps: items(6) }] }).slice(2, 4), ['rotations:12', 'deepens:12']);
  assert.deepEqual(spans({ ...w0182, deepens: items(4) }).slice(2, 4), ['rotations:12', 'deepens:12']);
});

test('empty blocks are left out and a lone half takes the full width', () => {
  const bare = { ...w0182, weapons: [], rotations: [], tips: ['', ' '], teams: [], teamOther: '' };
  assert.deepEqual(spans(bare), ['affixes:12', 'deepens:12']);
  assert.deepEqual(spans({ ...bare, affixes: { noReroll: true, groups: [] }, teamOther: 'Khác' }), ['affixes:12', 'deepens:12', 'teams:12']);
  // a rotation whose skills are all unknown still shows (label + note)
  assert.deepEqual(spans({ ...bare, rotations: [{ note: 'x', steps: [] }] }).includes('rotations:12'), true);
});

test('teamSpan: members, label (~9 chars/track) and note (~30 chars/track), between 2 and 6', () => {
  assert.equal(teamSpan({ label: 'Hệ thống – mạnh', note: '', members: items(3) }), 3);
  assert.equal(teamSpan({ label: 'Lai', note: '', members: items(1) }), 2);
  assert.equal(teamSpan({ label: 'Hỗ trợ mạnh khác', note: '', members: items(5) }), 5);
  assert.equal(teamSpan({ label: '', note: 'a'.repeat(95), members: items(1) }), 4);
  assert.equal(teamSpan({ label: '', note: '', members: items(9) }), 6);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test src/features/characters/build/sheetLayout.test.mts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `sheetLayout.mts`:

```ts
// Pure: which blocks the build sheet shows and how wide (12-column grid). Rows are pairs split where the content needs
// (4|8, then 6|6: spec C1 after the critique) so the vertical rules never line up; a pair holds only while both halves
// stay short, otherwise each half takes the full width. Spec 2026-09-28 §4.
export type BlockId = 'weapons' | 'affixes' | 'rotations' | 'deepens' | 'tips' | 'teams';
export type Span = 4 | 6 | 8 | 12;
type LayoutInput = {
  weapons: unknown[]; affixes: { noReroll: boolean; groups: { items: unknown[] }[] };
  rotations: { note: string; steps: unknown[] }[]; deepens: unknown[]; tips: string[]; teams: unknown[]; teamOther: string;
};

export function sheetLayout(v: LayoutInput): { id: BlockId; span: Span }[] {
  const has: Record<BlockId, boolean> = {
    weapons: v.weapons.length > 0,
    affixes: v.affixes.groups.length > 0 || v.affixes.noReroll,
    rotations: v.rotations.length > 0,
    deepens: v.deepens.length > 0,
    tips: v.tips.some((t) => t.trim()),
    teams: v.teams.length > 0 || Boolean(v.teamOther),
  };
  const top = v.weapons.length <= 2 && v.affixes.groups.length <= 3 && v.affixes.groups.every((g) => g.items.length <= 5);
  const mid = v.deepens.length <= 3 && v.rotations.length <= 2 && v.rotations.every((r) => r.steps.length <= 5 && !r.note);
  const pair = (a: BlockId, b: BlockId, ok: boolean, sa: Span, sb: Span): [BlockId, Span][] =>
    (ok && has[a] && has[b] ? [[a, sa], [b, sb]] : [[a, 12], [b, 12]]);
  const rows: [BlockId, Span][] = [...pair('weapons', 'affixes', top, 4, 8), ...pair('rotations', 'deepens', mid, 6, 6), ['tips', 12], ['teams', 12]];
  return rows.filter(([id]) => has[id]).map(([id, span]) => ({ id, span }));
}

// Team grid track ≈ one avatar: a group spans enough tracks for its members, its label and ~3 lines of note.
export const teamSpan = (t: { label: string; note: string; members: unknown[] }) =>
  Math.min(6, Math.max(2, t.members.length, Math.ceil(t.label.length / 9), Math.ceil(t.note.length / 30)));
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/characters/build/sheetLayout.mts src/features/characters/build/sheetLayout.test.mts
git commit -m "feat(build): sheet layout rules (content-sized staggered pairs, full width past the limits, team spans)"
```

---

### Task 5: Build sheet components + CSS

**Files:**
- Create: `src/features/characters/build/Text.tsx`, `Block.tsx`, `BuildSheet.tsx`, `blocks/WeaponsBlock.tsx`, `blocks/AffixesBlock.tsx`, `blocks/RotationBlock.tsx`, `blocks/DeepensBlock.tsx`, `blocks/TipsBlock.tsx`, `blocks/TeamsBlock.tsx`
- Modify: `src/features/characters/build/BuildTab.tsx` (render `BuildSheet`), `src/features/characters/styles/buildTab.css` (rewrite)

**Interfaces:**
- Consumes: `BuildView`, `Unit` (Task 3, incl. `variant`, `labelRest`, `frame`, `icon`, `serial`, steps with `tag`/`type`/`note`), `sheetLayout`, `teamSpan`, `BlockId`, `Span` (Task 4).
- Produces: `Text({ unit, id? })`, `Block({ id, title, span, action?, children })`, `BuildSheet({ view, action? })`; each block component takes `{ span: Span; action?: ReactNode }` plus its slice of the view — the slots later "Sửa build" / "Tạo build" buttons plug into.

- [ ] **Step 1: Write the components**

`Text.tsx`:

```tsx
import type { Unit } from './buildView.mts';

// VI when translated, else CN with the untranslated dot (same convention as the lore tab). `id` lets a control be
// labelled by the name (aria-labelledby keeps lang="zh" for a Chinese name; spec §4.1).
export function Text({ unit, id }: { unit: Unit; id?: string }) {
  if (unit.untranslated) return <span id={id} className="build-cn" lang="zh">{unit.text}</span>;
  return id ? <span id={id}>{unit.text}</span> : <>{unit.text}</>;
}
```

`Block.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { BlockId, Span } from './sheetLayout.mts';

// One module of the build sheet. `action` = where a later public "Sửa" button goes (spec 2026-09-28 R4).
// `bs-b-<id>` lets the phone layout reorder blocks (Thâm tạo right after Vũ khí, spec C1).
export function Block({ id, title, span, action, children }: { id: BlockId; title: string; span: Span; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`bs-mod bs-s${span} bs-b-${id}`}>
      <header className="bs-mod-head"><h3>{title}</h3>{action}</header>
      {children}
    </section>
  );
}
```

`blocks/WeaponsBlock.tsx`:

```tsx
import { useId, type ReactNode } from 'react';
import { Block } from '../Block';
import { Text } from '../Text';
import type { BuildView } from '../buildView.mts';
import type { Span } from '../sheetLayout.mts';

type Weapon = BuildView['weapons'][number];

// Icon inside the game's rarity frame, 88 % of it and nudged down (owner: smaller than in the game). The variant chip
// (spec C2) is shared with 深造; "Xem kỹ năng ›" says the tile opens something (critique P2).
function WeaponTile({ weapon: w }: { weapon: Weapon }) {
  const id = useId();
  const nameId = `${id}-name`;
  return (
    <figure className="bs-weapon">
      <button type="button" className="bs-tile" style={{ backgroundImage: `url(${w.frame})` }} popoverTarget={id} aria-labelledby={nameId}>
        {w.icon && <img src={w.icon} alt="" />}
      </button>
      <figcaption>
        {(w.variant || w.labelRest) && <span className="bs-wlabel">{w.variant && <span className="bs-chip">{w.variant}</span>}{w.labelRest}</span>}
        <Text unit={w.name} id={nameId} />
        {w.skills.length > 0 && <button type="button" className="bs-cue" popoverTarget={id}>Xem kỹ năng ›</button>}
      </figcaption>
      <div popover="auto" id={id} className="bs-pop">
        <div className="bs-pop-head">
          <span className="bs-tile bs-tile-sm" style={{ backgroundImage: `url(${w.frame})` }}>{w.icon && <img src={w.icon} alt="" />}</span>
          <div><h4><Text unit={w.name} /></h4><small>★{w.rare}{w.variant && ` · ${w.variant}`}{w.labelRest && ` · ${w.labelRest}`}</small></div>
          <button type="button" className="bs-close" popoverTarget={id} popoverTargetAction="hide">Đóng</button>
        </div>
        {w.skills.map((s, i) => <div key={i} className="bs-skill"><h5><Text unit={s.name} /></h5><p><Text unit={s.text} /></p></div>)}
      </div>
    </figure>
  );
}

export function WeaponsBlock({ weapons, span, action }: { weapons: Weapon[]; span: Span; action?: ReactNode }) {
  return <Block id="weapons" title="Vũ khí" span={span} action={action}><div className="bs-weapons">{weapons.map((w) => <WeaponTile key={w.id} weapon={w} />)}</div></Block>;
}
```

`blocks/AffixesBlock.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Block } from '../Block';
import { Text } from '../Text';
import type { BuildView } from '../buildView.mts';
import type { Span } from '../sheetLayout.mts';

export function AffixesBlock({ affixes, span, action }: { affixes: BuildView['affixes']; span: Span; action?: ReactNode }) {
  return (
    <Block id="affixes" title="Dòng thuộc tính" span={span} action={action}>
      {affixes.groups.length > 0 && (
        <div className="bs-cells">
          {affixes.groups.map((g, i) => (
            <div key={i} className="bs-cell">{g.label && <h4>{g.label}</h4>}<ul>{g.items.map((a, k) => <li key={k}><Text unit={a} /></li>)}</ul></div>
          ))}
        </div>
      )}
      {affixes.noReroll && <p className="bs-note">Không cần tẩy luyện vũ khí.</p>}
    </Block>
  );
}
```

`blocks/RotationBlock.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Block } from '../Block';
import type { BuildView } from '../buildView.mts';
import type { Span } from '../sheetLayout.mts';

// Label, the rotation's note above its sequence, fixed-width steps (icon, ATK/SKILL/ULT tag, step note), then a key
// for the tags actually shown — a `title` tooltip never reaches touch or keyboard users (critique P1).
export function RotationBlock({ rotations, span, action }: { rotations: BuildView['rotations']; span: Span; action?: ReactNode }) {
  const key = [...new Map(rotations.flatMap((r) => r.steps).filter((s) => s.type && s.tag !== s.type).map((s) => [s.tag, s.type])).entries()];
  return (
    <Block id="rotations" title="Xoay vòng" span={span} action={action}>
      <div className="bs-rots">
        {rotations.map((r, i) => (
          <div key={i} className="bs-rot">
            <h4>{r.label}</h4>
            <div>
              {r.note && <p className="bs-rot-note">{r.note}</p>}
              <ol className="bs-seq">
                {r.steps.map((s, k) => (
                  <li key={k} title={s.type ? `${s.name} · ${s.type}` : s.name}>
                    {s.icon ? <img src={s.icon} alt={s.name} /> : <span className="bs-noicon">{s.name}</span>}
                    <b>{s.tag}</b>
                    {s.note && <small>{s.note}</small>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>
      {key.length > 0 && <p className="bs-key">{key.map(([tag, type]) => `${tag} = ${type}`).join(' · ')}</p>}
    </Block>
  );
}
```

`blocks/DeepensBlock.tsx`:

```tsx
import { useId, type ReactNode } from 'react';
import { Block } from '../Block';
import { Text } from '../Text';
import type { BuildView } from '../buildView.mts';
import type { Span } from '../sheetLayout.mts';

type Deepen = BuildView['deepens'][number];

// Emblem + style name under it, the serial (7202) + variant chip beside; the whole unit opens the detail popover.
// The accessible name spells the serial ("7-2-0-2") so it is not read as one number (critique, Sam).
function DeepenUnit({ d }: { d: Deepen }) {
  const id = useId();
  const points = d.columns.map((c) => c.points).join('-');
  return (
    <>
      <button type="button" className="bs-deep" popoverTarget={id} aria-label={`Thâm tạo ${d.style.text}: ${points}${d.label ? `, ${d.label}` : ''}`}>
        <figure>{d.icon && <img src={d.icon} alt="" />}<figcaption><Text unit={d.style} /></figcaption></figure>
        <span className="bs-serial">{d.serial}{d.variant && <span className="bs-chip">{d.variant}</span>}<small>Xem thiên phú ›</small></span>
      </button>
      <div popover="auto" id={id} className="bs-pop">
        <div className="bs-pop-head">
          {d.icon && <img src={d.icon} alt="" />}
          <div><h4><Text unit={d.style} /> · {d.serial}</h4><small>{d.label && `${d.label} · `}{d.total}/11 điểm</small></div>
          <button type="button" className="bs-close" popoverTarget={id} popoverTargetAction="hide">Đóng</button>
        </div>
        {d.columns.map((c, i) => (
          <div key={i} className="bs-col">
            <h5>
              <Text unit={c.name} />
              <span className="bs-pips" role="img" aria-label={`${c.points}/7`}>{Array.from({ length: 7 }, (_, p) => <i key={p} className={p < c.points ? 'is-on' : undefined} />)}</span>
              <b>{c.points}</b>
            </h5>
            <ol>{c.talents.map((t) => <li key={t.point} className={t.reached ? 'is-reached' : undefined}><Text unit={t.text} /></li>)}</ol>
          </div>
        ))}
      </div>
    </>
  );
}

export function DeepensBlock({ deepens, span, action }: { deepens: Deepen[]; span: Span; action?: ReactNode }) {
  return <Block id="deepens" title="Thâm tạo" span={span} action={action}><div className="bs-deeps">{deepens.map((d, i) => <DeepenUnit key={i} d={d} />)}</div></Block>;
}
```

`blocks/TipsBlock.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Block } from '../Block';
import type { Span } from '../sheetLayout.mts';

export function TipsBlock({ tips, span, action }: { tips: string[]; span: Span; action?: ReactNode }) {
  return <Block id="tips" title="Mẹo" span={span} action={action}><ol className="bs-tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ol></Block>;
}
```

`blocks/TeamsBlock.tsx`:

```tsx
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Block } from '../Block';
import type { BuildView } from '../buildView.mts';
import { teamSpan, type Span } from '../sheetLayout.mts';

const PHONE = '(max-width: 640px)';
const SHOWN_ON_PHONE = 4;

function usePhone() {
  const [phone, setPhone] = useState(() => matchMedia(PHONE).matches);
  useEffect(() => {
    const query = matchMedia(PHONE);
    const onChange = () => setPhone(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return phone;
}

// Packed grid: a track ≈ one avatar, each group spans what it needs, `dense` backfills the gaps. On phones only the
// first 4 groups show until "Xem thêm" (critique P2: the team list took ~1000 px at 390).
export function TeamsBlock({ teams, teamOther, span, action }: { teams: BuildView['teams']; teamOther: string; span: Span; action?: ReactNode }) {
  const phone = usePhone();
  const [all, setAll] = useState(false);
  const shown = phone && !all ? teams.slice(0, SHOWN_ON_PHONE) : teams;
  return (
    <Block id="teams" title="Đội hình" span={span} action={action}>
      {shown.length > 0 && (
        <div className="bs-pack">
          {shown.map((t, i) => (
            <div key={i} className="bs-team" style={{ '--n': teamSpan(t) } as CSSProperties}>
              {t.label && <h4>{t.label}</h4>}
              <div className="bs-members">{t.members.map((m) => <a key={m.id} href={m.href}>{m.icon && <img src={m.icon} alt="" />}<span>{m.name}</span></a>)}</div>
              {t.note && <p>{t.note}</p>}
            </div>
          ))}
        </div>
      )}
      {shown.length < teams.length && <button type="button" className="bs-more" onClick={() => setAll(true)}>Xem thêm {teams.length - shown.length} nhóm</button>}
      {teamOther && <p className="bs-note">Khác: {teamOther}</p>}
    </Block>
  );
}
```

`BuildSheet.tsx`:

```tsx
import { Fragment, type ReactNode } from 'react';
import type { BuildView } from './buildView.mts';
import { sheetLayout, type BlockId, type Span } from './sheetLayout.mts';
import { AffixesBlock } from './blocks/AffixesBlock';
import { DeepensBlock } from './blocks/DeepensBlock';
import { RotationBlock } from './blocks/RotationBlock';
import { TeamsBlock } from './blocks/TeamsBlock';
import { TipsBlock } from './blocks/TipsBlock';
import { WeaponsBlock } from './blocks/WeaponsBlock';

const BLOCKS: Record<BlockId, (v: BuildView, span: Span) => ReactNode> = {
  weapons: (v, span) => <WeaponsBlock weapons={v.weapons} span={span} />,
  affixes: (v, span) => <AffixesBlock affixes={v.affixes} span={span} />,
  rotations: (v, span) => <RotationBlock rotations={v.rotations} span={span} />,
  deepens: (v, span) => <DeepensBlock deepens={v.deepens} span={span} />,
  tips: (v, span) => <TipsBlock tips={v.tips} span={span} />,
  teams: (v, span) => <TeamsBlock teams={v.teams} teamOther={v.teamOther} span={span} />,
};

// Direction C (docs/public-redesign/build-tab/direction-approved.md): one framed sheet, gold band, staggered modules.
// The build name is demoted (the tabs already name it; spec C4). `action` = the band's slot for a later public
// "Sửa build" / "Tạo build" (spec R4).
export function BuildSheet({ view, action }: { view: BuildView; action?: ReactNode }) {
  return (
    <article className="bs-sheet">
      <header className="bs-band">
        <div className="bs-title"><h2>{view.name || 'Build'}</h2>{view.rating && <span className="bs-rating">{view.rating}</span>}</div>
        {view.summary && <p>{view.summary}</p>}
        {action}
      </header>
      <div className="bs-grid">{sheetLayout(view).map(({ id, span }) => <Fragment key={id}>{BLOCKS[id](view, span)}</Fragment>)}</div>
    </article>
  );
}
```

`BuildTab.tsx`: delete `Text`, `Weapon` and the body of `BuildTab`'s return below the build tabs; the component becomes:

```tsx
import { StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/buildTab.css';
import { getGameData, loadedGameDocument } from '../../../data/loader.js';
import { buildViews, type BuildView } from './buildView.mts';
import { BuildSheet } from './BuildSheet';

function BuildTab({ views }: { views: BuildView[] }) {
  const [index, setIndex] = useState(0);
  return (
    <div className="build-tab">
      {views.length > 1 && (
        <div className="build-tabs" role="tablist" aria-label="Các build">
          {views.map((b, i) => <button key={i} type="button" role="tab" aria-selected={i === index} onClick={() => setIndex(i)}>{b.name || `Build ${i + 1}`}</button>)}
        </div>
      )}
      <BuildSheet view={views[index]} />
    </div>
  );
}
```

(the island code under `// ponytail: same island pattern as LoreTab…` stays unchanged).

- [ ] **Step 2: Rewrite `src/features/characters/styles/buildTab.css`**

```css
/* Build tab — direction C (docs/public-redesign/build-tab/direction-approved.md) + the /impeccable critique fixes
   (spec 2026-09-28 §4.1). Colours only from tokens.css; one 6px radius; UI text ≥ 12px. Spans come from sheetLayout.mts. */
.build-tab { display: grid; gap: 16px; color: var(--text-main); font: 15px/1.65 var(--font-sans); }
.build-tabs { display: flex; flex-wrap: wrap; gap: 4px; }
.build-tabs button { padding: 6px 12px; font: 500 13px var(--font-sans); color: var(--text-muted); background: none; border: 1px solid transparent; border-radius: 6px; cursor: pointer; }
.build-tabs button[aria-selected="true"] { color: var(--text-main); background: var(--bg-elevated); border-color: var(--border-color); }
.build-cn { font-family: var(--font-serif); }
.build-cn::after { content: ""; display: inline-block; width: 4px; height: 4px; margin: 0 0 .2em .35em; border-radius: 50%; background: var(--text-subtle); vertical-align: middle; }

/* no overflow:hidden on the sheet: it clipped the 4th weapon at 390px (critique P0) */
.bs-sheet { background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 6px; }
.bs-band { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 8px 24px; padding: 16px 22px; border-bottom: 2px solid var(--accent); }
.bs-title { display: flex; align-items: baseline; gap: 12px; }
.bs-band h2 { margin: 0; font: 600 20px/1.3 var(--font-serif); }
.bs-band p { margin: 0; max-width: 70ch; font-size: 13px; color: var(--text-muted); white-space: pre-line; }
.bs-rating { padding: 2px 10px; font-weight: 700; color: var(--on-vivid); background: var(--accent); border-radius: 6px; }

.bs-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); }
.bs-mod { min-width: 0; padding: 18px 22px 20px; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
.bs-mod:last-child { border-bottom: 0; }
.bs-s4 { grid-column: span 4; }
.bs-s6 { grid-column: span 6; }
.bs-s8 { grid-column: span 8; }
.bs-s12 { grid-column: 1 / -1; }
.bs-s8, .bs-s12, .bs-b-deepens { border-right: 0; } /* right half of a pair, or a full row */
.bs-mod-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.bs-mod-head h3 { margin: 0; font: 600 16px/1.3 var(--font-sans); }
.bs-note { margin: 10px 0 0; font-size: 13px; color: var(--text-muted); }
.bs-chip { display: inline-block; margin-right: 6px; padding: 0 6px; font: 600 12px/1.6 var(--font-sans); letter-spacing: 0; color: var(--text-main); vertical-align: middle; border: 1px solid var(--border-strong); border-radius: 6px; }
.bs-cue { display: block; margin-top: 2px; padding: 0; font: 500 12px/1.5 var(--font-sans); color: var(--text-subtle); text-align: left; background: none; border: 0; cursor: pointer; }
.bs-cue:hover { color: var(--text-main); }

/* weapons */
.bs-weapons { display: flex; flex-wrap: wrap; gap: 16px; }
.bs-weapon { display: grid; gap: 6px; width: 136px; margin: 0; }
.bs-weapon figcaption { font-size: 13px; line-height: 1.35; }
.bs-wlabel { display: block; margin-bottom: 2px; font-size: 12px; color: var(--text-muted); }
.bs-tile { position: relative; display: block; width: 96px; aspect-ratio: 1; padding: 0; background: center / 100% no-repeat; border: 0; cursor: pointer; }
.bs-tile img { position: absolute; left: 6%; top: 9%; width: 88%; height: 88%; object-fit: contain; transition: transform .2s cubic-bezier(.2, 0, 0, 1); }
.bs-tile:hover img, .bs-tile:focus-visible img { transform: translateY(-2px); }
.bs-tile-sm { width: 56px; flex: none; cursor: default; }

/* affixes */
.bs-cells { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.bs-cell { padding: 12px 14px; background: var(--bg-elevated); border-radius: 6px; }
.bs-cell h4 { margin: 0 0 8px; font: 600 12px/1.3 var(--font-sans); color: var(--accent); }
.bs-cell ul { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; font-size: 14px; }

/* rotation */
.bs-rots { display: grid; gap: 16px; }
.bs-rot { display: grid; grid-template-columns: minmax(0, 180px) minmax(0, 1fr); gap: 4px 20px; align-items: start; }
.bs-s4 .bs-rot, .bs-s6 .bs-rot { grid-template-columns: 1fr; }
.bs-rot h4 { margin: 0; padding-top: 4px; font: 600 13px/1.4 var(--font-sans); color: var(--text-muted); }
.bs-rot-note { margin: 0 0 8px; max-width: 70ch; font-size: 13px; color: var(--text-subtle); }
.bs-seq { display: flex; flex-wrap: wrap; gap: 6px 10px; margin: 0; padding: 0; list-style: none; }
.bs-seq li { position: relative; display: grid; justify-items: center; align-content: start; gap: 4px; width: 64px; text-align: center; }
.bs-seq li + li::before { content: "›"; position: absolute; left: -9px; top: 12px; color: var(--text-subtle); }
.bs-seq img { width: 46px; height: 46px; background: var(--bg-elevated); border-radius: 6px; }
.bs-noicon { display: grid; place-items: center; width: 46px; height: 46px; overflow: hidden; font-size: 12px; line-height: 1.2; background: var(--bg-elevated); border-radius: 6px; }
.bs-seq b { font: 600 12px/1 var(--font-sans); letter-spacing: .06em; color: var(--text-muted); }
.bs-seq small { font-size: 12px; line-height: 1.3; color: var(--accent); }
.bs-key { margin: 12px 0 0; font-size: 12px; color: var(--text-subtle); }

/* 深造 */
.bs-deeps { display: flex; flex-wrap: wrap; gap: 12px 28px; }
.bs-deep { display: grid; grid-template-columns: auto auto; align-items: center; gap: 0 12px; padding: 6px 10px 6px 4px; font: inherit; color: inherit; text-align: left; background: none; border: 0; border-radius: 6px; cursor: pointer; }
.bs-deep:hover { background: var(--bg-surface-hover); }
.bs-deep figure { display: grid; justify-items: center; gap: 2px; width: 72px; margin: 0; }
.bs-deep img { width: 60px; height: 60px; }
.bs-deep figcaption { font-size: 12px; line-height: 1.3; text-align: center; }
.bs-serial { font: 700 30px/1 var(--font-serif); letter-spacing: .14em; font-variant-numeric: tabular-nums; }
.bs-serial .bs-chip { margin: 0 0 0 4px; }
.bs-serial small { display: block; margin-top: 6px; font: 500 12px/1 var(--font-sans); letter-spacing: 0; color: var(--text-subtle); }

/* tips */
.bs-tips { margin: 0; padding-left: 18px; columns: 2 380px; column-gap: 40px; font-size: 14px; color: var(--text-muted); }
.bs-tips li { margin-bottom: 8px; break-inside: avoid; }

/* teams */
.bs-pack { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); grid-auto-flow: row dense; gap: 18px 0; }
.bs-team { grid-column: span var(--n); min-width: 0; padding-right: 12px; }
.bs-team h4 { margin: 0 0 6px; font: 600 12px/1.3 var(--font-sans); color: var(--text-muted); }
.bs-team p { margin: 4px 0 0; font-size: 12px; color: var(--text-subtle); }
.bs-members { display: flex; flex-wrap: wrap; gap: 4px; }
.bs-members a { display: grid; justify-items: center; gap: 4px; width: 64px; font-size: 12px; line-height: 1.3; text-align: center; color: var(--text-muted); text-decoration: none; }
.bs-members a:hover { color: var(--text-main); }
.bs-members img { width: 44px; height: 44px; object-fit: cover; background: var(--bg-elevated); border: 2px solid var(--border-strong); border-radius: 50%; }
.bs-more { margin-top: 14px; padding: 6px 12px; font: 500 13px var(--font-sans); color: var(--text-main); background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; }

/* popovers (native) */
.bs-pop { max-width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; margin: auto; padding: 16px 18px; font-size: 14px; line-height: 1.7; color: var(--text-main); background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: 6px; }
.bs-pop::backdrop { background: rgb(0 0 0 / .6); }
.bs-pop-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.bs-pop-head > img { width: 52px; height: 52px; }
.bs-pop-head h4 { margin: 0; font: 600 17px/1.3 var(--font-serif); }
.bs-pop-head small { font-size: 12px; color: var(--text-subtle); }
.bs-close { align-self: start; margin-left: auto; padding: 4px 10px; font: 500 13px var(--font-sans); color: var(--text-muted); background: none; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; }
.bs-close:hover { color: var(--text-main); }
.bs-skill h5 { margin: 10px 0 4px; font-size: 13px; font-weight: 600; color: var(--text-muted); }
.bs-skill p { margin: 0; white-space: pre-line; }
.bs-col { margin-top: 12px; }
.bs-col h5 { display: grid; grid-template-columns: 1fr 112px 20px; gap: 10px; align-items: center; margin: 0 0 4px; font-size: 14px; font-weight: 600; }
.bs-col h5 b { text-align: right; font-variant-numeric: tabular-nums; }
.bs-pips { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.bs-pips i { height: 8px; border-radius: 2px; box-shadow: inset 0 0 0 1px var(--border-strong); }
.bs-pips i.is-on { background: var(--accent); box-shadow: none; }
.bs-col ol { margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-subtle); }
.bs-col li.is-reached { color: var(--text-main); }

/* states */
.bs-tile:active, .bs-deep:active { transform: scale(.98); }
.bs-tile:focus-visible, .bs-deep:focus-visible, .bs-cue:focus-visible, .bs-close:focus-visible, .bs-more:focus-visible, .build-tabs button:focus-visible, .bs-members a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
@media (prefers-reduced-motion: reduce) { .bs-tile img { transition: none; } .bs-tile:active, .bs-deep:active { transform: none; } }

@media (max-width: 980px) {
  .bs-s4, .bs-s6, .bs-s8 { grid-column: 1 / -1; border-right: 0; }
  /* Thâm tạo right after Vũ khí when stacked (spec C1); DOM order stays the desktop order */
  .bs-b-weapons { order: 1; } .bs-b-deepens { order: 2; } .bs-b-affixes { order: 3; } .bs-b-rotations { order: 4; } .bs-b-tips { order: 5; } .bs-b-teams { order: 6; }
}
@media (max-width: 640px) {
  .bs-band, .bs-mod { padding: 16px; }
  .bs-rot { grid-template-columns: 1fr; }
  /* compact affix rows: tier label left, items inline */
  .bs-cells { grid-template-columns: 1fr; gap: 6px; }
  .bs-cell { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; padding: 8px 12px; }
  .bs-cell h4 { margin: 0; line-height: 1.6; }
  .bs-cell ul { display: flex; flex-wrap: wrap; gap: 2px 12px; }
  /* two 深造 side by side */
  .bs-deeps { gap: 12px 8px; }
  .bs-deep { gap: 0 8px; padding: 4px; }
  .bs-deep figure { width: 52px; }
  .bs-deep img { width: 44px; height: 44px; }
  .bs-serial { font-size: 24px; }
  .bs-team { grid-column: span min(var(--n), 4); }
  /* popovers as a bottom sheet with a thumb-reachable edge */
  .bs-pop { width: 100%; max-width: none; max-height: 85dvh; margin: auto 0 0; border-radius: 6px 6px 0 0; }
}
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit -p tsconfig.json` then `npm run build`
Expected: no new tsc errors (compared with the record from Task 2); Vite build succeeds.

- [ ] **Step 4: Verify in the browser** (preview `whmxcalc-dev`, `#/characters/ly-tieu-hai-hang-lien` → tab Build)

At 1440×900 check: rows 4|8 and 6|6; the two 深造 units side by side in the 6-column half; the serial is the largest text; variant chips "Chuẩn"/"Lục Trí" on the 深造 units and "Lục Trí" on 金桂抱月灯; the tag key under Xoay vòng; weapon and 深造 popovers open from the tile, the cue and the unit, close with "Đóng" and Esc; console has no errors. At 390×844 check: `document.documentElement.scrollWidth === clientWidth`; order Vũ khí → Thâm tạo → Dòng thuộc tính → Xoay vòng; affix tiers as rows; the two 深造 units on one line; 4 team groups + "Xem thêm 6 nhóm" which reveals the rest; popovers as bottom sheets; `getComputedStyle(firstTeamGroup).gridColumnEnd` shows a span (the `min()` works). Then run `"C:/Users/Legion/.claude/plugins/cache/impeccable/impeccable/4.4.0/skills/impeccable/scripts/impeccable" detect "http://localhost:5173/#/characters/ly-tieu-hai-hang-lien"` (default and `--viewport 390x844`) and compare with the 2026-09-28 baseline (128 undersized-ui-text etc.): no new finding inside `.build-tab` except the known `.bs-rot h4` heading-rhythm false positive. Fix what is found in one batch, confirm once.

- [ ] **Step 5: Commit**

```bash
git add src/features/characters/build src/features/characters/styles/buildTab.css
git commit -m "feat(build): public Build tab as the direction-C build sheet (critique fixes: phone, popovers, variant chips, tag key)"
```

---

### Task 6: End-to-end with a V0055-style build, docs

**Files:**
- Modify: `docs/WHMX_CURRENT_STATE_FINAL_2026-09-26.md` (Build row: sheet + rotation notes; backlog: impeccable audit findings, DESIGN.md next)
- Modify: `docs/public-redesign/build-tab/direction-approved.md` (implemented, links to the components)

- [ ] **Step 1: Dev-DB build with notes** — start `whmxcalc-vercel-dev` (port 3003); the owner signs in (Claude never types passwords); in Admin → Khí Giả → V0055 → Build, create a build with **4 weapons** (checks the critique P0 at 390 px) and rotations "Lượt đầu" (ULT, SKILL, ATK), "Các lượt sau" (SKILL with note "dùng lên Thố Động", SKILL, ATK), "Tam Trí" with the note from the 新月 card and steps SKILL, ULT, SKILL, ATK; save. Expected: saved (no 422), the dev game document republishes (~30 s), and the public V0055 Build tab shows the three rotations full width, step note under the first SKILL, rotation note above the third sequence, and at 390 px all 4 weapons visible. Ask the owner before deleting this test build or keeping it.

- [ ] **Step 2: Full test run**

Run: `npm test` and `npm run test:tools`
Expected: all pass.

- [ ] **Step 3: Update the docs** listed above (state file: what shipped, how to verify; direction file: "implemented 2026-09-28 in `src/features/characters/build/`").

- [ ] **Step 4: Commit, then ask the owner before pushing**

```bash
git add docs/WHMX_CURRENT_STATE_FINAL_2026-09-26.md docs/public-redesign/build-tab docs/superpowers/specs/2026-09-28-build-tab-public-design.md docs/superpowers/plans/2026-09-28-build-tab-public.md PRODUCT.md
git commit -m "docs(build): build sheet shipped locally; spec, plan, direction, PRODUCT.md"
```
