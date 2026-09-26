# Public Lore Tab ("Hồ Sơ Lưu Trữ") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sixth character tab that shows every lore text of the character (VI, else CN + "Chưa dịch") and its archive image.

**Architecture:** `build_web_data.py` adds `char.archive` (R2 URLs from the asset manifest) to `public/data.json`. A pure TS module turns
`char` (v2 overlay shape or legacy CN shape) into a view model; a React island renders it inside `#cd-tab-content` when the route is
`#/characters/<slug>/lore`. Lore data itself is unchanged (DB → R2 overlay → `char.profile`).

**Tech Stack:** Python 3 (`unittest`), Vite, vanilla JS router, React 19 + TypeScript (`createRoot` island like `src/app/layout/AppNav.tsx`),
node:test for `.mts`, plain CSS with `src/styles/tokens.css`.

**Spec:** `docs/superpowers/specs/2026-09-26-public-lore-tab-design.md`

## Global Constraints

- Owner decisions Q1–Q7 of the spec §2 are binding (tab name **"Hồ Sơ Lưu Trữ"**, CN + **"Chưa dịch"**, show all reports, editor link **"Sửa trong Admin"** → `#/admin/characters/<ID>/lore`, reveal effect only on heading/short intro and removable in one place, no term tooltips).
- Reply/commit discipline from `docs/WHMX_CURRENT_STATE_FINAL_2026-09-26.md` §6: TDD, evidence before "done", never stage `localization/localization_master.xlsx` or other untracked owner files, push `origin HEAD:main` first then `origin feat/postgres-admin-crud`.
- `public/data.json` rebuild: diff the whole file and **show the owner before committing**; only `"archive"` keys may be added.
- Any work touching `build_web_data.py` / `public/data.json`: read `.agents/skills/whmx-localization/SKILL.md` first.
- New UI: React + TypeScript; colours only from `src/styles/tokens.css`; dark only; never the bare `hidden` class; motion CSS first, GSAP only with owner OK.
- Visual design goes through `huashu-design` (3 directions, owner picks) **and** the taste-skill pack in `.agents/skills/` (`design-taste-frontend`, `high-end-visual-design`, `minimalist-ui`, `redesign-existing-projects`): huashu = rules, taste = references.
- Text from data is rendered as text (React escaping), line breaks kept with CSS `white-space: pre-line`; never `dangerouslySetInnerHTML`.
- Never add files under `api/`. Scratch files in `D:\BaiTapCode\WHMX\_claude_scratch\`.

## Review Focus

1. **Lore overlay failed to load** → `char.profile` is the legacy CN shape (`reports[{id,title,content}]`, `relic_info{relic_name,dynasty,museum,intro}`, no `_vi`); the tab must still render everything as CN + "Chưa dịch" (Task 2 test `legacy shape`).
2. **Whitespace-only or empty VI** (`"  "`, `""`) must count as untranslated, not as an empty VI line (Task 2 test `blank vi`).
3. **Rebuilding `data.json` picks up the owner's uncommitted workbook edits** → the diff would contain more than `archive`; stop and show the owner instead of committing (Task 1 step 6).
4. **Fast tab switching / leaving the tab / changing character** while the React island is mounted → no leaked root, no doubled content, no console error (Task 3 `unmountLoreTab` + browser step).
5. **Direct deep link** `#/characters/<slug>/lore` on a cold page load, and a character whose `relic_info` is `{}` or who has no `profile` (Task 2 tests + Task 3 browser step).

---

### Task 1: `char.archive` in `data.json`

**Files:**
- Modify: `tools/build_web_data.py` (module-level helper near `build_exact_filename_index`, and the character dict near L2298 `"cards": char_cards.get(cid, []),`)
- Create: `tools/test_build_archive_urls.py`
- Regenerate: `public/data.json`

**Interfaces:**
- Produces: `archive_urls(assets_root: Path, cid: str, manifest: dict) -> dict | None` → `{"image": str, "head": str}`; `data.json` `characters[<ID>].archive = {"image": "<https R2 url>.webp", "head": "<https R2 url>.webp"}` (key absent when the character has no archive folder).

