# WHMX Admin — Critique of the current UI + shared spec for 3 redesign directions

Date: 2026-09-23. Plan: `docs/plans/WHMX_ADMIN_PLAN_2026-09-23.md` (Part B).
Measured on the live app (`vercel dev`, real owner login, 1600×900, dark theme) after the
`@layer legacy-reset` spacing fix — i.e. this is the *best* the current design looks, not a
broken render.

---

## Part 1 — Đánh giá nhanh giao diện hiện tại (senior UI/UX critique)

**Điểm tổng (thang huashu): 3.5/10 — concept 2/10, nên tổng bị chặn trần.**

Concept là tiêu chí đầu tiên và là điểm tệ nhất: nếu đổi chữ "WHMX" thành tên sản phẩm
khác, giao diện vẫn dùng được y nguyên. Nó là một admin template chung chung, không có gì
lấy từ nội dung thật. Trong khi đó, nội dung thật lại rất có chất: đây là **sổ đăng ký hiện
vật của một bảo tàng**. Các trường dữ liệu dùng đúng thuật ngữ bảo tàng: `provenance`
(xuất xứ), lifecycle `unverified → unreleased → released → retired` (giám định → lưu kho →
trưng bày → rút khỏi trưng bày), `claimed raw ID`, và bằng chứng giám định. Giao diện hiện
tại bỏ phí hoàn toàn chất liệu đó.

Các lỗi cụ thể, xếp theo mức độ nghiêm trọng (tất cả đều đo được, không cảm tính):

