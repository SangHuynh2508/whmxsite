# WHMX — Preview Character + Managed Asset Architecture Proposal

**Status:** Milestone C.5 / D0 design proposal only. No schema, migration, API, UI, R2, database, workbook, or public-data change is authorized by this document.  
**Date:** 2026-09-19  
**Depends on:** accepted Milestone B/C foundation, including `managed_entities`, numeric revisions, `edit_history`, Better Auth `owner`/`editor`, deterministic Character/Skin import, and the workbook reconciliation gate.

## 1. Purpose and non-negotiable boundaries

This design adds a first-class future path for manually curated leaked/pre-release Characters and temporary/manual images without presenting them as raw MasterData evidence.

It preserves these authority boundaries:

```text
Raw MasterData                 authoritative raw identity, relations, and extracted assets
localization_master.xlsx       persistent Vietnamese localization authority
PostgreSQL                     controlled working layer, provenance, review, audit, and export input
public/data.json               reviewed static public-read artifact
R2/local public storage        image bytes; PostgreSQL stores metadata and bindings only
```

Consequences:

- A manual/leaked Character is never inserted into `characters` until authoritative raw evidence exists and an owner explicitly reconciles it.
- A claimed raw ID is a claim/evidence aid, never a source key or proof of identity.
- A preview lifecycle does not imply public visibility. Visibility is explicit.
- A manual asset never overwrites source evidence or an active mapping silently.
- Existing migrations `0000_lowly_spacker_dave.sql`, `0001_sour_rockslide.sql`, and `0002_remove_unresolved_acquisition_category.sql` remain immutable. Any implementation uses additive migrations.
- The existing Character/Skin importer, workbook authority, current R2/public asset arrangement, and static `public/data.json` pipeline continue unchanged until a separately approved implementation milestone proves parity.

## 2. Recommended model

### Decision summary

| Concern | Recommendation |
| --- | --- |
| Manual leaked entity | Separate `preview_characters` table backed by a `managed_entities` row of type `preview_character`. |
| Internal identity | `preview_characters.entity_id` is a UUID and is the preview identity. Its registry key is an internal `preview:<UUID>` value, never a fabricated raw Character ID. |
| Lifecycle and visibility | A constrained shared `character_publication_states` extension for `characters` and `preview_characters`; origin, lifecycle, and visibility remain distinct. |
| Assets | New generic `entity_asset_mappings` table with composite FK to `managed_entities`, role-rule FK, and concrete FK to `asset_objects`. |
| Existing Skin mapping | Keep `skin_asset_mappings` canonical until a future dual-write/backfill/parity migration is accepted. Do not create two competing live authorities. |
| Upload transport | Browser-to-R2, short-lived presigned upload to a quarantine key; authenticated server finalization verifies/processes content and commits the DB mapping transaction. |
| Asset URL/cache | Immutable, content-versioned delivery objects. A replacement creates a new object and mapping revision; it never overwrites an existing object key. |
| Reconciliation | Owner-confirmed, transactional, auditable preview-to-official linkage. No automatic merge from a claimed ID or ID shape. |

### Why this asset-mapping choice

Three designs were considered:

| Design | Strength | Problem |
| --- | --- | --- |
| One polymorphic table with `entity_type` + arbitrary `entity_id` | Compact and easy to extend | A plain pair cannot have a real FK to several domain tables, so orphan/mistyped mappings are too easy. |
| Separate mapping table per domain | Strongest per-domain FKs | Repeats asset provenance/replacement behavior for Character, preview Character, Skin, Weapon, Skill icon, and Hoán Chương. Future domains would drift. |
| Shared managed-entity mapping — **recommended** | One mapping/audit/replace behavior, while retaining an FK to a single entity registry | Requires a small composite-FK and role-rule design rather than an unbounded generic table. |

The existing `managed_entities` registry is explicitly the stable cross-domain FK anchor for audit and overrides. It is therefore the appropriate asset subject too. The recommended mapping stores both `entity_id` and `entity_type` and has a composite FK to `managed_entities(id, entity_type)`. A second FK to an allowlisted role-rule table prevents, for example, a Skill icon from being assigned the Character-only `drawing` role.