- [ ] **Step 1: Read `.agents/skills/whmx-localization/SKILL.md`** (mandatory for `build_web_data.py` / `data.json`).

- [ ] **Step 2: Write the failing test** `tools/test_build_archive_urls.py`

```python
import tempfile
import unittest
from pathlib import Path

from build_web_data import archive_urls

BASE = "https://example.r2.dev"


def manifest_for(*keys):
    return {"public_base_url": BASE, "assets": {k: {"key": k} for k in keys}}


class ArchiveUrlsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def make(self, cid, *names):
        folder = self.root / "characters" / cid / "archive"
        folder.mkdir(parents=True)
        for name in names:
            (folder / name).write_bytes(b"x")

    def test_both_files_published(self):
        self.make("A0024", "a0024.png", "head_a0024.png")
        manifest = manifest_for("characters/a0024/archives/a0024.webp", "characters/a0024/archives/head_a0024.webp")
        self.assertEqual(archive_urls(self.root, "A0024", manifest), {
            "image": f"{BASE}/characters/a0024/archives/a0024.webp",
            "head": f"{BASE}/characters/a0024/archives/head_a0024.webp",
        })

    def test_no_folder_or_one_file_missing_is_none(self):
        self.assertIsNone(archive_urls(self.root, "A0001", manifest_for()))
        self.make("A0003", "a0003.png")
        self.assertIsNone(archive_urls(self.root, "A0003", manifest_for("characters/a0003/archives/a0003.webp")))

    def test_local_file_without_manifest_entry_fails_loudly(self):
        self.make("A0024", "a0024.png", "head_a0024.png")
        with self.assertRaises(RuntimeError):
            archive_urls(self.root, "A0024", manifest_for())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run it, expect FAIL** — `python -m unittest discover -s tools -p "test_build_archive_urls.py"` → `ImportError: cannot import name 'archive_urls'`.
  Before implementing, confirm `object_key()` in `tools/asset_publish_manifest.py` maps `archive` + `a0024.png` to `characters/a0024/archives/a0024.webp`; if the key format differs, fix the test's expected keys to what `object_key` really produces (the manifest file is the evidence).

- [ ] **Step 4: Implement** in `tools/build_web_data.py` (module level, after `build_exact_filename_index`):

```python
def archive_urls(assets_root, cid, manifest):
    """Archive (hiện vật) image URLs on R2, or None when the character has no archive folder / pair."""
    folder = Path(assets_root) / "characters" / cid / "archive"
    image, head = folder / f"{cid.lower()}.png", folder / f"head_{cid.lower()}.png"
    if not (image.exists() and head.exists()):
        return None
    return {
        "image": require_asset_url(manifest, cid, "archive", image.name),
        "head": require_asset_url(manifest, cid, "archive", head.name),
    }
```

and in the character dict, after `"cards": char_cards.get(cid, []),`:

```python
            **({"archive": archive} if (archive := archive_urls(MASTER.parent.parent / "Assets", cid, remote_asset_manifest)) else {}),