1. ⚠️ **Tương phản nút chính khoảng 2:1.** Mọi nút primary ("Cấp tài khoản", "Tạo bản
   nháp…", "Đăng xuất") là chữ trắng `#FFFFFF` trên nền vàng `#D4B763`, tương phản chỉ
   khoảng 1.96:1. WCAG AA yêu cầu ≥4.5:1. Chữ tối `#111315` trên cùng nền vàng đạt khoảng
   9.5:1.
2. ⚠️ **Sai trọng tâm hành động.** Control nổi bật nhất trang là nút **Đăng xuất** (nút
   vàng đặc ở góc trên phải). Đây là hành động ít dùng nhất lại được trình bày như CTA chính.
3. ⚠️ **Không có kiến trúc thông tin (IA).** Hai công việc khác hẳn nhau, cấp tài khoản
   (làm vài lần mỗi năm) và biên tập Preview (làm hằng ngày), bị xếp chồng dọc trong một
   trang duy nhất. Việc hiếm gặp lại đứng trên cùng. Khi mở chi tiết một Preview, danh sách
   biến mất và chi tiết hiện ngay dưới form "Tạo", còn nút "← Danh sách" bị chôn giữa trang.
4. ⚡ **Phân cấp chữ bị đảo và quá dẹt.** Tiêu đề ứng dụng "Quản trị" chỉ 20px, nhỏ hơn
   tiêu đề section 24px. Tỷ lệ heading/body là 24/14 ≈ 1.7×, trong khi huashu yêu cầu tối
   thiểu 2.5×. Ba cấp "eyebrow" (WHMX ADMIN, PREVIEW CHARACTERS, mô tả) cùng 12px, chỉ
   khác nhau ở màu.
5. ⚡ **Vàng bị lạm dụng đến mất nghĩa.** Có khoảng 7 loại phần tử dùng accent vàng: 3 nút
   đặc, tab đang chọn, eyebrow, pill role, pill trạng thái, và summary "+ Tạo Preview".
   Khi mọi thứ đều vàng thì vàng không còn báo hiệu gì nữa.
6. ⚡ **Hai route là hai sản phẩm khác nhau.** Character CMS (Vue) dùng tiêu đề serif
   "Characters", nhãn monospace và bố cục biên tập kiểu tạp chí. Preview/Users (React) dùng
   Inter đậm kiểu template SaaS. Font serif của thương hiệu (`--font-serif`) có sẵn nhưng
   shell React không hề dùng.
7. ⚡ **Không có lưới khoảng cách.** Nút "Cấp tài khoản" bị lệch sang dưới cột Email (cách
   367px so với form), không thẳng hàng với cột nào có nghĩa. Bảng Users dùng độ rộng tự
   động nên cột Email chiếm khoảng 60% chiều ngang. Khoảng cách giữa các section
   (32/40/48px) không theo quy luật nào.
8. 💡 **Lẫn lộn ngôn ngữ.** "Manual preview workspace", "Refresh", "All lifecycle",
   "Search name / claimed ID" (tiếng Anh) nằm cạnh "Tài khoản", "Cấp tài khoản" (tiếng Việt).
9. 💡 **Control mặc định của trình duyệt.** Filter và lifecycle/visibility dùng `<select>`
   native. Hàng bảng không có hover hay hành động. Trạng thái loading, rỗng và lỗi chỉ là
   một dòng chữ trơn.
10. 💡 **Header hai tầng tốn khoảng 95px** chiều cao (thanh tiêu đề + thanh tab) chỉ để hiển
    thị 2 tab và 1 nút.

**Giữ lại (Keep):** token màu dark-charcoal/antique-gold bản thân nó đẹp. Bố cục biên tập
của Character CMS (serif, nhãn mono, cột "Source evidence") là phần có gu nhất hiện có.
Thanh nav rail 60px bên trái.

**Quick wins nếu chỉ có 5 phút** (không thay được redesign, chỉ để tham khảo): chữ tối trên
nút vàng; hạ "Đăng xuất" thành nút ghost; tách Users khỏi trang Preview.

---

## Part 2 — Shared design spec (input for all 3 direction subagents)

### Product and users
WHMX (Vật Hoa Di Tân / 物华弥新) is a fan database for a game whose characters are
anthropomorphised Chinese cultural relics. The Admin is its back office. Users: the owner
(Siro) plus a handful of editors, on desktop (1440–1920 px wide; must still work at 1280 and
degrade sanely on mobile). Session length: long editing sessions, not glance-and-go.

### Jobs, by frequency (this must drive IA)
1. **Daily — Character/Skin CMS** (`#/admin/characters`): browse 133 characters, open one,
   edit Vietnamese overrides. Rendered by an existing Vue island you must NOT rewrite; you only
   design the frame around it.
2. **Frequent — Preview Characters** (`#/admin`, today's "Preview / Users" tab): unreleased
   characters. List with search + lifecycle + visibility filters → detail with: identity
   header (name, publicKey, UUID, revision, created/updated at/by, lifecycle/visibility/origin
   state), metadata form (nameVi, nameCn, fullnameVi, fullnameCn, nicknameVi, tagsVi,
   claimedRawId, claimedRawIdEvidence JSON, manualMetadata JSON, provenanceNotes), owner-only
   lifecycle/visibility control, 3 asset slots (avatar/card/drawing: thumbnail, provenance +
   verification labels, placeholder warning, file upload, provenance select, "finalize
   pending" buttons, status line), history list, reconciliation cards. Plus "create preview".
3. **Rare — Accounts** (owner only): list users (name, email, role, status) and provision one
   (name, email, temp password ≥12 chars, role editor/owner).
4. **Login** screen for unauthenticated visitors.

### Concept seed (content-derived, not mandatory but must be answered)
The content is a **museum accession register**: provenance, verification state, lifecycle
from unverified to retired, claimed IDs with evidence. Each direction must state in one line
"what idea the form grows from" (huashu rule). A direction that ignores this seed must
explain what it uses instead.

### Locked constraints (all directions)
- **Colour:** only `src/styles/tokens.css` custom properties (`--bg-main/-surface/
  -surface-hover/-elevated`, `--border-color/-strong/-gold-subtle/-gold-divider`,
  `--text-main/-muted/-subtle`, `--accent/-accent-light`, `--rarity-*`, `--input-*`,
  `--shadow-pop`). Deriving tints is allowed and encouraged:
  `color-mix(in oklch, var(--accent) 12%, var(--bg-surface))`. No new literal hex anywhere
  except where a component prop literally cannot take `var()` (document it inline). Must
  render correctly in **both** `[data-theme="dark"]` (default) and light theme — tokens
  already flip; don't hard-code dark assumptions.
- **Contrast:** body text ≥4.5:1, gold fills carry dark text (`var(--bg-main)`), never white.
- **Type:** only already-loaded families — Inter (400–700), Noto Serif (500/600/700, italic
  500), Noto Serif SC (500/700) via `var(--font-sans)` / `var(--font-serif)` or
  `'Noto Serif'`. Heading/body ratio ≥2.5× somewhere meaningful. Body ≥14 px, labels ≥12 px.
- **Language:** all UI chrome in Vietnamese (keep raw enum values like `unverified` visible
  where they are data, but label them in Vietnamese).
- **Global nav rail:** a fixed 60 px rail sits on the left at ≥769 px (`.app-nav`, z-index
  1000). Your root must offset by it: `md:ml-[60px] md:w-[calc(100%-60px)]` (Tailwind
  utilities now work — see `@layer legacy-reset` in `src/styles/global.css`).
- **Never use the bare `hidden` class.** Legacy `src/style.css:737` defines
  `.hidden { display: none !important }` (the public site's JS toggles it), which beats
  `md:block`/`lg:flex` etc. Write `max-md:hidden` instead of `hidden md:block`. Tailwind
  preflight is not loaded; `globals.css` adds a scoped list-style/font reset in
  `@layer legacy-reset`.
- **Root class:** keep `admin-react-root` on your root element — it scopes the shadcn
  variables in `src/admin/layout/styles/globals.css` (`bg-background`, `text-primary`, ...).
- **Logic you copy verbatim from `src/admin/layout/AdminApp.tsx`:** the session state,
  `isAdminRoute`/`isCharactersRoute`, the `admin-route-active` body-class effect, the
  hashchange effect, `getSession`, `handleLogin`, `handleLogout`, and the Vue island mount /
  unmount effect (`import('../character-skin/characterSkinAdminWorkspace.js')` →
  `mountCharacterSkinAdmin(el, session)` → `.unmount()`). Change only markup around them.
- **Data layer (reuse, don't re-fetch by hand):** `src/admin/preview/previewApi.js` exports
  `LIFECYCLES, VISIBILITIES, ASSET_ROLES, PROVENANCES, listPreviews({q,lifecycle,visibility}),
  getPreview(id), createPreview(values), savePreviewMetadata(preview, patch),
  savePreviewState(preview, lifecycle, visibility), finalizeUpload(intentId),
  uploadAsset(preview, role, file, provenance, isOwner, onStatus) → {finalized}`. Errors are
  `Error(code)` with `.status`; **409 = VERSION_CONFLICT → keep the user's draft in the form
  and tell them to reload/copy** (never silently overwrite, never lose the draft).
  `src/admin/users/usersApi.js` exports `ROLES, listUsers() → users|null,
  provisionUser(values) → null|errorCode`. JSON fields must be validated client-side before
  save (same message as today: evidence/metadata must be valid JSON).
- **Role rules:** non-owner: lifecycle/visibility/provenance/finalize controls disabled with a
  visible reason; Accounts area replaced by "chỉ dành cho owner". Server still enforces all.
- **Full functional parity** with today's Preview/Users + login. Any direction must be
  promotable to production as-is. Required states: loading, empty, error, 409, disabled.
- **Out of scope / do not touch:** `src/admin/character-skin/**` (Vue island), anything under
  `server/`, `api/`, `db/`, `src/app/**`, `src/styles/**`, `mount.tsx`, `AdminApp.tsx`,
  `previewApi.js`, `usersApi.js`, `package.json`. You own **only** your directory.

### reactbits.dev
Allowed where a component earns its place (button/border treatment, list reveal, login
background). Fetch source from `https://reactbits.dev/r/<Name>-TS-TW.json` and write it into
your own directory; only components whose npm deps are already in `package.json` (react,
ogl, clsx, tailwind-merge, lucide-react, class-variance-authority, tw-animate-css). Need
another dep → don't use it, list it in your report. Feed WHMX tokens as props. No decorative
motion on dense data screens. The existing login `MoltenMetal` / `StarBorder`
(`src/admin/layout/components/`) are optional — keep, replace or drop.

### Output
- Directory: `src/admin/layout/_design-exploration/<letter>-<slug>/` (letter = your
  assigned `a`/`b`/`c`), entry `App.tsx` with `export default function App()` (no props,
  owns its own state like `AdminApp`). It is mounted in dev at
  `http://localhost:3000/?direction=<letter>#/admin` by `mount.tsx` (already wired).
- Any sub-components / CSS inside that directory. Tailwind utilities preferred; a local
  `.css` imported from `App.tsx` is fine for things Tailwind can't express.
- Must pass `npx tsc --noEmit -p tsconfig.json` (baseline is clean; `allowJs` is on, so
  imports from the `.js` modules above are typed by inference — no `@ts-expect-error`).
- Report back: slug, which logic you followed, the one-line concept, reactbits components
  used, anything you couldn't do.

### Anti-slop checklist (huashu)
No gradient-on-everything, no emoji icons, no generic rounded-card-with-left-accent-border,
no decorative icon per heading, no invented stats, no Lorem ipsum. Whitespace must be
composition (a clear visual anchor per screen), not absence of content.