This is constrained shared mapping, not unconstrained polymorphism.

## 3. Lifecycle, origin, and visibility

### Enumerations

```text
character_origin
  manual_preview
  source_backed

character_lifecycle
  unverified    # manual/leaked information has no authoritative MasterData confirmation
  unreleased    # entity is confirmed but not publicly released in-game
  released      # entity is released/official
  retired       # record is no longer active, normally after reconciliation or a rejected identity

character_visibility
  hidden        # excluded from public export
  preview       # available only in the intended authenticated/internal preview surface
  public        # eligible for public export, subject to export validation
```

`origin` answers *where this representation came from*. `lifecycle` answers *the entity's evidence/release status*. `visibility` answers *where it may be shown*. None is derived automatically from another.

Examples:

```text
preview Character: origin=manual_preview, lifecycle=unverified, visibility=public
raw-backed preload: origin=source_backed, lifecycle=unreleased, visibility=preview
retired wrong leak: origin=manual_preview, lifecycle=retired, visibility=hidden
```

### Publication-state extension

Use one constrained extension because both normal Characters and preview Characters can be exported, but keep their primary domain tables separate.

```sql
character_publication_states (
  entity_id uuid primary key,
  entity_type managed_entity_type not null,
  origin character_origin not null,
  lifecycle character_lifecycle not null,
  visibility character_visibility not null,
  public_key text unique not null,
  published_at timestamptz null,
  published_by_user_id uuid null references users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid null references users(id) on delete restrict,

  foreign key (entity_id, entity_type)
    references managed_entities(id, entity_type) on delete restrict,

  check (
    (entity_type = 'preview_character' and origin = 'manual_preview')
    or
    (entity_type = 'character' and origin = 'source_backed')
  ),
  check (entity_type in ('preview_character', 'character'))
)
```

Implementation adds `UNIQUE (id, entity_type)` to `managed_entities` to support the composite FK. It adds only `preview_character` to the existing `managed_entity_type` enum; Weapon, Skill, and Hoán Chương values are deferred until those source domains exist.

`public_key` is never a raw Character ID for a preview. Recommended format:

```text
preview_<preview-entity-uuid>
```

It is stable, routable, clearly non-authoritative, and cannot collide with raw IDs. Source-backed Character rows retain their true raw `character_id` as their public key.

## 4. Preview Character schema

### `preview_characters`

```sql
preview_characters (
  entity_id uuid primary key references managed_entities(id) on delete restrict,

  -- A claim only. It is not unique against characters, not used as an importer key,
  -- and not copied into characters without confirmed reconciliation.
  claimed_raw_id text null,
  claimed_raw_id_evidence jsonb not null default '{}'::jsonb,

  name_cn text null,
  fullname_cn text null,
  name_vi text null,
  fullname_vi text null,
  nickname_vi text null,
  tags_vi text null,
  manual_metadata jsonb not null default '{}'::jsonb,
  provenance_notes text null,

  retired_reason preview_retired_reason null,
  reconciled_to_character_entity_id uuid null references characters(entity_id) on delete restrict,
  reconciled_at timestamptz null,
  reconciled_by_user_id uuid null references users(id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid not null references users(id) on delete restrict,
  updated_by_user_id uuid not null references users(id) on delete restrict,

  check (
    (reconciled_to_character_entity_id is null and reconciled_at is null and reconciled_by_user_id is null)
    or
    (reconciled_to_character_entity_id is not null and reconciled_at is not null and reconciled_by_user_id is not null)
  )
)
```

Recommended `preview_retired_reason` values:

```text
reconciled
identity_incorrect
duplicate_preview
withdrawn
other
```

Indexes:

```text
INDEX preview_characters(claimed_raw_id) WHERE claimed_raw_id IS NOT NULL
INDEX preview_characters(reconciled_to_character_entity_id) WHERE reconciled_to_character_entity_id IS NOT NULL
INDEX preview_characters(updated_at DESC)
```

The registry row is created in the same transaction as the preview row:

```text
managed_entities.entity_type = preview_character
managed_entities.source_key = preview:<entity UUID>
```

This `source_key` is an immutable registry namespace, not source evidence and not a claimed raw ID. The claimed ID remains exclusively in `preview_characters.claimed_raw_id` with its evidence/provenance notes.

### `preview_character_reconciliations`

Reconciliation needs a durable decision record rather than a single mutable link.

```sql
preview_character_reconciliations (
  id uuid primary key,
  preview_entity_id uuid not null references preview_characters(entity_id) on delete restrict,
  official_character_entity_id uuid not null references characters(entity_id) on delete restrict,
  evaluated_source_snapshot_id uuid not null references source_snapshots(id) on delete restrict,
  status preview_reconciliation_status not null,
  candidate_evidence jsonb not null default '{}'::jsonb,
  decision_notes text null,
  proposed_by_user_id uuid null references users(id) on delete restrict,
  proposed_at timestamptz not null default now(),
  reviewed_by_user_id uuid null references users(id) on delete restrict,
  reviewed_at timestamptz null,
  change_group_id uuid not null,
  request_id uuid not null
)
```

```text
preview_reconciliation_status
  proposed
  confirmed
  rejected
  cancelled
```

Required indexes/constraints:

```text
INDEX preview_character_reconciliations(preview_entity_id, proposed_at DESC)
INDEX preview_character_reconciliations(official_character_entity_id, proposed_at DESC)
UNIQUE (preview_entity_id) WHERE status = 'confirmed'
UNIQUE (official_character_entity_id) WHERE status = 'confirmed'
```

The partial unique indexes prevent a completed preview from linking to two official Characters and prevent two retired previews from silently representing the same official public Character. A rejected proposal never changes either domain record.

## 5. Preview → official reconciliation

### Candidate discovery is not reconciliation

A candidate may be proposed when newly imported authoritative MasterData has a Character that is plausibly the same entity. Discovery may use:

1. Exact equality of a preview's optional `claimed_raw_id` with an actual `characters.character_id`.
2. Owner-provided evidence such as exact name, official artwork/voice relationship, or release material.
3. The source snapshot, raw identity fields, and workbook fields currently attached to the official Character.

Candidate discovery must never:

- infer a match from raw-ID prefix/suffix/shape;
- infer ownership or gameplay meaning from ID shape;
- rewrite a preview, official Character, asset mapping, or public export automatically;
- treat a claimed ID as exact raw evidence merely because it resembles an ID.

An exact claimed-ID match is a high-quality *candidate lookup*, not confirmation. The owner reviews the raw record and the documented evidence.

### State machine

```text
active preview
  │
  ├─ raw importer finds possible official Character ──> proposed reconciliation
  │                                                    │
  │                         owner rejects/defer ───────┤──> preview remains active
  │                                                    │
  └──────────────────── owner confirms ───────────────┘
                                                       │
                         one transaction               ▼
                 preview.lifecycle = retired; visibility = hidden
                 preview.reconciled_to_character_entity_id = official Character
                 reconciliation.status = confirmed
                 selected manual metadata/assets transferred as explicit reviewed state
                 audit + revisions written for both entities
                                                       │
                                                       ▼
                         exporter emits only official Character
```

If the leak was wrong, an owner rejects the candidate and either corrects the preview's manual metadata/claim or sets the preview to `retired` + `hidden` with `retired_reason = identity_incorrect`. The official Character is unchanged.

### Owner-confirmed transaction

The reconciliation endpoint will require an owner, valid Origin/session checks, and expected revisions for both preview and official Character. In one transaction it:

1. Reloads the official Character and the exact raw/workbook source snapshots.
2. Validates the candidate evidence and current revisions.
3. Inserts or updates the reconciliation decision to `confirmed`.
4. Retires and hides the preview and records the official link.
5. Applies only owner-selected manual metadata to the official Character as explicit field overrides, preserving the official workbook baseline hash/snapshot.
6. Transfers only owner-selected manual assets into an explicit official-Character mapping choice; it never alters raw asset evidence.
7. Increments `managed_entities.revision` for every changed subject and writes field-level `edit_history` rows with one `change_group_id`.

