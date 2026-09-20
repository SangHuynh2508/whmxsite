# D0B — R2 managed image upload pipeline

## Runtime boundary

The server-only R2 client reads `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`, and `R2_MANAGED_ASSET_PREFIX`.
The prefix is required to match an isolated `admin-*` namespace and rejects
existing source/public prefixes such as `characters/`, `skins/`, and `source/`.
No storage variable uses a `VITE_*` prefix.

The current development environment has no R2 credentials or bucket configured.
The existing asset manifest points at a public R2 URL with source keys under
`characters/...`; therefore D0B deliberately performs no real R2 PUT until the
owner supplies a dedicated non-production bucket or confirms an isolated
development prefix in the configured bucket. The fake-storage proof is fully
scoped to `admin-dev/` and leaves no database or object residue.
The development database currently records 290 existing `r2` asset rows whose
keys begin under `characters/`, so the existing source/public arrangement is
treated as shared and is not mutated by this milestone.

## Flow

`POST /api/admin/assets/upload-intents` authenticates the Better Auth session,
checks the database-derived user role/entity/revision/role rule, writes a
server-generated quarantine key, and returns only a short-lived presigned PUT
capability. User filenames are metadata only.

`POST /api/admin/assets/upload-intents/:id/finalize` is owner-only. It reloads
the exact intent, verifies expiry/revision/namespace, HEADs and bounded-downloads
the exact quarantine object, detects/decode-checks PNG/JPEG/WebP bytes with
`file-type` and `sharp`, enforces role limits, writes an immutable WebP delivery
object, verifies it, and transactionally creates the verified `asset_objects`
row, active generic mapping, revision, audit row, and finalized intent. The
quarantine object is then deleted by exact key; failed DB activation removes
only the generated final object and never makes an orphan publicly active.

Role limits:

| Role | Accepted source | Maximum upload | Output bound |
| --- | --- | ---: | ---: |
| avatar | PNG/JPEG/WebP | 4 MiB | 1024 px |
| card | PNG/JPEG/WebP | 10 MiB | 2560 px |
| drawing | PNG/JPEG/WebP | 12 MiB | 3072 px |

Editors may issue/stage uploads for hidden, unverified preview drafts. Owners
finalize and activate. Existing source-extracted asset rows and
`skin_asset_mappings` remain untouched.

## Proof

`npm run db:managed-asset-test` uses an in-memory storage adapter (no real R2
mutation) and proves role rejection, malformed-image rejection, server-generated
keys, owner finalization, immutable replacement, old-asset retention, revision
and audit writes, and source/Skin parity. A real presigned upload remains an
explicitly unresolved environment blocker until the owner configures the safe
R2 boundary above.
