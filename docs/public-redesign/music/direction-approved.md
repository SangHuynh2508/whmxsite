# Âm nhạc (#/music) — approved direction (2026-11-08)

Spec: `docs/superpowers/specs/2026-11-08-music-page-design.md` · plan Task 5.

Shown (huashu gate, three real drafts on `public/music.json` r3168, the game's CD art and playable mp3s from the
WHMX_Tool export; screenshots in `design-demos/shots/`):
- A · Danh mục (`design-demos/A-danh-muc.html`): one ledger sheet, a track opens a listening card in a popover.
- B · Kệ đĩa (`design-demos/B-ke-dia.html`): the 38 Máy hát tracks as the game's CDs on shelves, the rest a text list;
  a track opens its own page `#/music/<id>`.
- C · Sổ mục lục (`design-demos/C-so-muc-luc.html`): sticky index on the left, rows open in place.

**Picked: B** (owner: "t chọn kệ đĩa B, t cũng khá thích animation, cái đĩa nhạc to ra rồi trở thành nền ở trang sau khá
hay … phần phát nhạc trang riêng thì nó cho thêm âm lượng vào").

Impeccable critique of B (dual-agent, 23/40; `.impeccable/critique/2026-11-07T18-06-45Z__…b-ke-dia…md`). Owner answers:
mini-player **yes** · fix **P1 + P2** · story chips **labels only** (no link to Hồ Sơ Lưu Trữ).

## Build contract (Task 6)

**List (`#/music`, filters in the hash: `#/music?g=story&q=…`)**
- Serif 32 px "Âm nhạc" (26 px phones) + ash lede with the version and one line explaining the ash dot (untranslated).
- Search + group tabs (`Tất cả` + 5 groups with `groupCounts`) using the site's selection ink (`useSlider`, `.seg-ink`).
- Sections under book headings (serif 19 px over a 1 px strong rule). In `Tất cả` each track sits once, under its main
  group, and the headings carry **no count** (the tabs own the counts); a filtered tab shows one section whose count
  equals the tab's.
- Máy hát = shelf of the game's discs (118 px; 3 per row on phones at ~26 vw), name centred under it on the full cell
  width with `word-break: keep-all` (critique P1: names wrapped 3 + 1), one gold-divider line under each slot.
- Other tracks = two-column text rows (one column ≤ 768 px): `trackTitle` (serif 15 px) + ash usage line (13 px). A
  Máy hát track shown in another tab keeps its disc as a 32 px thumbnail in the row (critique P2).
- Empty search: `muEmpty` + a "Xóa tìm kiếm" button.
- "Mới cập nhật" tab (owner 2026-11-08: "chỉ tab, không nhãn"), after `Tất cả`, `#/music?g=new`: the bgm the newest
  `WHMX_Tool/Xuat/CapNhat_<old>_den_<new>` run added (`new`, `new_version` in music.json); hidden when it added none.
  No badge on the tracks themselves. The dates live in `tools/music_first_seen.json` (committed), so deleting `Xuat\`
  loses nothing; a file never seen before is dated by the game version of the export.
- One track per song (owner 2026-11-08): files with byte-identical audio (30 groups, 259 files → 226 songs) merge into
  the jukebox one, else the most used, carrying every use; the merged ids sit in `also` and their links still open it.
- "Sự kiện" tab (owner 2026-11-08: "tách thành tab riêng … đặt nó ở sau máy hát"), `#/music?g=event`: one section
  per event, newest event code first (events without a code sit at the bottom, "Sự kiện chưa rõ tên" last). Truyện
  keeps main / character / other stories; a song used in both shows in both. An unnamed event track is labelled with
  the first event that used it; tracks sharing a label get " · N". Track page: "Dùng trong sự kiện" chips.
- No `<audio>` and no mp3 request until a track is played.

**Track page (`#/music/<id>`, unknown id → list)**
- Back link "Âm nhạc" (keeps the filter); disc 360 px left (220 px centred on phones), text right.
- Kind line (groups) above the title; for a labelled track the title is the label alone (the kind line already says
  "Bản đồ"); jukebox title = `name_vi` or the Chinese name with the ash dot.
- Player (own controls over one page-level `<audio preload="none">`): gold Phát/Tạm dừng 44 px, seek range with
  `aria-valuetext` "1:23 / 3:40", time, mute button + volume slider (ash accent, not gold; the level is kept across
  tracks; the slider is hidden where `volume` is read-only, i.e. iOS). Space toggles play on this page. Error →
  `muPlayError` + "Thử lại". The disc turns while playing (9 s / turn, linear) and stops where it is when paused.
- "Dùng trong truyện / màn đánh / bản đồ" as `h2` sections; story chips show `group_vi` when it exists, else the Chinese
  story name with the dot; plain labels, not links. `muMore` when `stages.count > names_cn.length`; source.
- **No file id anywhere, all text in VI (owner 2026-11-08: "dịch hết … ẩn mã file đi").** Claude translates the page
  (`localization/music_vi.json`, Hán-Việt names); event codes become event names (`EVENT_CN`, `TRACK_EVENT` in
  `tools/build_music_data.py`, from masterdata); a track with no evidence is "Bài chưa rõ tên N". The CN page shows Chinese.
- Bài trước / Bài sau (chevron icons both sides) walk the filtered list; on phones they sit side by side above the
  chips' end, 44 px tall.
- Focus moves to the `h1` (`tabindex=-1`) on every route change; `document.title` = track title · Âm nhạc.

**Mini-player — dropped (owner 2026-11-08: "ko cần cái phát nhạc sau khi đã thoát ra ngoài đâu, bỏ cái thanh phát mini
đi").** The music belongs to its track page: leaving it (back to the list, Bài trước / Bài sau, leaving #/music) stops
it; Bài trước / Bài sau start the next track.

**Motion (GSAP, reduced motion → none / short fade)**
- List → track: the disc flies from its shelf slot to the big disc (Flip, 0.55 s expo-out); text arrives (`useReveal`).
- Track → list: back to the same scroll position, the disc flies home to its slot.
- Group change / search result: sections arrive (`useReveal`); the ink stretches (`useSlider`).

**Rulings**
- The plan's `Listen` block (native `<audio controls>`) is replaced by own controls over the same single
  `<audio preload="none">`, as the picked direction requires; its error state and "leaving stops the music" stay.
- Usage line stays 13 px (DESIGN.md "notes 13 px"; the detector's ramp warning is advisory); phone track title 26 px.

**Entry (owner 2026-11-08: "đặt trong mục thông tin")**: no rail link; a Thông tin tile (`#/info`) with five jukebox
discs, between Banner and Vũ Khí. On `#/music` the rail lights Thông tin.

Classes: `music-*` prefix (`music-page`, `music-tools`, `music-sec`, `music-shelf`, `music-cd`, `music-row`,
`music-track`, `music-big`, `music-ctl`, `music-uses`, `music-nb`).
