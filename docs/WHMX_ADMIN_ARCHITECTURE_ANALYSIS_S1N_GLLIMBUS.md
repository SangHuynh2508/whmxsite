# Phân tích cấu trúc Admin của S1N.gg và GLLimbus

## Mục đích

Tài liệu này tách riêng cách hai dự án tham khảo tổ chức Admin/CMS, tập
trung vào kiến trúc dữ liệu, boundary giữa public và admin, cách chỉnh
sửa nội dung, preview, authorization và cách Admin gắn vào application.

Mục tiêu không phải sao chép stack của họ, mà rút ra những nguyên tắc có
thể áp dụng cho WHMX.

> Phạm vi: tài liệu tổng hợp từ các ghi chú nghiên cứu S1N/GLLimbus đã
> có trong bộ context WHMX. Những điểm không có bằng chứng cụ thể trong
> nguồn được coi là chưa xác minh, không tự suy diễn thành fact.

------------------------------------------------------------------------

# 1. Kết luận ngắn

Hai dự án có một điểm chung quan trọng:

**Admin không được thiết kế như một website thứ hai tách biệt hoàn toàn
khỏi public app.**

Mô hình tổng quát:

``` text
Public renderer
      ↑
      │ reuse
      │
Contextual editor ───── Full Admin/CMS
      │                      │
      └──────────┬───────────┘
                 ↓
        Shared domain/data layer
                 ↓
          DB + authorization
```

-   **S1N** thiên về CMS/admin có CRUD trực tiếp, kết hợp contextual
    inline editing với khu vực quản trị đầy đủ.
-   **GLLimbus** cũng dùng contextual inline editing + full CMS + live
    preview; frontend được tổ chức theo domain/game rõ hơn.
-   GLL có `AdminEditor.tsx` rất lớn/god-component; đây là điểm cần học
    để **tránh**, không phải thứ nên sao chép.

Điểm đáng lấy cho WHMX là **mô hình**, không phải framework.

------------------------------------------------------------------------

# 2. S1N --- cấu trúc Admin

## 2.1. Hai lớp thao tác

S1N không chỉ là:

``` text
/admin
  ├── table
  ├── edit form
  └── save button
```

Mà có hai lớp:

``` text
Contextual editing
       +
Full Admin / Admin Terminal
```

### Contextual editing

Editor xuất hiện ngay trong ngữ cảnh dữ liệu đang được hiển thị:

``` text
Public Character / Guide view
        │
        ├── field đang hiển thị
        │
        └── editor tương ứng
                 │
                 └── update DB
```

### Full Admin / Terminal

Dùng cho:

-   CRUD nhiều record
-   lọc/tìm kiếm
-   quản lý quan hệ
-   nhiều field
-   thao tác vận hành/admin
-   các chức năng không phù hợp với inline editor

Do đó:

``` text
1 record / 1 field / đang xem
        → contextual editor

nhiều record / nhiều field / quản trị hệ thống
        → full Admin
```

Hai lớp không cạnh tranh nhau.

------------------------------------------------------------------------

# 3. S1N --- data/backend boundary

Stack được ghi nhận của S1N gồm:

-   React/Vite
-   TanStack Query
-   Jotai
-   Supabase PostgreSQL
-   Supabase Auth
-   Supabase browser client
-   JWT/RLS
-   UploadThing
-   một số dữ liệu guide/tier được compile/hardcode

Điểm kiến trúc đáng học hơn stack:

``` text
Frontend
   │
   ├── query/cache
   │
   └── Supabase client
          │
          ▼
   PostgreSQL + RLS
```

Authorization không chỉ dựa vào việc frontend có/không có nút Admin.

Với WHMX, bài học là:

> Ẩn nút Edit không phải security boundary. Boundary phải nằm ở
> server/database authorization.

------------------------------------------------------------------------

# 4. S1N --- query/cache và editing

TanStack Query đóng vai trò data-fetch/cache layer.

Tư duy kiến trúc:

``` text
DB
 ↓
query
 ↓
cache
 ↓
public/admin components
```

Khi edit:

