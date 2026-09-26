# Character Build (tab "Build") — design

> Date: 2026-09-26. Status: **draft, waiting for owner review.** Owner answers given in chat on 2026-09-26 (§2).
> Visual design is decided after this spec: `huashu-design` (3 directions, owner picks) + the taste pack, with the owner's
> reference build card (content creator's 幻戏图 build: weapons, affixes, 深造, rating, rotation, tips, team comps) as input.

## 1. Goal

Every character page has a **Build** tab that today only says "Chưa có hướng dẫn build". Replace it with builds written by the
owner/editors in Admin, made of **game data picked from lists** (weapons, affixes, 深造 path + points, skills, team members) plus
short **free text** (labels, rating, notes, tips). A character may have several builds (tabs), and one build may list several
team comps.

Success: an editor can write a full build (like the reference card) in Admin without typing any game name by hand; it appears on
the public Build tab ~30 s after saving; every game term shows VI when translated, else CN.

## 2. Owner decisions (2026-09-26)

| # | Question | Decision |
|---|---|---|
| B1 | Builds per character | **Several** (tabs, e.g. "Chuẩn", "Boss"); start with one |
| B2 | Weapons | Up to **4**, each with a free-text label ("Chịu đòn", "Di chuyển", "Hồi năng", "Tuỳ chọn") |
| B3 | Affixes (词条) | Groups (label + ordered affixes) + flag "Không cần tẩy luyện vũ khí" |
| B4 | 深造 | Pick 1 of the character's 3 styles + 4 column points; the **style** is prefilled from the game's own `TalentRecommend` (its first entry is a `styleTalent`, e.g. `DK_1002` = 固防); points start at 0; hover a column → its talents. **Max 7 per column** (owner confirmed), total ≤ 11 |
| B5 | Skill rotation | Several rotations (label, e.g. "0 dupe", + skills picked in order) + a list of tips |
| B6 | Team comps | **Blocks with "Thêm đội hình"**: each block = label + characters picked by **avatar** + note; plus a free "Khác" line |
| B7 | Per-skill mechanics notes | **No** — the skill tab already has them |
| B8 | Translations of game names | Yes — translated in Admin (like lore terms), CN fallback |
| B9 | Weapon details | **Popup** (icon, rarity frame, name, weapon skill). The same popup is reused later by an **Info/database section** (tabs Vũ khí, Item…, like s1n.gg) — so no separate weapons page now |
| B10 | Data flow | **DB-first** (owner): game reference data is imported into the DB; builds are edited in the DB; both are published to R2 (the public site never reads Postgres) |

## 3. Game data (evidence, NeoArtifacts `MasterData/json`)

| Data | Source | Notes |
|---|---|---|
| Weapons | `equipments.json` (110) | `id`, `NameLanText`, `job` (22 per job 1–5), `rare` (2:10, 3:20, 4:30, 5:50), `star`, `Series`, `equipSkill[]`. Same ids are `itemMap` rows with **`type: 9`** (exactly 110) — that is how weapons differ from other items |
| Weapon lore | `equipmentFiles.json` (110) | classify / material / maker / text (optional in the popup later) |
| Weapon skills | `equipmentSkills.json` | `NameLanText`, `DescriptionLanText` with parameter templates (`[Effect1Para,1]`) → resolved like character skills |
| Weapon icons | `Assets/ItemIcons/itemicon_<id>.png` | 105/110 present; 5 missing → empty frame until found |
| Rarity frames | `Assets/Packet61_AllSprites/…/itemRare0..5.png` (+ `itemRareK`) | 0 grey, 1 green, 2 teal, 3 yellow, 4 red, 5 multicolour (manual scan `allsprites_manual_scan/page_009.jpg`). **Assumption to verify:** frame = `itemRare{rare}`; confirm with one in-game rare-5 weapon screenshot before shipping |
| Affixes | `additionalAttrs.json` (24) | name, `%` display, `addAttr`, allowed `job[]`, values per rarity |
| 深造 styles | `jobStyleMap.json` (15 = 3 per job) | name (e.g. 固防), icon, `styleTalent`, 4 `sector` ids |
| 深造 columns | `sectorMap.json` (60) | name (e.g. 重峦), icon, 7 talent ids (one per point) |
| Column talents | `talentBankMap.json` | plain text, e.g. `D20101` "护盾增益+15%" |
| Character styles + game recommendation | `characterTable.json` `JobStyle`, `TalentRecommend` | e.g. D0017: styles 101/102/103, recommend `DK_1002` + sectors `D2_01, D3_01, D1_03`. The sector list spans **three different styles** (D1_/D2_/D3_), so its meaning is unknown — imported as-is, **not used** until confirmed in-game |
| Skills | already in `data.json` (with icons) | picked for rotations |

## 4. Architecture

> Extends architecture §11/§12 (2026-09-24): existing domains keep `data.json` as the game-data channel; **new domains are DB-first** (owner direction, 2026-09-26) — MasterData is imported into Postgres and published to R2 with the lore document. The public site still never reads Postgres.

- **Reference data in the DB** (new migration):
  - `game_references (kind, code, data jsonb, source_hash, source_present, …)` — kinds `weapon`, `weapon_affix`, `job_style`,
    `style_sector`, `character_style` (JobStyle + TalentRecommend per character). Structural fields only (job, rare, icon key,
    skill link, sector list, talent ids…).
  - **Translatable text goes to `lore_terms`** with new kinds (`weapon`, `weapon_skill`, `weapon_affix`, `job_style`,
    `style_sector`, `style_talent`): `name_cn/detail_cn` from MasterData, `name_vi/detail_vi` edited on the existing Admin
    **Thuật ngữ** page, same publish rule (`publishableVi`). Weapon-skill descriptions are stored **resolved** (numbers filled).
- **Importer** `scripts/import-game-references.mjs` (plan by default, `--apply` with owner yes), same shape as the profile
  importer: pure normaliser (MasterData → rows) + planner (insert/update/unchanged, never touches VI) + apply in one transaction.
  Runbook N2 gains one step (run it after a game update).
- **Builds**: table `character_builds (id, character_entity_id, position, doc jsonb, revision via managed_entities, timestamps)`
  + `edit_history` rows. `doc` = the shape in §5. Server validates every id against `game_references` (weapon job = character job,
  style ∈ character's 3 styles, affix allowed for the job, skills belong to the character, team members exist, points 0–7 each and
  total ≤ 11).
- **Publish**: the R2 lore document gains `builds: {characterId: Build[]}` and `refs: {weapons, affixes, styles, sectors,
  talents}` (CN + published VI). Same pointer, backup, `--repoint` rollback and ~30 s auto-publish after a save.
- **Icons**: weapon icons + rarity frames go to **R2** (new asset category, `tools/publish_assets.py`), not `public/assets`
  (keeps each Vercel deployment small).
- **Admin**: new module **Build** in the Khí Giả record (`MODULE_IDS` + `build`), React + TS, tokens only. Pickers for all game
  data (weapon grid filtered by job with icon + frame; affix list filtered by job; style cards; 4 column steppers 0–7 with a live
  total; skill chips in order; team blocks with "Thêm đội hình" and an avatar picker); text inputs for labels/rating/notes/tips.
  Save with `expectedRevision` (409 on conflict, like lore), draft kept in the browser like the other modules.
- **Public**: the Build tab renders the published builds (tabs when > 1): weapon tiles (icon in rarity frame + label → popup),
  affix groups + "Không cần tẩy luyện", 深造 panel (style + 4 columns with points; hover → talents), rotations as skill icons +
  tips, team blocks (avatars link to those characters), rating + note. Characters without a build keep today's empty state.

## 5. Build document (per build)

```
{ name, rating, summary,
  weapons: [{ weaponId, label }],                    // ≤ 4, job must match
  affixes: { noReroll: bool, groups: [{ label, affixIds: [] }] },
  deepen:  { styleId, points: [a, b, c, d] },       // each 0–7, sum ≤ 11
  rotations: [{ label, skillIds: [] }], tips: [text],
  teams: [{ label, characterIds: [], note }], teamOther: text }
```

## 6. Testing

- Pure normaliser tests for the importer (weapons ↔ itemMap type 9, affix jobs, styles → 4 sectors → 7 talents, TalentRecommend).
- Weapon-skill parameter resolution: tests with real templates (e.g. `ED2031` "…提高<color>[Effect1Para,1]%</color>").
- Build validator tests: wrong-job weapon, foreign style, disallowed affix, points > 7 / total > 11, unknown ids, > 4 weapons.
- Browser: write a build in Admin (dev DB) → published → visible on the public tab; popup, hover, team links; 375 px + desktop.

## 7. Out of scope (later)

Info/database section (Vũ khí, Item tabs reusing the weapon popup), tier list (next spec — its tiles link to builds), game boss
team recommendations (`Recommends`, `BossTowerRecommendedMap`) → Info later, voice lines (separate route), weapon lore text in the
popup (`equipmentFiles`) unless the design step wants it.