Vietnamese text is not copied into a source baseline. It becomes a normal working override on the official Character, linked to the preview/reconciliation in audit metadata. The existing workbook gate still applies: production export uses it only after workbook reconciliation or the owner marks it `PUBLISH_APPROVED`; this does not transfer localization authority to PostgreSQL.

Manual assets remain on the retired preview for history. `manual_official` and `manual_preview` assets may be selected for an official mapping by owner decision; `manual_placeholder` assets do not transfer by default.

When the official importer later discovers an extracted asset, it records the latest `source_asset_id`. If a manual mapping is active, it sets a replacement-review state and audit event instead of changing the active object. The owner chooses keep manual, adopt source, or replace with another reviewed asset.

### Duplicate-public-entry prevention

The future exporter must enforce all of these predicates before output:

```text
preview row: publication visibility = public
             AND lifecycle != retired
             AND no confirmed reconciliation exists

source-backed row: publication visibility = public
```

It additionally checks public-key uniqueness and fails the export if a confirmed reconciliation could yield both a preview and its official Character. This is an exporter integrity failure, not a silent dedupe.

## 6. Managed asset model

### Asset provenance and object metadata

Keep image bytes outside PostgreSQL. Extend `asset_objects` in a future additive migration rather than replacing it.

```text
asset_provenance
  source_extracted
  manual_official
  manual_preview
  manual_placeholder

asset_storage_tier
  public_delivery
  private_original
  local_public

asset_verification_state
  pending
  verified
  quarantined
  retired
```

Recommended added `asset_objects` fields:

```sql
provenance asset_provenance not null
storage_tier asset_storage_tier not null
verification_state asset_verification_state not null
source_snapshot_id uuid null references source_snapshots(id) on delete restrict
created_by_user_id uuid null references users(id) on delete restrict
derived_from_asset_id uuid null references asset_objects(id) on delete restrict
byte_size bigint null
detected_mime_type text null
width integer null
height integer null
sha256 text not null
created_at timestamptz not null
verified_at timestamptz null
retired_at timestamptz null
metadata jsonb not null
```

Existing `content_hash` becomes the verified SHA-256 policy field; implementation should not introduce a second competing hash. The migration may rename only through a compatible add/backfill/contract sequence if a distinction is required.

Required integrity checks are implemented by database check where possible and service validation where a cross-row provenance lookup is required:

```text
source_extracted  -> source_snapshot_id required; created_by_user_id normally null
manual_*          -> created_by_user_id required; source_snapshot_id null
public_delivery   -> verification_state = verified before it can be mapped active
private_original  -> never exported as a public URL
```

Indexes:

```text
UNIQUE(storage_provider, object_key)                   -- existing invariant
INDEX(asset_objects(provenance, verification_state))
INDEX(asset_objects(content_hash)
INDEX(asset_objects(derived_from_asset_id)
```

### Role policy table

```sql
entity_asset_role_rules (
  entity_type managed_entity_type not null,
  asset_role text not null,
  allows_source boolean not null,
  allows_manual boolean not null,
  maximum_active_mappings smallint not null default 1,
  primary key (entity_type, asset_role)
)
```

Initial required roles are `avatar`, `card`, and `drawing`. Future rows can permit `skill_icon`, `weapon_card`, `huanzhang_icon`, or other roles only when their source models and UI are introduced. This avoids globally adding roles that no domain can safely consume.

### Generic mapping table

```sql
entity_asset_mappings (
  entity_id uuid not null,
  entity_type managed_entity_type not null,
  asset_role text not null,
  mapping_slot text not null default 'primary',

  -- The object the read/export path currently uses.
  active_asset_id uuid not null references asset_objects(id) on delete restrict,

  -- Latest source observation, if one exists. It is independent of manual selection.
  source_asset_id uuid null references asset_objects(id) on delete restrict,
  selection_mode asset_selection_mode not null,
  source_state asset_source_state not null,
  base_source_hash text null,
  base_source_snapshot_id uuid null references source_snapshots(id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid null references users(id) on delete restrict,

  primary key (entity_id, asset_role, mapping_slot),
  foreign key (entity_id, entity_type)
    references managed_entities(id, entity_type) on delete restrict,
  foreign key (entity_type, asset_role)
    references entity_asset_role_rules(entity_type, asset_role) on delete restrict,
  check (
    (selection_mode = 'source' and source_asset_id is not null and active_asset_id = source_asset_id)
    or selection_mode = 'manual'
  )
)
```