```

- [ ] **Step 5: Run** `npm run test:tools` → all PASS (new test included).

- [ ] **Step 6: Rebuild and review the diff (owner gate).**
  Run `python tools/build_web_data.py`, then:

```bash
node -e "const o=JSON.parse(require('child_process').execSync('git show HEAD:public/data.json',{maxBuffer:1e9}));const n=require('./public/data.json');const strip=(d)=>{for(const c of Object.values(d.characters))delete c.archive;return JSON.stringify(d)};const withArchive=Object.values(n.characters).filter(c=>c.archive).length;console.log({withArchive, onlyArchiveChanged: strip(o)===strip(n)})"
git diff --stat public/data.json
```

  Expected: `withArchive` ≈ 133, `onlyArchiveChanged: true`. If `false`, **stop**: list what else changed (most likely the owner's uncommitted workbook edits) and ask the owner before going on. Then run `python tools/validate_data.py` and `python tools/validate_public_output.py` (must still pass) and show the owner the diff summary + 2 sample `archive` entries. Wait for the owner's yes.

- [ ] **Step 7: Commit** (after owner yes)

```bash
git add tools/build_web_data.py tools/test_build_archive_urls.py public/data.json
git commit -m "feat(data): char.archive (R2 archive image + head) in data.json"
```

---

### Task 2: Pure view model `loreView.mts`

**Files:**
- Create: `src/features/characters/lore/loreView.mts`
- Test: `src/features/characters/lore/loreView.test.mts` (picked up by `npm test` glob `src/**/*.test.mts`)

**Interfaces:**
- Produces:

```ts
export type LoreUnit = { text: string; untranslated: boolean };
export type LoreFact = { label: string; value: LoreUnit };
export type LoreReport = { title: LoreUnit | null; content: LoreUnit | null; unlock: LoreUnit | null; unlockLevel: number | null; special: boolean };
export type LoreTimelineEntry = { label: LoreUnit | null; story: LoreUnit | null };
export type LoreView = {
  archive: { image: string; head: string } | null;
  facts: LoreFact[];
  intro: LoreUnit | null;
  reports: LoreReport[];
  relicIntro: LoreUnit | null;
  timeline: LoreTimelineEntry[];
  empty: boolean;
};
export function pick(vi: unknown, cn: unknown): LoreUnit | null;
export function buildLoreView(char: unknown): LoreView;
```

- [ ] **Step 1: Write the failing test** `loreView.test.mts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLoreView, pick } from './loreView.mts';

test('pick: VI wins, else CN flagged untranslated, blank VI counts as missing', () => {
  assert.deepEqual(pick('Tên', '名'), { text: 'Tên', untranslated: false });
  assert.deepEqual(pick(null, '名'), { text: '名', untranslated: true });
  assert.deepEqual(pick('   ', '名'), { text: '名', untranslated: true });
  assert.deepEqual(pick(undefined, '  '), null);
});

const v2 = {
  archive: { image: 'https://r2/a.webp', head: 'https://r2/h.webp' },
  profile: {
    eval_intro: '介绍', eval_intro_vi: 'Giới thiệu',
    reports: [
      { kind: 'basic', title: '观察报告1', title_vi: 'Báo cáo quan sát 1', content: '内容', unlock_level: 5, unlock_name: '鹿鸣', unlock_name_vi: null },
      { kind: 'special', title: '机密报告A', title_vi: null, content: '', unlock_level: null, unlock_name: null },
      { kind: 'basic', title: '', content: '' },
    ],
    relic_info: {
      type: { cn: '武器', vi: 'Vũ khí' }, era: { cn: '18世纪', vi: null }, museum: { cn: '', vi: null },
      intro: '燧发枪', intro_vi: null,
      timeline: [{ label: '现今', label_vi: 'Hiện nay', story: '藏于温莎城堡。', story_vi: null }, { label: '', story: '' }],
    },
  },
};

test('v2 shape: every unit VI or CN, empty units and reports dropped, special report flagged', () => {
  const view = buildLoreView(v2);
  assert.deepEqual(view.archive, v2.archive);
  assert.deepEqual(view.intro, { text: 'Giới thiệu', untranslated: false });
  assert.deepEqual(view.facts, [
    { label: 'Loại', value: { text: 'Vũ khí', untranslated: false } },
    { label: 'Niên đại', value: { text: '18世纪', untranslated: true } },
  ]);
  assert.equal(view.reports.length, 2);
  assert.deepEqual(view.reports[0], {
    title: { text: 'Báo cáo quan sát 1', untranslated: false }, content: { text: '内容', untranslated: true },
    unlock: { text: '鹿鸣', untranslated: true }, unlockLevel: 5, special: false,
  });
  assert.equal(view.reports[1].special, true);
  assert.equal(view.reports[1].content, null);
  assert.deepEqual(view.relicIntro, { text: '燧发枪', untranslated: true });
  assert.deepEqual(view.timeline, [{ label: { text: 'Hiện nay', untranslated: false }, story: { text: '藏于温莎城堡。', untranslated: true } }]);
  assert.equal(view.empty, false);
});

