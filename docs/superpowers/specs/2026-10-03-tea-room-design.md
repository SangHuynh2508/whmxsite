# Tea room (Phòng trà) — design (spec)

> Status: **draft for owner review, 2026-10-03.** Next after approval: `huashu-design` (3 directions → owner picks →
> `docs/public-redesign/tea-room/direction-approved.md`, impeccable `detect`) → `superpowers:writing-plans` →
> `superpowers:executing-plans`. Entry point: [`../../WHMX_CURRENT_STATE_FINAL_2026-10-02.md`](../../WHMX_CURRENT_STATE_FINAL_2026-10-02.md).
> Builds on the lore pipeline ([`2026-09-24-lore-pipeline-design.md`](2026-09-24-lore-pipeline-design.md)) and the public
> lore tab ([`2026-09-26-public-lore-tab-design.md`](2026-09-26-public-lore-tab-design.md)). Story lore was surveyed and
> parked the same day: [`../../plans/WHMX_STORY_LORE_NOTES_2026-10-03.md`](../../plans/WHMX_STORY_LORE_NOTES_2026-10-03.md).

## 1. Goal and scope

Each Khí Giả's tea room (品茗) conversation on the character page, in Vietnamese, as **an archive like the profile** —
not a guide. A player in the tea room can find the Chinese option on screen and read what the character says; a lore
reader reads the conversations as part of the character.

- **In scope:** importing the tea-room data into the DB (with the profile), Admin translation (new "Phòng trà" module,
  shared terms in Từ điển), publishing in the existing lore document, a public tab "Phòng Trà", the game sprites it needs.
- **Out of scope:** translating the ~4 500 texts (the owner translates in Admin; Claude does not), a "play it" simulator,
  tea gameplay numbers (`highteaMain`: drop tables, character counts), tea tasks (`TeaTaskMap`), voice lines, story lore.

## 2. How the game's tea room works (evidence)

| Fact | Evidence |
|---|---|
| A conversation has 4 questions: **缘起** (Q1), **相知** (Q2), **契合** (Q3 and Q4). Q1/Q2 offer 3 options, Q3 and Q4 offer 2 | Owner, screenshots 2026-10-03 ("话题进度" bar, "请选择想要展开的话题：") |
| Every one of the 141 characters in `playerAskMap` has the same 14 topics: 8 × `TopicType 1` (the Q1/Q2 pool: 4 × `Trend 1`, 4 × `Trend 2`), 2 × `TopicType 2` (Q3 openers, `Trend 0`, each `TopicNext` = 2 IDs), 4 × `TopicType 0` (Q4 follow-ups, one `Trend 1` and one `Trend 2` under each opener) | `playerAskMap` r3075, counted for all characters |
| After a reply the game shows a reaction: **hearts** when the character liked the topic, a **tangled thread** when the character was puzzled; nothing before the choice | Owner 2026-10-03. Trend 1 = liked, Trend 2 = puzzled (owner-confirmed meaning; several Trend 2 replies are stage directions such as "（对方看起来想跟你聊聊别的。）") |
| `highteaCharacterMap` (136 characters): `UPTea` = 3 favourite teas, `InterestTea` always equals `UPTea`, `ForbidTea` always empty; `Comments` = 3 lang keys; `VictoryEndLanText`, `VictoryEnd2LanText`, `FailEnd` | r3075, all rows |
| Comment *i* belongs to tea `UPTea[i]` | 80 comments name a tea; all 80 name the tea at their own position, 0 name another (r3075) |
| `VictoryEnd2LanText` "瓦铫煮春雪\n淡香生古瓷\n你们的情谊又加深了一步……" is the **result card title** after a successful tea, identical for all 136 | Owner screenshot of the result card; r3075 |
| Tea names: `itemMap` 81001–81015 `nameLanText` (大麦茶 … 冰茶) | r3075 |

Sprites (pulled from MuMu 2026-10-03, MD5 = r3075; extracted to `_claude_scratch/tea_icons/`):
`uiatlas_uiteatastsip.ab` → `ui_pm_hgxz` (hearts, 52×40), `ui_pm_bqk_ty` (tangled thread, 59×48),
`ui_pm_qxjdt_d1/d2/d3` (calligraphy 缘起 / 相知 / 契合); `Packet61_AllSprites/935c71fb…/ui_pm_tea_<81001–81015>.png`
(tea-room tea art, 86×141).

## 3. Owner decisions (2026-10-03)

| # | Decision |
|---|---|
| D1 | Archive, not a guide: **no "nên chọn / không nên chọn"**. The reaction the game shows after a reply (hearts / tangled thread) is shown after the reply, as the game does |
| D2 | A tab on the character page (Khí Giả) |
| D3 | The player's option always shows the Chinese next to the Vietnamese, to match the game screen |
| D4 | Text lives in the DB; translated by the owner in Admin; Claude does not translate |
| D5 | Teas shown with the game's tea art and name |
| D6 | Characters on the site only (W0021 and the 5 codes missing from `characterTable` are skipped) |
| D7 | Section names = the game's calligraphy sprite + the Vietnamese name (translated in Từ điển) |
| D8 | The shared result poem is kept, translated once |