``` text
User edit
   ↓
mutation
   ↓
DB
   ↓
invalidate/update cache
   ↓
UI reflects new data
```

Điểm đáng học không phải nhất thiết dùng TanStack Query trong WHMX, mà
là:

**Admin và public nên dùng cùng data model và có chiến lược cache rõ
ràng.**

Không nên tạo hai bộ model cho cùng một entity nếu không cần thiết.

------------------------------------------------------------------------

# 5. GLLimbus --- cấu trúc Admin

GLLimbus có cùng tư tưởng lớn:

``` text
Public UI
   │
   ├── contextual inline editing
   │
   └── live preview
          │
          ▼
      Admin/CMS
```

Frontend được tổ chức theo domain/game:

``` text
core/
games/
  limbus/
```

Component dùng chung nằm ở global/core; logic đặc thù Limbus nằm trong
domain/game.

Điều này cho phép Admin/editor biết nó đang chỉnh domain nào thay vì
biến toàn bộ Admin thành một abstraction chung khổng lồ.

------------------------------------------------------------------------

# 6. GLLimbus --- contextual editing

Mô hình:

``` text
Public renderer
      │
      └── contextual editor
```

Ví dụ về mặt ý tưởng:

``` text
Character page

Tên nhân vật
[ Sửa ]

Mô tả
[ Sửa ]

Skill
[ Sửa ]

Guide
[ Sửa ]
```

Không cần rời public context cho mọi thay đổi nhỏ.

Nhưng GLL vẫn có full CMS cho thao tác lớn:

``` text
             ┌── contextual edit
Public view ─┤
             └── open full CMS

Full CMS ──── bulk / complex operations
```

------------------------------------------------------------------------

# 7. GLLimbus --- Live Preview

Điểm quan trọng là **live preview dùng lại public renderer**.

Ý tưởng:

``` text
Admin editor
     │
     │ edit draft
     ▼
domain data
     │
     ▼
same public renderer
     │
     ▼
preview
```

Mục tiêu là tránh:

``` text
Public rendering logic
        ≠
Admin preview rendering logic
```

Đây là nguyên tắc rất phù hợp với WHMX.

------------------------------------------------------------------------

# 8. Điểm GLL không nên copy: AdminEditor.tsx

GLL có `AdminEditor.tsx` được ghi nhận là một giant/god component.

Không nên biến Admin WHMX thành:

``` text
AdminEditor
   ├── character
   ├── skill
   ├── guide
   ├── settings
   ├── upload
   ├── preview
   ├── permissions
   └── save logic
```

Vấn đề:

-   domain boundary bị xóa
-   khó test
-   sửa một entity dễ ảnh hưởng entity khác
-   component phình lớn
-   agent mới khó biết code nào thuộc responsibility nào

WHMX không nên biến `characterSkinAdminWorkspace.js` thành phiên bản mới
của một AdminEditor khổng lồ.

Thay vào đó:

``` text
src/admin/
  shell/
  character-skin/
  ...
```

và bên trong tiếp tục chia theo responsibility.

------------------------------------------------------------------------

# 9. So sánh

  -----------------------------------------------------------------------
  Khía cạnh               S1N                     GLLimbus
  ----------------------- ----------------------- -----------------------
  Contextual editing      Có                      Có

  Full CMS/Admin          Có                      Có

  Public/Admin là hai app Không phải mô hình      Không phải mô hình
  độc lập                 chính                   chính

  CRUD backend            Supabase/Postgres       Supabase/Postgres

  Authorization           JWT/RLS                 RLS/Supabase-oriented

  Preview                 Gắn với public/domain   Nhấn mạnh live preview
                          UI                      dùng public renderer

  Data fetching           TanStack Query          React/domain data
                                                  architecture

  Domain organization     Nhiều domain entity     Rõ core/game boundary

  Admin giant component   Không phải pattern nên  Có `AdminEditor.tsx`,
                          học                     cần tránh

  Bài học chính           Contextual edit + full  Reuse renderer + domain
                          CMS                     boundary
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 10. Mô hình chung rút ra

Nếu bỏ framework và tên sản phẩm:

``` text
                    ┌─────────────────────┐
                    │     PUBLIC APP      │
                    │                     │
                    │ domain renderer     │
                    │ contextual editing  │
                    └──────────┬──────────┘
                               │
                         shared model
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
             ▼                                   ▼
     ┌───────────────┐                   ┌───────────────┐
     │  FULL ADMIN   │                   │ LIVE PREVIEW  │
     │               │                   │               │
     │ CRUD          │                   │ same renderer │
     │ bulk edit     │                   │ draft data    │
     │ filters       │                   │               │
     │ relationships │                   │               │
     └───────┬───────┘                   └───────┬───────┘
             │                                   │
             └─────────────────┬─────────────────┘
                               ▼
                     ┌───────────────────┐
                     │ DOMAIN / API      │
                     │ validation        │
                     │ authorization     │
                     │ optimistic lock   │
                     └─────────┬─────────┘
                               ▼
                     ┌───────────────────┐
                     │ PostgreSQL / R2   │
                     └───────────────────┘
```

Đây là phần WHMX nên học.

------------------------------------------------------------------------

# 11. Áp vào WHMX

WHMX hiện đã đi theo hướng gần mô hình này:

``` text
src/
  app/
  features/
    characters/
    skins/
    assets/
  admin/
  shared/
  styles/
```

và backend:

``` text
server/
  admin/
  assets/
  preview-characters/
  ...
```

Đây là hướng đúng về boundary.

## Public

Public renderer chịu trách nhiệm cho các domain như Character, Skin,
Skill, Buff, Guide.

## Contextual Admin

Khi đang xem một entity trong Admin:

``` text
Character
 ├── name
 ├── profile
 ├── skills
 ├── skins
 └── assets
```

có thể chỉnh ngay tại context đó.

## Full Admin

Khi cần:

``` text
search 100+ characters
filter
bulk inspect
manage relationships
manage assets
review status
```

thì dùng workspace/CMS đầy đủ.

------------------------------------------------------------------------

# 12. WHMX không nên làm Admin theo kiểu này

Không nên:

``` text
src/admin/
  AdminPage.vue
  AdminEditor.vue
  AdminTable.vue
  AdminForm.vue
  AdminEverything.vue
```

rồi nhét toàn bộ domain vào đó.

Cũng không nên:

``` text
Public app
      │
      X
      │
Separate Admin app
      │
      └── duplicate renderer
```

vì sẽ tạo:

-   duplicate domain logic
-   duplicate preview
-   duplicate validation
-   UI drift
-   maintenance cost cao

------------------------------------------------------------------------

# 13. Cấu trúc WHMX nên hướng tới

Không cần copy nguyên cây của S1N/GLL. Nên giữ domain-first:

``` text
src/
├── app/
│   ├── router/
│   └── ...
│
├── features/
│   ├── characters/
│   │   ├── data/
│   │   ├── views/
│   │   ├── components/
│   │   └── styles/
│   │
│   ├── skins/
│   │   ├── data/
│   │   ├── views/
│   │   └── styles/
│   │
│   ├── calculator/
│   ├── weapons/
│   └── assets/
│
├── admin/
│   ├── shell/
│   ├── character-skin/
│   ├── assets/
│   └── styles/
│
├── shared/
│   ├── api/
│   ├── components/
│   └── ...
│
└── styles/
```

Điểm quan trọng:

**Admin là layer cross-cutting trên domain, không phải một domain mới
thay thế public app.**

------------------------------------------------------------------------

# 14. Hai cấp độ editing WHMX nên có

## Cấp 1 --- contextual editing

Dùng cho:

-   sửa tên
-   sửa localization
-   sửa description
-   chỉnh metadata nhỏ
-   chỉnh asset mapping
-   chỉnh field ngay tại context

Flow:

``` text
Open character
      ↓
Edit field
      ↓
validate
      ↓
save
      ↓
update DB/cache
      ↓
preview/public representation refresh
```

## Cấp 2 --- full workspace/CMS

Dùng cho:

-   character list
-   skin list
-   relationship
-   asset management
-   bulk review
-   filters
-   status
-   history
-   conflict handling
-   complex forms