test('legacy shape (overlay failed): CN everywhere, relic fields from legacy keys', () => {
  const view = buildLoreView({ profile: {
    eval_intro: '介绍', reports: [{ id: 1, title: '观察报告1', content: '内容' }],
    relic_info: { relic_name: '铜镜', dynasty: '金代', museum: '黑龙江省博物馆', intro: '金代铜镜' },
  } });
  assert.deepEqual(view.intro, { text: '介绍', untranslated: true });
  assert.deepEqual(view.facts.map((f) => f.label), ['Hiện vật', 'Niên đại', 'Nơi lưu giữ']);
  assert.equal(view.reports[0].title?.untranslated, true);
  assert.equal(view.reports[0].unlock, null);
  assert.deepEqual(view.relicIntro, { text: '金代铜镜', untranslated: true });
  assert.deepEqual(view.timeline, []);
});

test('no profile / empty relic_info / no archive → empty view, no crash', () => {
  for (const char of [{}, null, { profile: { relic_info: {} } }, { profile: { reports: 'bad' } }]) {
    const view = buildLoreView(char);
    assert.equal(view.empty, true);
    assert.equal(view.archive, null);
    assert.deepEqual(view.facts, []);
  }
});
```

- [ ] **Step 2: Run, expect FAIL** — `node --test src/features/characters/lore/loreView.test.mts` → `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement** `loreView.mts`

```ts
// Turns a public `char` (v2 lore overlay shape, or the legacy CN shape when the overlay failed) into what the lore tab shows.
export type LoreUnit = { text: string; untranslated: boolean };
export type LoreFact = { label: string; value: LoreUnit };
export type LoreReport = { title: LoreUnit | null; content: LoreUnit | null; unlock: LoreUnit | null; unlockLevel: number | null; special: boolean };
export type LoreTimelineEntry = { label: LoreUnit | null; story: LoreUnit | null };
export type LoreView = {
  archive: { image: string; head: string } | null;
  facts: LoreFact[];
  intro: LoreUnit | null;
  reports: LoreReport[];
  relicIntro: LoreUnit | null;
  timeline: LoreTimelineEntry[];
  empty: boolean;
};

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {});
const list = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function pick(vi: unknown, cn: unknown): LoreUnit | null {
  if (str(vi)) return { text: str(vi), untranslated: false };
  if (str(cn)) return { text: str(cn), untranslated: true };
  return null;
}

const pair = (value: unknown) => pick(obj(value).vi, obj(value).cn);

export function buildLoreView(char: unknown): LoreView {
  const c = obj(char);
  const profile = obj(c.profile);
  const relic = obj(profile.relic_info);
  const archive = obj(c.archive);

  const legacy = 'relic_name' in relic || 'dynasty' in relic;
  const factPairs: [string, LoreUnit | null][] = legacy
    ? [['Hiện vật', pick(null, relic.relic_name)], ['Niên đại', pick(null, relic.dynasty)], ['Nơi lưu giữ', pick(null, relic.museum)]]
    : [['Loại', pair(relic.type)], ['Niên đại', pair(relic.era)], ['Nơi lưu giữ', pair(relic.museum)]];
  const facts = factPairs.filter((f): f is [string, LoreUnit] => f[1] !== null).map(([label, value]) => ({ label, value }));

  const reports = list(profile.reports)
    .map((r) => ({
      title: pick(r.title_vi, r.title),
      content: pick(r.content_vi, r.content),
      unlock: pick(r.unlock_name_vi, r.unlock_name),
      unlockLevel: typeof r.unlock_level === 'number' ? r.unlock_level : null,
      special: r.kind !== undefined && r.kind !== 'basic',
    }))
    .filter((r) => r.title || r.content);

  const timeline = list(relic.timeline)
    .map((t) => ({ label: pick(t.label_vi, t.label), story: pick(t.story_vi, t.story) }))
    .filter((t) => t.label || t.story);

  const view = {
    archive: str(archive.image) && str(archive.head) ? { image: str(archive.image), head: str(archive.head) } : null,
    facts,
    intro: pick(profile.eval_intro_vi, profile.eval_intro),
    reports,
    relicIntro: pick(relic.intro_vi, relic.intro),
    timeline,
  };
  const empty = !view.archive && !facts.length && !view.intro && !reports.length && !view.relicIntro && !timeline.length;
  return { ...view, empty };
}
```