## 4. Data model (extends the profile; one small migration)

Tea rides on the existing profile: `character_profiles` + `profile_texts` + `lore_terms`, so it reuses the importer,
revisions/409, history, publish (~30 s auto + "Xuất bản ngay"), daily backup and restore without new tables.

**Migration 0009:** `lore_term_kind` += `tea`, `tea_text` (two `ALTER TYPE … ADD VALUE`, like 0006).

**`profile_texts` unit keys** (CN from the sources in §2):

| Unit key | Source |
|---|---|
| `tea.<topicId>.ask` | `playerAskMap.<topicId>.TopicContentLanText` (the player's option) |
| `tea.<topicId>.reply` | `playerAskMap.<topicId>.TopicRespLanText` |
| `tea.comment.<1-3>` | lang `highteaCharacterMap.<id>.Comments[i]` |
| `tea.win` | `highteaCharacterMap.<id>.VictoryEndLanText` |
| `tea.lose` | `highteaCharacterMap.<id>.FailEnd` |
| `tea.result` | only when a character's `VictoryEnd2LanText` differs from the shared one (none today) |

**`character_profiles.structure.tea`** (only when the character has tea data, so others keep their hash):

```json
{ "teas": ["81008", "81007", "81015"],
  "topics": [{ "id": "A0024101", "trend": 1 }, …8],
  "branches": [{ "id": "A0024301", "next": [{ "id": "A0024303", "trend": 1 }, { "id": "A0024304", "trend": 2 }] }, …2] }
```

Order = the game's ID order. `trend` is stored raw; only the public shaper maps it (§6).

**`lore_terms`:** kind `tea`, code = item id (`81001`…), `name_cn` = `itemMap.nameLanText`, `detail_cn` = `''`;
kind `tea_text`: `TEA_STAGE_1/2/3` (`name_cn` 缘起 / 相知 / 契合 — from the game's sprites, `source` noted as the sprite
name, the one CN value not read from a table) and `TEA_RESULT` (`name_cn` = the shared `VictoryEnd2LanText`).

## 5. Importer

`scripts/import-character-profile.mjs` (same `--check` / plan / `--apply` rules; owner yes for every DB write):

- Reads `playerAskMap.json`, `highteaCharacterMap.json`, `itemMap.json` (teas only). Comments are lang keys: a small
  Python reader `scripts/read_tea_lang.py` (pattern of `read_profile_legacy_vi.py`) decodes the **current** lang file
  (`MasterData/lang/<v>_cn.bin`, `<v>` from the newest `provenance/launch_*.json`) with NeoArtifacts' `lang_from_cipher`
  and prints only the requested keys. The receipt hash covers the three JSON files and the lang version.
- Pure part in `scripts/lib/profile-source.mjs` (`normalizeProfileSources` gains the tea units, `structure.tea` and terms).
- Rules: a `TopicNext` ID that does not exist, or a comment key missing from lang → abort, naming it. A character with
  topics but no `highteaCharacterMap` row → topics only. `--check` lists characters whose topic shape is not 8 / 2 / 4
  and characters whose `VictoryEnd2LanText` differs (they get `tea.result`).
- First `--apply` touches every profile once (new `structure.tea` changes each profile's source hash): revisions bump,
  `last_edit_at` set, so the next publish ships it. CN changes later follow the existing rule (`source_changed`, VI kept).

## 6. Publish shape (`profile.tea` in the v2 lore document)

`shapeCharacterProfile` adds, when `structure.tea` exists:

```json
"tea": {
  "teas":     [{ "code": "81008", "name": "大吉岭茶", "name_vi": null, "comment": "CN", "comment_vi": null }],
  "topics":   [{ "ask": "CN", "ask_vi": null, "reply": "CN", "reply_vi": null, "reaction": "like" }],
  "branches": [{ "ask": "…", "ask_vi": null, "reply": "…", "reply_vi": null,
                 "next": [{ "ask": "…", "ask_vi": null, "reply": "…", "reply_vi": null, "reaction": "puzzled" }] }],
  "win": "CN", "win_vi": null, "lose": "CN", "lose_vi": null, "result": null
}
```

- `reaction`: `trend 1 → "like"`, `trend 2 → "puzzled"`, anything else → `null` (openers). No raw IDs or trend numbers in
  the output. `result` is non-null only for a character with its own `tea.result`.
- The document gains one shared block: `{ "version": 1, "characters": {…}, "tea": { "stages": [{cn, vi}×3], "result": {cn, vi} } }`
  (`buildLoreDocument` takes it; the loader keeps working with documents that lack it).
- `_vi` follows `publishableVi` (admin + ok). **[spec choice]** Tea units do not move `vi_updated_at` (Home "Mới dịch"
  stays about the archive texts).

## 7. Admin

- **Module "Phòng trà"** (`id: 'tea'`) in the Khí Giả record, after Lore. It is the Lore editor with a unit filter:
  LoreModule takes `scope: 'lore' | 'tea'`; `lore` hides `tea.*` units, `tea` shows only them; drafts are kept per scope.
  Same API (`GET/PATCH lore/characters/:id`), so one revision: saving tea and lore of one character in two tabs at once
  gives the usual 409 "Xem khác biệt".
- Grouping (`teaUnitGroups` in `lib/loreUnits.mts`): **Trà** (comment labelled with the tea name) · **缘起 · 相知**
  (8 pairs "Chủ đề n — Hỏi / Đáp", reaction shown as a small label beside "Đáp") · **契合** (opener + its 2 follow-ups,
  indented) · **Kết thúc** (thành công / thất bại).
- Progress: the Lore counter and the character list count only non-`tea` units (`loreProgress` split by prefix); the
  tea module shows its own "x/y".
- **Từ điển → Lore** lists the new kinds (labels "Trà", "Phòng trà"); `termUsage` counts teas from `structure.tea.teas`.

## 8. Public tab "Phòng Trà"

- Route `#/characters/<slug>/tea`, tab label **Phòng Trà**, between Hồ Sơ Lưu Trữ and Thư Viện; React island
  `src/features/characters/tea/TeaTab.tsx` (mounted/unmounted from `characterDetail.js` like the lore tab), pure
  `teaView.mts` (tested), CSS `styles/teaTab.css` (tokens only).
- Content, in order:
  1. **Trà yêu thích** — 3 × (tea art, VI name + CN, the character's comment on it).
  2. **缘起 · 相知** (calligraphy sprites + VI names) — a line "Trong game, mỗi câu hiện 3 trong 8 chủ đề", then the 8
     exchanges in game order: player option (VI, CN small beside it) → character reply (avatar, VI) → reaction sprite.
  3. **契合** — "Mỗi lượt hiện 2 chủ đề; chủ đề đã chọn mở ra 2 câu tiếp": 2 openers, each with its 2 follow-ups
     indented under it (stacked on phones), reactions after the follow-up replies.
  4. **Kết thúc tiệc trà** — success line, the result poem, failure line.
- A reply entirely inside full-width brackets "（…）" is a stage direction: shown as narration (no avatar, ash text).
- Untranslated text = CN in Noto Serif SC with the small dot + "(chưa dịch)" (Original Name Rule). A character without
  tea data shows "Chưa có dữ liệu phòng trà.".
- Reaction sprites sit on a small paper-tone chip (the thread sprite is dark grey and vanishes on night-ink); the exact
  treatment is settled in huashu. No ✓/✗, no colour coding.
- Motion: `useReveal` (reading order), reduced-motion path. Dark only; nothing scrolls horizontally at 390 px.
- **Look:** decided after this spec with `huashu-design` (3 directions; one borrows the game's frame — character drawing
  beside the conversation, paper dialogue boxes — within DESIGN.md's palette), then impeccable `detect`.

## 9. Assets

Copied into `public/assets/tea/` (lowercase names, committed like the other game sprites): `tea_<81001–81015>.png`,
`react_like.png` (`ui_pm_hgxz`), `react_puzzled.png` (`ui_pm_bqk_ty`), `stage_1-3.png` (`ui_pm_qxjdt_d1–d3`). Source and
bundle names recorded in a short README in that folder. A release-day note in `WHMX_COMMANDS.md` (new tea → copy its art).

## 10. Errors and verification

| Area | Failure | Behaviour |
|---|---|---|
| Importer | broken `TopicNext`, missing lang key, lang file not found | abort before writing, name the ID/key/file |
| Importer | odd topic shape / differing result poem | listed by `--check`, imported as data says |
| Overlay | R2 overlay fails to load | `data.json` already carries `profile.tea` in CN (the release-day `export-profile-overlay --shape v2` step uses the same shaper, ~+1 MB); stage names fall back to the CN on the sprites, the shared poem is left out |
| Publish | document without the shared `tea` block (published before this feature) | stage names in CN, no poem, until the next publish |
| Public | sprite missing | text still renders; image `alt` empty (decorative) |

Tests (node:test, one check per piece): tea normalization on fixture rows (A0024 shape, broken `TopicNext`), v2 shaper
(reaction mapping, `publishableVi`, no IDs), document shared block, `loreProgress` split, `teaUnitGroups`, `teaView`
(order, stage-direction detection, CN fallback). Browser: dev 3003 with a test translation on development, 1440 / 390 px.
DB steps needing the owner: migration 0009 (development, then production), importer `--apply` (development, then
production), first production publish.