Flow:

``` text
Admin workspace
      ↓
select entity
      ↓
edit
      ↓
validate
      ↓
optimistic-lock check
      ↓
DB transaction
      ↓
publication/outbox
      ↓
preview/public release
```

Hai cấp này bổ sung cho nhau.

------------------------------------------------------------------------

# 15. Preview của WHMX

Nên lấy bài học GLL:

**Preview không nên là một renderer khác.**

``` text
Admin draft
    ↓
same domain model
    ↓
same renderer
    ↓
preview
```

Ví dụ Character Admin:

``` text
PostgreSQL draft
       ↓
Character domain resolver
       ↓
Character public renderer
       ↓
Admin preview
```

Không nên tạo một phiên bản Character renderer riêng chỉ cho Admin.

------------------------------------------------------------------------

# 16. Authorization

Bài học từ mô hình S1N/Supabase:

Frontend permission chỉ là UX.

Security boundary phải nằm ở:

``` text
request
  ↓
authentication
  ↓
authorization
  ↓
validation
  ↓
transaction
  ↓
DB
```

WHMX hiện có:

``` text
Better Auth
   ↓
server/API authorization
   ↓
owner/editor role
   ↓
Drizzle/PostgreSQL
```

Cấu trúc này phù hợp với nguyên tắc cần giữ.

------------------------------------------------------------------------

# 17. Data authority --- WHMX khác S1N/GLL ở điểm quan trọng

Không được bê nguyên mô hình "DB là tất cả".

WHMX có:

``` text
NeoArtifacts
    ↓
raw game evidence
```

và:

``` text
PostgreSQL
    ↓
human-managed/editorial data
```

Vì vậy authority phải được phân lớp:

``` text
RAW GAME ID / CN / relationship
        │
        ▼
   NeoArtifacts
        │
        │ evidence/import
        ▼
 PostgreSQL editorial layer
        │
        ├── Vietnamese localization
        ├── editorial metadata
        ├── guide/profile
        └── admin state
        │
        ▼
 publication pipeline
        │
        ▼
       R2
        │
        ▼
   Public renderer
```

Đây là điểm WHMX **không nên copy nguyên** từ S1N/GLL.

------------------------------------------------------------------------

# 18. Bài học kiến trúc quan trọng nhất

## Nên học từ S1N

1.  Contextual editing + full CMS có thể cùng tồn tại.
2.  Admin không chỉ là một form CRUD.
3.  Data/cache layer phải có cấu trúc rõ.
4.  Authorization phải nằm ngoài UI.

## Nên học từ GLLimbus

1.  Admin có thể dùng lại public renderer.
2.  Live preview nên phản ánh chính xác public rendering.
3.  Domain/game boundary quan trọng hơn việc gom tất cả vào một Admin
    folder.
4.  Không nên để một `AdminEditor` thành god component.

## Không nên copy

``` text
React
TanStack Query
Jotai
Supabase
UploadThing
```

chỉ vì họ dùng chúng.

Stack là implementation detail. Architecture principle mới là thứ đáng
lấy.

------------------------------------------------------------------------

# 19. Kết luận cho WHMX

Mô hình mục tiêu:

``` text
                  WHMX PUBLIC
                      │
          ┌───────────┴───────────┐
          │                       │
     Public renderer        Contextual edit
          │                       │
          └───────────┬───────────┘
                      │
                shared domain
                      │
              ┌───────┴────────┐
              │                │
         Admin CMS         Live Preview
              │                │
              └───────┬────────┘
                      │
                Server/API
                      │
              Auth + Validation
                      │
                 PostgreSQL
                      │
              publication/outbox
                      │
                     R2
```

**WHMX nên có một hệ thống Admin tích hợp với public application, chứ
không xây một "Admin website" độc lập.**

Contextual editing giải quyết thao tác nhanh.

Full CMS/workspace giải quyết thao tác phức tạp.

Shared renderer giải quyết preview.

Server/database authorization giải quyết security.

Domain-first structure giải quyết maintainability.

Đây là phần kiến trúc đáng mang sang WHMX từ hai dự án tham khảo.