- [ ] **Step 4: Run** `node --test src/features/characters/lore/loreView.test.mts` → PASS; `npm test` → all PASS; `node_modules/.bin/tsc -p tsconfig.json --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/characters/lore/loreView.mts src/features/characters/lore/loreView.test.mts
git commit -m "feat(lore): public lore view model (VI else CN + untranslated flag, v2 and legacy shapes)"
```

---

### Task 3: Tab wiring + functional React island (plain layout, no final look)

**Files:**
- Create: `src/features/characters/lore/LoreTab.tsx`
- Create: `src/features/characters/styles/loreTab.css` (structure only: spacing, `white-space: pre-line`, the "Chưa dịch" chip, tokens only)
- Modify: `src/features/characters/views/characterDetail.js` (`renderTabContent` L33-54, nav L258-281)

**Interfaces:**
- Consumes: `buildLoreView(char): LoreView` (Task 2); `getSession()`, `isAuthorizedEditor(session)` from `src/app/auth/session.js`; `recordHref(id, 'lore')` from `src/admin/characters/lib/route.mts`.
- Produces: `mountLoreTab(container: HTMLElement, char: unknown): void`, `unmountLoreTab(): void`.

- [ ] **Step 1: Write `LoreTab.tsx`** (plain semantic markup; Task 5 applies the chosen design)

```tsx
import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/loreTab.css';
import { getSession, isAuthorizedEditor } from '../../../app/auth/session.js';
import { recordHref } from '../../../admin/characters/lib/route.mts';
import { buildLoreView, type LoreUnit } from './loreView.mts';

function Text({ unit, as: Tag = 'p' }: { unit: LoreUnit | null; as?: 'p' | 'span' | 'h3' }) {
  if (!unit) return null;
  return (
    <Tag className="lore-text" lang={unit.untranslated ? 'zh' : 'vi'}>
      {unit.text}
      {unit.untranslated && <span className="lore-untranslated">Chưa dịch</span>}
    </Tag>
  );
}

function EditorLink({ id }: { id: string }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    void getSession().then((session: unknown) => { if (live) setAllowed(isAuthorizedEditor(session)); });
    return () => { live = false; };
  }, []);
  return allowed ? <a className="lore-edit-link" href={recordHref(id, 'lore')}>Sửa trong Admin</a> : null;
}

function LoreTab({ char }: { char: { id?: string } & Record<string, unknown> }) {
  const view = buildLoreView(char);
  return (
    <section className="lore-tab" aria-label="Hồ Sơ Lưu Trữ">
      <header className="lore-tab-header">
        <h2>Hồ Sơ Lưu Trữ</h2>
        {char.id && <EditorLink id={char.id} />}
      </header>
      {view.empty && <p className="lore-empty">Chưa có hồ sơ lưu trữ.</p>}
      {view.archive && (
        <figure className="lore-archive">
          <img src={view.archive.image} alt="Hiện vật" loading="lazy" onError={(e) => { e.currentTarget.closest('figure')?.remove(); }} />
        </figure>
      )}
      {view.facts.length > 0 && (
        <dl className="lore-facts">
          {view.facts.map((f) => (<div key={f.label}><dt>{f.label}</dt><dd><Text unit={f.value} as="span" /></dd></div>))}
        </dl>
      )}
      <Text unit={view.intro} />
      {view.reports.map((r, i) => (
        <article key={i} className={r.special ? 'lore-report lore-report-special' : 'lore-report'}>
          <Text unit={r.title} as="h3" />
          {r.unlock && <p className="lore-unlock">Mở khoá: <Text unit={r.unlock} as="span" />{r.unlockLevel !== null && ` (cấp ${r.unlockLevel})`}</p>}
          <Text unit={r.content} />
        </article>
      ))}
      <Text unit={view.relicIntro} />
      {view.timeline.length > 0 && (
        <ol className="lore-timeline">
          {view.timeline.map((t, i) => (<li key={i}><Text unit={t.label} as="span" /><Text unit={t.story} /></li>))}
        </ol>
      )}
    </section>
  );
}

let root: Root | null = null;

export function unmountLoreTab() {
  root?.unmount();
  root = null;
}

export function mountLoreTab(container: HTMLElement, char: unknown) {
  unmountLoreTab();
  container.innerHTML = '';
  root = createRoot(container);
  root.render(<StrictMode><LoreTab char={char as { id?: string } & Record<string, unknown>} /></StrictMode>);
}
```

  If `tsc` rejects the untyped JS import `session.js`, add `// @ts-expect-error untyped JS module` only if `allowJs` is off — check how `AppNav.tsx` imports JS helpers and copy that pattern.