```text
asset_selection_mode: source | manual
asset_source_state: no_source | current | replacement_pending | source_changed
```

Indexes:

```text
INDEX entity_asset_mappings(active_asset_id)
INDEX entity_asset_mappings(source_asset_id) WHERE source_asset_id IS NOT NULL
INDEX entity_asset_mappings(entity_type, asset_role)
```

This supports:

- a preview Character with only a manual asset (`selection_mode=manual`, `source_asset_id=null`);
- a raw Character using extracted art (`selection_mode=source`, active equals source);
- a raw Character retaining manually approved official art while a new source asset waits for review (`selection_mode=manual`, `source_state=replacement_pending`);
- an immutable history because the old object remains stored and the mapping change is audited.

### Relationship to current `skin_asset_mappings`

The current Skin table is source-backed and has a working typed mapping model. It must not be replaced in this design milestone.

Future migration approach:

1. Add generic tables without using them for current Skin reads/exports.
2. Backfill generic Skin records from `skin_asset_mappings` and validate field-for-field parity.
3. Change the importer to dual-write both tables in the same transaction and assert parity in tests.
4. Switch one read/export domain behind an explicit accepted release gate.
5. Retire `skin_asset_mappings` only in a later owner-approved contract migration after stable parity.

Until step 5, the typed mapping remains authoritative for current Skins. This avoids a generic mapping accidentally weakening existing FKs or becoming a second source of truth.

## 7. R2 upload and finalization model

### Chosen transport: direct presigned upload to quarantine

For WHMX on Vercel + R2, use direct browser-to-R2 presigned upload for the binary, followed by a server-side finalization request. This avoids Vercel request-body/runtime limits and does not give the browser a permanent R2 credential.

The browser receives only a short-lived, single-object permission. It never receives an R2 access key, R2 secret, bucket-wide credential, or arbitrary object-key authority.

```text
Owner/admin browser
  -> POST /admin/assets/upload-intents
  -> server: session, role, origin, revision and role validation
  -> DB: short-lived upload intent with exact quarantine object key
  -> browser: PUT directly to that presigned R2 URL
  -> POST /admin/assets/upload-intents/:id/finalize
  -> server: HEAD/download/decode/check object; transform and write final immutable delivery object
  -> DB transaction: asset_objects + entity_asset_mapping + revision + edit_history
```

`asset_upload_intents` is recommended as an implementation table:

```sql
asset_upload_intents (
  id uuid primary key,
  entity_id uuid not null,
  entity_type managed_entity_type not null,
  asset_role text not null,
  requested_provenance asset_provenance not null,
  requested_filename text null,                 -- display/audit only; never a key
  quarantine_object_key text unique not null,
  max_bytes bigint not null,
  allowed_mime_types jsonb not null,
  expected_revision bigint not null,
  status upload_intent_status not null,
  expires_at timestamptz not null,
  created_by_user_id uuid not null references users(id) on delete restrict,
  finalized_by_user_id uuid null references users(id) on delete restrict,
  finalized_at timestamptz null,
  failure_reason text null,
  foreign key (entity_id, entity_type)
    references managed_entities(id, entity_type) on delete restrict,
  foreign key (entity_type, asset_role)
    references entity_asset_role_rules(entity_type, asset_role) on delete restrict
)
```

```text
upload_intent_status: issued | uploaded | verified | finalized | expired | rejected | cleaned
```

The upload intent is not an accepted asset mapping. The object cannot become active until finalization succeeds.

### Validation and processing

Recommended limits, to be enforced server-side at intent issuance and finalization:

| Role | Accepted source formats | Maximum upload | Delivery target |
| --- | --- | ---: | --- |
| avatar | PNG, JPEG, WebP | 4 MiB | WebP, max 1024 px bounding box |
| card | PNG, JPEG, WebP | 10 MiB | WebP, max 2560 px bounding box |
| drawing | PNG, JPEG, WebP | 12 MiB | WebP, max 3072 px bounding box |

The finalizer verifies actual bytes, not the browser MIME type or filename:

1. Head the exact expected quarantine key and enforce byte limit.
2. Download under the bounded limit in a Node runtime/worker.
3. Decode using a reviewed image decoder; reject malformed images, polyglot files, SVG, HTML, JavaScript, executables, archive formats, and images outside pixel/dimension limits.
4. Detect the real MIME type, dimensions, and SHA-256.
5. Preserve the original only in a private object if the retention policy permits it.
6. Produce a verified WebP delivery derivative and hash it.
7. Move/write to a final immutable key, then transactionally create the verified asset metadata and update the mapping/audit/revision.

The first implementation spike must prove this decoder/transform path fits the selected Vercel Node runtime limits. If it does not, use a small authenticated image-processing worker/queue; do not waive server-side verification or accept a client-claimed MIME as a workaround.

### Object-key strategy

User filenames are never object keys. Recommended paths:

```text
quarantine/uploads/<upload-intent-uuid>/original

manual/originals/<asset-object-uuid>/<sha256>.<detected-extension>       # private, optional retention
manual/previews/characters/<preview-uuid>/<role>/<asset-object-uuid>/<sha256>.webp
manual/characters/<managed-character-uuid>/<role>/<asset-object-uuid>/<sha256>.webp
```

Existing imported keys such as `characters/<raw-id>/drawings/...` remain as source-extracted records. They are not renamed by this work.

Each replacement has a new asset UUID and content-hash key. The DB mapping switches to the new immutable URL after review. That gives safe CDN caching: no stable object path is overwritten, and an old cached asset is never accidentally served as a new replacement.

### Original retention, deduplication, and cleanup

- Preserve a private original for manual assets long enough to reproduce a delivery derivative and investigate a dispute; recommended default is 90 days after its last active mapping unless explicitly marked for retention.
- The delivery object is WebP and public only after verification. PostgreSQL stores metadata, not bytes.
- Store verified content hashes. A future implementation may reuse a physical R2 blob with the same hash, but must retain separate semantic asset/audit rows when provenance or uploader differs.
- Expire unfinished intents and delete their quarantine objects after 24 hours. A daily owner-protected cleanup job lists only the owned quarantine prefix and checks intent state before deletion.
- A periodic reconciler reports, rather than blindly deletes, final objects with no committed asset row. It may delete only objects tied to an expired/cleaned intent after a conservative grace period.
- Replacements retire old mappings, not objects. Retained old objects support audit/history and rollback.

## 8. Permission matrix

Every route first validates same-origin request rules, Better Auth session, active `users.status`, current role loaded server-side, body schema, and expected entity revision. Client role display is never trusted.

| Operation | Editor | Owner |
| --- | --- | --- |
| Create preview Character | Create `hidden` + `unverified` draft | Yes |
| Edit non-identity preview text/notes/tags | Own assigned draft or explicitly permitted draft; optimistic lock | Yes |
| Set claimed raw ID / evidence | May propose in a draft; cannot mark/reconcile | Set/change after review |
| Set lifecycle | No | Yes |
| Set `visibility=public` or `preview` | No | Yes |
| Hide own draft | Yes | Yes |
| Initiate upload to quarantine | Hidden preview draft only | Any permitted entity/role |
| Finalize and activate manual asset mapping | No; can submit for review | Yes |
| Replace source/manual active mapping | No | Yes |
| Reconcile preview to official Character | No | Yes, explicit confirmation only |
| Retire/delete preview representation | Request/retire own hidden draft where no reconciliation | Retire; physical deletion only under later retention policy |

`manual_placeholder` activation to a public-visible mapping is owner-only and produces an explicit warning/audit. Raw source-backed fields and relations remain protected from both roles outside the importer.

## 9. Audit, revision, and conflict behavior

