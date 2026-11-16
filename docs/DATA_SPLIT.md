# Data split: what the browser loads (2026-11-14)

The owner asked for this change on 2026-11-14 so the site stays fast as features are added.

## Before and after

**Before.** Every page fetched `public/data.json`, which is 17 MB raw and 2.7 MB gzip, before it could render.

**After.**

| What the browser fetches | When | Size |
|---|---|---|
| `/data/index.json` | at boot, on every page | ~0.6 MB raw, **79 KB gzip** |
| `/data/c/<id>.json` | when a character page, the calculator, or the admin Build module opens that character | up to ~360 KB raw |
| `/data/buffs.json` | once, together with the first character | ~0.7 MB raw |

## What did NOT change

- `public/data.json` is still **the source**.
- `tools/build_web_data.py` still writes it.
- These still read it from disk as before:
  - every Python tool;
  - `tools/prerender.mjs`;
  - `server/builds/*.mjs` and `server/tier-lists/*.mjs` (Vercel Functions bundle it by file tracing).
- Never edit `public/data/` by hand.

## How the split files are made

- `tools/split_data.mjs` generates `public/data/`:
  - `index.json`: all characters minus the detail fields, plus `items`, `expCurve`, `rankUpRules` and `asset_base_url`;
  - `c/<id>.json`: the detail fields of one character;
  - `buffs.json`: `buff_registry`.
- Detail fields are `skills`, `talents`, `zhizhi`, `brilliant_skills`, `brilliant_info` and `profile`. They are listed in `DETAIL_FIELDS`.
- In the index, each character keeps `profile: { department, record_id }` only, for the catalogue search.
- It runs automatically as npm `predev` and `prebuild`, so `npm run dev`, `npm run build` and the Vercel build regenerate it.
- `public/data/` is gitignored. Test: `tools/split_data.test.mjs`.

## Frontend contract (`src/data/loader.js`)

- `loadGameData()` / `getGameData()` return the **index**. Light fields are always there. Detail fields are present only after the character has been loaded.
- `loadCharacterDetail(id)` fetches the character's detail file and merges it into `getGameData().characters[id]`. The first call also loads `buffs.json` into `getGameData().buff_registry`.
  - It is cached per id.
  - A failure is retried on the next call.
- `isCharacterDetailLoaded(id)` returns true once that merge has happened.
- Lore overlay (R2): `mergeLoreOverlay` still replaces `profile` on index characters. When the overlay has already set a character's profile, a later detail load does **not** overwrite it.

## Callers that wait for a character's detail

| Caller | What it does |
|---|---|
| `features/characters/views/characterDetail.js` | Loads, then renders the latest request. Shows `ldErr` on failure. |
| `ui/calcCharacterPicker.js` (`selectCalculatorCharacter`) | Loads, then selects. The last pick wins. |
| `admin/characters/modules/BuildModule.tsx` (`loadSite`) | Loads before reading the character's skills. |

## Rule for new code

Anything that reads a detail field of **many** characters at once (for example a skill search across the roster) must not assume the field is there.

**Options:**
- Add the small piece it needs to the index in `tools/split_data.mjs`, as was done for the profile brief.
- Give the feature its own JSON file, the way `/coffee` uses `coffee.json` and `/banners` uses `banners.json`.

New features (equipment, stages, monsters, etc.) get their own file in `public/`. **They do not go into `data.json`.**

## Verified 2026-11-14

- After `loadCharacterDetail`, all 138 characters were compared field by field with `data.json` in the browser:
  - every field matched;
  - `buff_registry` and the other top-level keys were identical;
  - overlay profiles were kept.
- Home and the catalogue load only `index.json`.
- Character pages and the calculator (31 talent nodes for A0003) render.
- No console errors. 305 tests passed.