- [ ] **Step 2: Wire the tab** in `characterDetail.js`
  - import: `import { mountLoreTab, unmountLoreTab } from '../lore/LoreTab.tsx';`
  - first line of `renderTabContent`: `unmountLoreTab(); // every tab swap and character change goes through here`
  - new case before `default`:

```js
    case 'lore':
      mountLoreTab(container, char);
      break;
```

  - nav, after the Thư Viện link:

```html
          <a href="#/characters/${slug}/lore" class="cd-tab-item ${normTab === 'lore' ? 'active' : ''}">
            <span class="tab-label">Hồ Sơ Lưu Trữ</span>
          </a>
```

  - update the nav comment to list the six tabs. Check whether any other place renders `#cd-tab-content` directly (grep `cd-tab-content`); if the character view can be left for another route without `renderTabContent`, call `unmountLoreTab()` there too.

- [ ] **Step 3: Minimal `loreTab.css`** — layout only, tokens only (look up names in `src/styles/tokens.css`):

```css
.lore-tab { display: grid; gap: var(--space-4, 1rem); }
.lore-text { white-space: pre-line; }
.lore-untranslated { margin-inline-start: .5em; font-size: .75em; padding: .05em .45em; border-radius: 999px; color: var(--text-muted); border: 1px solid var(--border-subtle); white-space: nowrap; }
.lore-archive img { max-width: 100%; height: auto; display: block; }
```

  Replace the fallback values / variable names with the real token names; no literal colours.

- [ ] **Step 4: Verify** — `npm test`, `node_modules/.bin/tsc -p tsconfig.json --noEmit`, `npm run build` all green. Then `preview_start whmxcalc-vercel-dev` (or Playwright if the pane hangs) and check: A0024 (`/lore` direct link, cold load), a character whose `relic_info` is `{}` (find one with `node -e` over `public/data.json`), switch lore → overview → lore → another character quickly 5×, reduced motion; no console errors; `document.querySelectorAll('.lore-tab').length === 1`.

- [ ] **Step 5: Commit**

```bash
git add src/features/characters/lore/LoreTab.tsx src/features/characters/styles/loreTab.css src/features/characters/views/characterDetail.js
git commit -m "feat(lore): Hồ Sơ Lưu Trữ tab on character pages (functional layout)"
```

---

### Task 4: Visual direction (owner picks)

**Files:**
- Create: `docs/public-redesign/lore-tab/design-demos/direction-{a,b,c}.html`, `docs/public-redesign/lore-tab/direction-approved.md`