Preview entities use the existing `managed_entities.revision` exactly like current managed records:

```text
read -> revision N
mutation -> expectedRevision N
transaction -> domain/mapping/audit writes + revision N+1
stale client -> 409 VERSION_CONFLICT; draft is preserved client-side
```

Future additive enum values should cover `preview_reconciliation` and `asset_mapping_change`; until added, the server must use the existing compatible audit event categories with explicit metadata rather than inventing untyped audit rows.

Each event records field-level old/new values where meaningful:

- preview metadata or lifecycle/visibility change;
- claimed-ID/evidence change;
- upload intent creation/finalization/rejection;
- asset active/source-selection change and prior/new asset IDs;
- source importer detection of a new source asset while manual selection remains active;
- reconciliation proposal, rejection, confirmation, metadata transfer, and retirement.

All reconciliation and mapping changes share a `change_group_id` and request ID. `edit_history` stays subject to the existing six-month retention rule.

Conflict classes remain distinct:

| Conflict | Handling |
| --- | --- |
| Two people edit preview metadata | Numeric revision, HTTP 409; no last-write-wins. |
| Raw/workbook importer changes an official baseline while a transferred manual text override is active | Existing `field_overrides.state = source_changed`; owner resolves. |
| Importer discovers source art while an active manual asset is selected | Keep manual active, update source candidate, set `replacement_pending`, audit, owner selects replacement. |
| A preview claim conflicts with an official raw ID | Candidate proposal only; no automatic mutation. |

## 10. Future public export behavior

No public pipeline changes are made in C.5/D0. A future exporter must deliberately union source-backed Characters and preview Characters into the existing public-read shape.

For an explicitly public preview, the exported record uses its `public_key`, not `claimed_raw_id`, and includes explicit state:

```json
{
  "id": "preview_550e8400-e29b-41d4-a716-446655440000",
  "origin": "manual_preview",
  "lifecycle": "unverified",
  "visibility": "public",
  "is_preview": true,
  "claimed_raw_id": null
}
```

The current frontend/data shape may need a compatibility adapter before accepting this field set; it must be validated rather than assumed. Hidden previews never enter `public/data.json`. A preview with a confirmed reconciliation is excluded even if an old visibility field was public. The source-backed Character appears once under its actual raw ID.

No audit rows, raw internal relations, upload intents, private original URLs, credentials, or unpublished preview metadata enter the public artifact.

## 11. Future Admin UX

### Preview Character workspace

Required future UI, without redesigning existing public Character/Gallery pages:

- Create and edit preview Character draft.
- Show origin, lifecycle, visibility, UUID/public key, claimed raw ID, evidence/provenance notes, and revision.
- Clearly label manual values as manual preview data rather than source-backed data.
- Display current avatar/card/drawing, provenance, verification state, and source/manual selection.
- Upload/replace asset flow with local preview before submit; show placeholder warning.
- Show audit/history and current revision conflict state.
- Offer an owner-only reconcile action that displays candidate official evidence, transfer choices, duplicate-public warning, and an irreversible-looking confirmation step (implemented as a forward-audited action, not a hidden delete).

### Asset workspace

For every mapping show:

```text
active asset
asset role
provenance
verification state
source candidate (if any)
replacement-pending state
content hash / dimensions / MIME
who uploaded/activated it and when
```

The UI distinguishes `manual_placeholder` from `manual_preview`, `manual_official`, and `source_extracted`. It previews a candidate before activation but does not make it public until finalization and mapping transaction complete.

## 12. Security baseline and risks

