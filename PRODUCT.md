# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Vietnamese players who cannot read Chinese** (primary). They play 物华弥新 (Vật Hoa Di Tân) and come to look things up in
  Vietnamese: skills and buffs, weapons, builds, 深造 (Thâm tạo),
  teams. Often mid-session, on a phone next to the game.
- **Lore readers.** They read the characters' archives and stories (Hồ Sơ Lưu Trữ) at length; the reading
  experience matters, not only lookup speed.
- The owner and invited editors translate and author content in the Admin; public pages are planned to gain in-place
  "Sửa build" / "Tạo build" actions for them later.

## Product Purpose

A Vietnamese wiki and calculator for 物华弥新: game data, translated text, builds and lore in one place, in Vietnamese.
Success = a Vietnamese player finds what they need (a skill number, which weapon, which 深造 points, who to team with,
what happens in a story) without leaving for a Chinese source.

## Positioning

- **Complete, careful Vietnamese.** Translation follows a terminology system and review workflow; an untranslated name
  is shown as-is (Chinese), never guessed.
- **Builds gathered from content creators, always credited** (e.g. "Tham khảo build của 新月").
- **Planned: guides and a tier list.** Neither the game's wiki nor any other site has them (the owner has only seen one
  site dedicated to the real story lore, not profiles).

## Operating Context

- Game data comes from the game's own MasterData (extracted in NeoArtifacts), passes through the human-reviewed
  workbook `localization/localization_master.xlsx`, and is built into `public/data.json`. Lore and build text is edited
  in the Admin (Postgres) and published to R2.
- Content is refreshed after each game update (release-day runbook N2).
- Owner's reference for build content: creator build cards such as 新月's (weapons, affixes, 深造 pair like 7202/7220,
  rotation, teams).

## Capabilities and Constraints

- Public site: character pages (Tổng Quan, Thông Tin, Thiên Phú, Build, Hồ Sơ Lưu Trữ, Thư Viện), skins, weapons,
  calculator. Admin: Khí Giả, lore, dictionary (Từ điển), builds.
- Terminology: 深造 = Thâm tạo, affixes = Dòng thuộc tính, characters = Khí Giả.
- Binding for all design work (owner, 2026-09-28): **dark interface only**; **no horizontal scroll at 390 px**.
- Stack and architecture are recorded in `docs/WHMX_APP_ARCHITECTURE.md`; never infer game meaning from ID shapes
  (`docs/WHMX_MASTERDATA_ID_CONVENTIONS(5).md`).
- Undecided: scope and format of guides and the tier list.

## Evidence on Hand

- Real game data for 133 characters in `public/data.json`; production builds (first: W0182, from 新月's card).
- Game sprites (rarity frames, item/skill icons, 深造 style emblems `Speciality_<id>`) in NeoArtifacts, copied into
  `public/assets/` as needed.
- No testimonials, user counts or traffic figures are on hand; do not invent them.

## Product Principles

1. Vietnamese first, never a guess: show the Chinese original rather than an unreviewed translation.
2. Credit every borrowed build or guide to its creator.
3. Data comes from the game, not from memory; numbers must match the game.
4. Serve both the quick lookup mid-game and the long read of the lore.
