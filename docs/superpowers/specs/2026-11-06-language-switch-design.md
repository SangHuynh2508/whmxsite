# Language switch VI / CN (public site)

Date: 2026-11-06 · Status: draft, waiting for owner review

## Goal
Let the reader pick VI or CN for the whole public site. Today, a VI label often has its CN original printed beside it; that interleaving goes away.

## Decisions (owner, 2026-11-06)
- There are two modes, VI and CN. VI is the default. The "both" mode goes away.
- **VI mode:** each field uses `*_vi`. When a field is empty, it falls back to `*_cn`, exactly as today: same untranslated dot / `lore-cn` style, no new label.
- **CN mode:** every field uses `*_cn`, and UI strings use CN.
- **Character name in VI mode:** the small Han characters under the character header title stay. Every other "VI + CN beside it" pair shows only the active language.
- **UI strings:** nav, tab titles, buttons and stat labels move into one module, `src/i18n/strings.ts` (`{ vi: {...}, cn: {...} }`). No i18n library.
  - CN text uses the in-game term where one exists.
  - CN text that Claude drafts is marked `// draft` until the owner checks it.
- **Persistence:** the choice is stored in `localStorage` under `whmx.lang`. `?lang=cn|vi` in the URL overrides it and is written back, so shared links open in the same language.
- **Toggle placement:** the toggle goes in the sidebar nav (`AppNav.tsx`), directly above the Quản trị / Đăng nhập item.
  - Expanded sidebar: `VI | 中`.
  - Collapsed sidebar: shows the current code only, with a tooltip.
  - The mobile menu gets the same toggle.
- **Out of scope:** the Admin, the workbook, `build_web_data`, the DB and R2 payloads. No data format changes.

## Architecture
- `src/i18n/lang.mts`:
  - `getLang()`.
  - `setLang(l)`, which writes localStorage and the URL and dispatches a `whmx:lang` event.
  - `pick(obj, field)`: in VI it returns `{ text: obj[field+'_vi'] || obj[field+'_cn'] || '', untranslated: !obj[field+'_vi'] }`; in CN it returns `{ text: obj[field+'_cn'] || '', untranslated: false }`.
  - It also sets `<html lang>`.
- `src/i18n/strings.ts` plus `s(key)`, which returns the string for the current language.
- **Re-render:** on `whmx:lang`, call the router's `handleRoute()`, which re-renders the current view. React islands read `getLang()` while rendering; AppNav subscribes to the event. No reload.
- The existing `Unit = {text, untranslated}` (`buildView.mts`, lore, tea, banners) is fed by `pick`, so CN mode never shows the untranslated dot.

## Touch points (from grep, public site only)
| Area | Files |
|---|---|
| Character detail | `infoView.js` (skills, buffs, Hoán Chương, materials), `overviewView.js`, `talentsView.js`, `galleryView.js`, `characterDetail.js`, `characterHeader.js`, `buildView.js` |
| Lists / tiles | `characterCatalogView.js`, `CharacterTile.tsx`, `calcCharacterPicker.js`, `talentGraph.js` |
| Skins | `skinGalleryView.js`, `skinDetailView.js` |
| React tabs | `LoreTab.tsx`, `TeaTab.tsx` (drop the `*-cn` side spans), `build/*` via `buildView.mts` |
| Home / banners | `HomePage.tsx`, `BannersPage.tsx`, `BannerSlice.tsx`, `bannersData.mts` |
| Shell | `AppNav.tsx` (toggle + labels), static Vietnamese strings across the views above |

Each `x.name_vi || x.name_cn` becomes `pick(x,'name')`. Each hard-coded Vietnamese UI string becomes `s('key')`.

## Phasing
1. `lang.mts`, `strings.ts`, the toggle and the re-render. The nav and the character list switch.
2. The character detail tabs (largest part: `infoView.js`).
3. Skins, home, banners, lore, tea and build.

Every phase ships on its own; untouched views stay VI until they are converted.

## Testing
- Unit tests (`*.test.mts`):
  - `pick`: VI with VI present, VI with VI missing, CN.
  - `getLang`: precedence of URL over localStorage over default.
  - `strings`: every `vi` key has a `cn` key.
- Browser check of each phase in both languages:
  - no console errors;
  - the toggle survives reload and shared URLs;
  - a 390 px width.
