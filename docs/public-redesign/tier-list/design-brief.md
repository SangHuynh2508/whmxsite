# Tier list — design brief (huashu Phase 3, shared input of the three directions)

Spec: [`../../superpowers/specs/2026-10-02-tier-list-design.md`](../../superpowers/specs/2026-10-02-tier-list-design.md).
Design system: `DESIGN.md` ("The Night Archive") + `PRODUCT.md`. Demos: `design-demos/` (serve the repo root with
`python -m http.server 8765`, open `/docs/public-redesign/tier-list/design-demos/<file>.html`).

**What it is.** The public Tier List page of WHMX: one curated list (several possible), credited to its source, with three
tabs — Solo (tiers), Đội hình (teams), Thông tin (info text). Tapping a character opens its Build tab.

**Who and where.** Vietnamese players of 物华弥新 who cannot read Chinese, often on a phone next to the game, deciding whom to
build or pull. Two distances: 10 cm phone (390 px, the binding width — no horizontal scroll) and 1 m laptop (1440 px).
They scan for "where is my character", "who is top for my job", and read the one-line tier descriptions.

**Content (real where it can be).** 47 real characters from `public/data.json` (VI names, avatars, 1 : 2 card art, job,
rarity, Hoán Chương), tiers S+ / S / A+ / A / B / C / X with descriptions (S and A+ share: `joinAbove`), badges Z1–Z6
(Trí Tri milestone) and HC (Hoán Chương), one character listed twice with different badges, 3 teams (1–6 members),
an Info text, a short note on top of Solo and Team. **Placement, teams and texts are illustrative** — the page says so.

**Must have (from the spec).** Header: title, "Tham khảo tier list của …", "Cập nhật dd/mm/yyyy". Tabs Solo / Đội hình /
Thông tin. Filters: job (5) and rarity (only the ones present), multi-select, AND; a tier left empty disappears; teams
without a matching member dim. Description line per tier group. Badge inside the avatar bottom-right ("Z3 HC"), or
"(Z3 · HC)" after the name when the art is too small. Order inside a tier is kept. Legend for Z / HC somewhere visible.

**Tone.** The Night Archive: charcoal, one antique-gold lamp, game sprites shown as the game draws them; serif (Literata)
for the archive voice, IBM Plex Sans for the tool. Quiet, scannable, a little ceremonial for the top tier — never loud.

**Constraints.** Dark only; colours only from `src/styles/tokens.css` (demos copy them via `../../home/design-demos/common.css`);
6 px corners (avatars round, role chips pill); spacing 4·8·12·16·24; no shadows/gradients/glow; no per-tier colours; UI
text ≥ 12 px (badge 11 px is a small secondary label); focus ring 2 px gold; reduced motion respected.

**Images.** Content-critical and already on hand: avatars `public/assets/characters/avatars/<ID>.png`, card art on R2
(`cards[0]`), rarity glow `public/assets/frames/ui_ty_kp_pz_<rare>.png`, job icons `public/assets/jobs/job_<n>.png`.

**Visual motif (from the content).** A tier list is a *ranking of exhibits*: the game already presents characters as
collectible cards with a rarity glow at the foot, and WHMX frames them as a museum archive. The motif is the shelf /
placard: a rank is a placard, characters are the exhibits on it.

**The three directions (serial, no subagents — owner rule).**
- **A · Bìa tạp chí** — roulette (`date +%S` = 25 → web style #6 *Bold Big-Type Editorial*, read inside the Night
  Archive): giant serif tier letters, text-only filters, round avatars.
- **B · Bảng tra** — real reference *Prydwen.gg* tier list (Honkai: Star Rail; verified 2026-10-02): a matrix of
  tiers × roles — here tiers × the 5 jobs, job icons as filters, square tiles with the game's rarity glow.
- **C · Kệ trưng bày** — best designer: *Abbott Miller (Pentagram)*, museum exhibition design: each tier a lit shelf with
  a placard and wall-label text, characters as the frameless catalogue cards (`catalog-card/direction-approved.md`).