| Risk | Required safeguard |
| --- | --- |
| Browser receives storage credentials | Issue only short-lived, single-key presigned permissions; keys/secrets remain server-side. |
| Path traversal/key overwrite | Server generates exact quarantine/final keys from UUIDs and hashes; never trusts client path or filename. |
| Untrusted executable/HTML upload | Accept only decoded PNG/JPEG/WebP; reject SVG, HTML, JS, archives, and undecodable bytes. |
| MIME spoofing/polyglot image | Decode actual bytes server-side, store detected MIME, impose size/pixel limits. |
| Mapping an unverified upload | Finalizer checks the exact intent/key/object and writes mapping only after verification. |
| Uploading over another entity's image | Intent binds entity, role, user, revision, and one generated object key. |
| Orphan storage cost | Expire quarantine intents and conservative scoped cleanup; report final-object anomalies before deletion. |
| Public placeholder/meme accident | Owner-only activation for public visibility with explicit provenance/warning/audit. |
| Raw source art silently overwritten | Separate `source_asset_id` and active selection; importer creates review state. |
| Direct DB abuse / role spoofing | Session, active-user and role lookup server-side, origin protection, validation, revisions, transactions. |
| Abuse/rate pressure | Per-user/IP rate limits for intent creation/finalization, concurrent-intent cap, bounded images, generic errors. |
| Secret/error disclosure | No `VITE_*` storage/DB secrets; generic API errors; no R2/DB stack trace returned to client. |

## 13. Additive implementation sequence

This is an implementation plan only, not authorization to execute it.

1. **Schema review:** add `preview_character` entity type; publication/lifecycle/origin enums; `preview_characters`; reconciliation tables; asset provenance metadata; role rules; generic mappings; upload intents. Do not rewrite existing migrations.
2. **Development migration:** generate/review additive Drizzle SQL, apply manually to Neon `development` only, verify FKs/checks/indexes and no change to existing 133/145 source data.
3. **Preview domain service:** create/read/update hidden preview drafts with owner/editor permission tests, numeric revision/409 tests, audit tests, and no raw ID fabrication.
4. **R2 upload spike:** implement quarantine presign/finalize with real image verification, small bounded transform, intent expiration, and secret-boundary tests. No public export yet.
5. **Asset mapping parity:** backfill generic Skin mappings, dual-write importer, and prove mapping parity before switching any current Skin reader.
6. **Reconciliation service:** owner-only proposal/confirm/reject flows, manual override transfer, manual asset source-replacement review, and duplicate-public export gate tests.
7. **Export/UI:** add explicit preview export adapter and admin UI only after hidden/public/reconciliation test fixtures and existing public validators pass.
8. **Preview environment:** create/use a separately approved `preview/pr-*` Neon branch manually, run reviewed migrations, then test Vercel Preview. No build/deploy auto-migration.

## 14. Rollback and recovery

- Use expand/backfill/dual-read/contract migrations. Do not create an unreviewed down migration for a published feature.
- Revoke an unfinalized upload intent; its quarantine object is cleaned by the scoped expiry job.
- Asset rollback means select the prior verified asset mapping in a new owner-audited/revision-checked transaction. Immutable old objects remain available while retained.
- Reconciliation rollback is a forward owner action: restore preview visibility/lifecycle if appropriate, clear the confirmed link only with a new reconciliation/audit record, and remove/resolve only the explicit transferred overrides/mappings. Never silently delete history or rewrite raw evidence.
- Public snapshot rollback remains a Git revert of the reviewed `public/data.json` artifact; DB state is independently corrected through audited forward changes.
- Before any future production migration, retain the existing approved Neon backup/restore-point and reviewed migration process.

## 15. Owner decisions still required

Locked decisions in the request are sufficient for the data-model direction. The following policy choices should be confirmed before implementation because they change public behavior or retention cost:

1. **Public placeholders:** recommended default is owner-only and explicit; confirm whether `manual_placeholder` images may ever appear on the public site, or only in authenticated preview.
2. **Original retention:** recommended default is private original retention for 90 days after last active use, then purge unless deliberately retained. Confirm if leaks/manual originals require a different retention period.
3. **Unreleased source-backed Characters:** confirm whether owner-set `visibility=public` is acceptable for authoritative preload Characters, or whether they must remain `preview` until game release.
4. **Editor staging:** recommended default lets editors create/edit hidden unverified drafts and submit quarantine uploads, while owners activate assets, set public visibility/lifecycle, change claimed identity, and reconcile. Confirm if editors should be more restricted or granted activation rights.

No other decision is required to preserve raw authority, workbook authority, or the current Character/Skin model.