- [ ] **Step 1:** Invoke `huashu-design`; read `.agents/skills/design-taste-frontend/SKILL.md`, `.agents/skills/high-end-visual-design/SKILL.md`, `.agents/skills/redesign-existing-projects/SKILL.md` (owner's taste pack; huashu is the rule book, taste gives the references). Inputs: this site's tokens (`src/styles/tokens.css`), the character page as it is (screenshot the real A0024 overview), real A0024 lore text from `public/data.json` (CN + a few VI lines), the archive image URL.
- [ ] **Step 2:** Produce 3 self-contained HTML demos (dark, tokens only, 375 px + desktop), each showing: archive image + facts, intro, 4 reports + 1 special report (the fold/expand behaviour is decided here — Q4), relic intro, timeline, the "Chưa dịch" chip, the editor link, and where the reveal effect sits (heading/short intro only).
- [ ] **Step 3:** Show the owner (screenshots or the HTML files) and wait for the pick / mix. Record the decision in `direction-approved.md` (what was chosen, fold behaviour, any rejected ideas). No product code in this task.
- [ ] **Step 4: Commit** the demos (no screenshots with e-mails) + `direction-approved.md`.

---

### Task 5: Apply the chosen design + reveal effect

**Files:**
- Modify: `src/features/characters/lore/LoreTab.tsx`, `src/features/characters/styles/loreTab.css`
- Test: extend `loreView.test.mts` only if the design needs new derived data (e.g. a default-open report index) — put that logic in `loreView.mts`, TDD.

**Interfaces:**
- Consumes: `direction-approved.md`, `createLoreReveal(element, options?) → { start(text), cancel() }` from `src/ui/loreReveal.js` (it already honours `prefers-reduced-motion`).

- [ ] **Step 1:** Restyle markup/CSS to the approved direction (tokens only, no bare `hidden`; folding with native `<details>/<summary>` if the direction folds reports).
- [ ] **Step 2: Reveal effect, removable in one place** — in `LoreTab.tsx`:

```tsx
// Owner Q6: reveal only the tab heading. To drop the effect, set this to false (or delete this block).
const LORE_TAB_REVEAL = true;
```

  Use a `ref` on the heading and in a `useEffect`: `if (!LORE_TAB_REVEAL || !ref.current) return; const r = createLoreReveal(ref.current); r.start('Hồ Sơ Lưu Trữ'); return () => r.cancel();`. Never on reports.
- [ ] **Step 3: Verify** as in Task 3 Step 4, plus the approved design at 375 px, ~1024 px and desktop; screenshot for the owner (no e-mail visible).
- [ ] **Step 4: Review** with `ponytail:ponytail-review`; fix findings.
- [ ] **Step 5: Commit**

```bash
git add src/features/characters/lore/ src/features/characters/styles/loreTab.css
git commit -m "feat(lore): approved look for Hồ Sơ Lưu Trữ; heading reveal behind LORE_TAB_REVEAL"
```

---

### Task 6: Ship and verify on the deployed site

- [ ] **Step 1:** `npm test`, `npm run test:tools`, `tsc --noEmit`, `npm run build` green.
- [ ] **Step 2:** `git push origin HEAD:main`, then `git push origin feat/postgres-admin-crud`; wait for Production Ready (`npx vercel ls whmxsite --prod`).
- [ ] **Step 3:** On https://whmxsite.vercel.app: A0024 `/lore` cold load, a character without relic info, archive image loads from R2 (200), no console errors, 375 px + desktop.
- [ ] **Step 4:** Update `docs/WHMX_CURRENT_STATE_FINAL_2026-09-26.md` (§1 admin/site description, §2 status row, §8 backlog row → done; note `LORE_TAB_REVEAL`), commit, push the same way.
- [ ] **Step 5:** Keep only the 5 newest Vercel deployments (owner rule 2026-09-26): list with `npx vercel ls whmxsite --format=json` (paginate with `--next`), confirm the Production alias target is among the kept ones, `npx vercel remove <url> --yes` for the rest.
