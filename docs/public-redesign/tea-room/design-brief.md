# Tea room (Phòng Trà) — design brief (huashu Phase 3, shared input of the three directions)

Spec: [`../../superpowers/specs/2026-10-03-tea-room-design.md`](../../superpowers/specs/2026-10-03-tea-room-design.md).
Design system: `DESIGN.md` ("The Night Archive") + `PRODUCT.md`. Demos: `design-demos/` (serve the repo root with
`python -m http.server 8765`, open `/docs/public-redesign/tea-room/design-demos/<file>.html`).

**What it is.** A new tab "Phòng Trà" on the character page (beside Hồ Sơ Lưu Trữ): the character's tea-room (品茗)
conversation as an **archive**, not a guide (owner D1: no "nên chọn / không nên chọn").

**Who and where.** (1) A player sitting in the game's tea room, phone in hand (390 px, binding: no horizontal scroll),
looking for the Chinese option shown on screen and what the character answers. (2) A lore reader at 1 m (1440 px)
reading the conversations as part of the character.

**Content (real, V0112 酒帐 "Tửu Trướng", r3075).** 3 favourite teas (大麦茶, 西湖龙井, 杏皮茶) each with the character's
comment; **缘起 · 相知** pool of 8 topics (player option → reply; 4 liked, 4 puzzled; 2 of the puzzled replies are stage
directions "（茶室里一时无人回应。）"); **契合**: 2 openers, each with 2 follow-ups (one liked, one puzzled); ending:
success line, the shared result poem (瓦铫煮春雪 / 淡香生古瓷 / 你们的情谊又加深了一步……), failure line.
**Vietnamese in the demos is illustrative only** (to judge the layout; not a translation — the owner translates in
Admin). Some entries are left untranslated on purpose: CN + small dot, as the site shows them.

**Must have.** The player option shows CN beside the VI (D3). Reaction sprite (hearts / tangled thread) after the
reply, never as advice; openers have none. Calligraphy stage sprites 缘起 / 相知 / 契合 + VI name (D7). One line explaining
the game rule ("mỗi câu hiện 3 trong 8 chủ đề", "契合: 2 chủ đề, chọn một mở 2 câu tiếp"). Stage directions as narration.
The 契合 tree (opener → 2 follow-ups) readable at 390 px.

**Tone.** The Night Archive: charcoal, one antique-gold lamp; serif (Literata) for the archive voice, IBM Plex Sans for
the tool; game sprites as the game draws them. The tea room is quiet and warm — conversation over tea, not a quiz.

**Constraints.** Dark only; colours only from tokens (via `../../home/design-demos/common.css`); 6 px corners (avatar
round); spacing 4·8·12·16·24; no shadows/gradients/glow; UI text ≥ 12 px; focus ring 2 px gold; reduced motion. The
dark-grey thread sprite needs a light paper chip behind it (it vanishes on night-ink).

**Images (on hand).** Avatar `public/assets/characters/avatars/V0112.png`; drawing (full art) and archive art on R2;
tea item icons `public/assets/items/itemicon_<id>.png` (128×128; first demos used the `ui_pm_tea` silhouette cards by mistake), reactions `ui_pm_hgxz` / `ui_pm_bqk_ty`, stages `ui_pm_qxjdt_d1–3` → `design-demos/assets/`.

**Visual motif (from the content).** A conversation across a tea table: two voices taking turns, a cup between them;
the 契合 step is a fork in the talk. The game frames it with a round moon-window and paper dialogue boxes.

**The three directions (serial, no subagents — owner rule; each built from this brief only).**
- **A · Biên bản** — roulette (`date +%S` = 18 → web style #19 *Swiss Monochrome*, read inside the Night Archive): a precise
  grid transcript; hairline rules, every exchange a row, the 契合 fork as a two-column split.
- **B · Cửa trăng** — real reference: the game's own 品茗 screen (owner screenshots): the character's drawing beside the
  talk, paper dialogue boxes, the moon-window circle.
- **C · Cuộn trà** — best designer: Kenya Hara (原研哉, *Designing Design*, Muji): emptiness and paper; one narrow
  column read like a hand-scroll, the stage calligraphy as the only ornament.
