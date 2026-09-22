# WHMX Engineering Principles

## 1. Purpose

This document is not about where files live (`WHMX_APP_ARCHITECTURE.md` already owns that). It is about **how to write the code itself** so that WHMX survives changes in technology, traffic, and requirements without either of two failure modes:

- **Rigid forever**: a structure gets treated as sacred and never revisited, so the codebase slowly stops fitting reality (the "keep the same structure for decades no matter what" failure mode).
- **Rewritten constantly**: every new idea triggers a rewrite of working code "just in case," so nothing ever stabilizes and regression risk stays permanently high.

The owner's explicit instruction: build a structure that is **stable, but not stuck** — solid enough to trust, flexible enough to redirect when a real reason appears. This document exists so that any future session (human or AI) that has not read the prior conversation can still write code in the same spirit, because the reasoning is written down, not just the current file tree.

Read this alongside `WHMX_APP_ARCHITECTURE.md` (organization/boundaries) and `WHMX_ARCHITECTURE_MIGRATION_PLAN.md` (how structural moves are executed safely). This document is about the shape of the *code inside* those boundaries.

## 2. The core idea: isolate the decision that might change, not the code around it

Every one of the concrete lessons below is the same idea applied in a different place: **find the part of a feature that is genuinely likely to change, and give it a narrow, well-named interface — so the parts that call it never have to know or care how it's implemented.** The parts that are unlikely to change (a domain's data shape, a validated business rule) do not need this treatment; wrapping something stable in an abstraction "just in case" is waste, not flexibility. Judging which is which is the actual skill this document is trying to write down.

### Worked example 1 — the public-data resolver pattern (from this session's Hướng A/B discussion)

WHMX faced this question: should public pages read live from PostgreSQL on every request ("Hướng A"), or keep a static generated snapshot that gets republished whenever Admin saves ("Hướng B")? Both are legitimate — S1N.gg does the former (Supabase direct reads), Great Limbus Library does the latter (data baked into the build) — real products, both working, at very different traffic scales. **LOCKED (2026-09-22): WHMX chose Hướng B** (see `WHMX_APP_ARCHITECTURE.md` §11) — but the reasoning below for *how* to build B is exactly what keeps that choice from being a one-way door, which is the actual point of this worked example.

**The mistake would be building the data-shaping logic (joining Character + Skin + localization + assets into the shape a public page needs) as a monolithic script that walks the whole database and writes one big file.** That hard-codes "Hướng B" into the implementation.

**The resilient version:** write the shaping logic as small, per-entity functions —

```text
resolveCharacterPublicView(characterId) -> shaped public object
resolveSkinPublicView(skinId) -> shaped public object
```

A static-publish pipeline calls these in a loop and writes the result to a snapshot. A live-read API calls the exact same function once per request. **The decision "static vs live" moves to the thin caller, not into the shaping logic itself.** Building Hướng B this way does not foreclose Hướng A later — exposing a new public read route becomes a small additive change (new thin route + existing resolver), not a rewrite. Building it the other way (one big script) means Hướng A later requires re-deriving the same logic from scratch.

This is the general pattern: **when a piece of business logic ("what does this entity look like to the public") is stable, but the way it gets delivered (batch file vs. live request vs. something else later) is genuinely open, put the seam at the delivery boundary, not inside the logic.**

### Worked example 2 — vendor-neutral data access (from this session's Neon/Supabase discussion)

`db/client.mjs` uses the standard `postgres` npm package and `drizzle-orm/postgres-js` — not Neon's proprietary serverless driver. The practical result, discovered directly in this session: **switching the underlying Postgres host (Neon → Supabase-as-plain-Postgres, or anywhere else) requires zero code changes**, only a connection-string swap, because nothing in the query/ORM layer knows or cares which company is hosting the database.

This was not an accident worth praising in the abstract — it is the concrete payoff of a rule: **prefer the standard library/protocol over a vendor's proprietary SDK unless that vendor's specific feature is the actual reason you chose them.** WHMX did not choose Neon for a Neon-exclusive feature that required their driver, so using their driver would have been lock-in with no corresponding benefit. Contrast: if WHMX ever *did* want Supabase's Row-Level-Security-based direct-call architecture specifically (a deliberate, evaluated choice — see the Neon-vs-Supabase conversation record for why that was not chosen), that would be a case where adopting a vendor-specific pattern is the whole point, not an accident to avoid.

### Worked example 3 — the Admin API consolidation (`api/admin/[...path].js`, Plan A)

Ten separate Vercel Function files, one per resource, hit a Hobby-plan hard cap (12 functions) the moment the domain count grew past what anyone designed for. The fix was not "delete some domains" or "pay for Pro" — it was noticing that the thing genuinely likely to grow (number of domains: Character, Skin, User, Preview, Asset, later Skill/Guide/Tier List/Buff, later still Character sub-features like Talent/Hoán Chương/Lore) had been wired 1:1 into the thing that is expensive to grow (Vercel Function count). Moving the per-domain dispatch logic into `server/admin-api-routes/` (outside `api/`, so it never counts as a function) and leaving exactly one thin dispatcher file in `api/` decouples "how many content domains WHMX has" from "how many serverless functions WHMX has" — permanently, not just for the current 13-file crisis.

## 3. Concrete rules

1. **Before writing a batch/script/one-shot version of logic that touches multiple entities, ask: will anything ever need this same logic for a single entity, on demand?** If yes (worked example 1), write the per-entity function first and have the batch version call it in a loop, not the other way around.
2. **Default to the standard library, standard protocol, or standard SQL over a platform's proprietary SDK**, unless that platform's specific proprietary feature is the actual, named reason it was chosen. If it's an accident of which quickstart you followed, it's lock-in for no reason (worked example 2).
3. **When a genuinely open decision exists (see `WHMX_APP_ARCHITECTURE.md`'s `OPEN DECISION` status), write the code so the decision lives in one small, clearly-named place** — not scattered as assumptions baked into unrelated modules. A future resolution of the open decision should mean editing that one place, not grepping the codebase for every spot that assumed one answer.
4. **Do not let a single file accumulate more than one entity's worth of responsibility "because it's already open/being edited."** `characterSkinAdminWorkspace.js` is flagged in `WHMX_ADMIN_ARCHITECTURE_ANALYSIS_S1N_GLLIMBUS.md` as already showing this shape (Character CRUD + Skin CRUD + History + Source-comparison + caching in one 364-line render-function file). New work should not deepen this; when it is next substantially touched, the growing pieces should split by responsibility, matching the domain-first structure the architecture doc already mandates.
5. **Decouple "how many things exist" from "how expensive it is to add one."** Worked example 3 is the general form of this: whenever a resource cap, a per-item file, or a per-item function is about to be created, ask whether the *count of domains* is the thing driving cost, and if so, put a dispatcher/registry in front of it instead of scaling files 1:1 with domains.
6. **Write down *why*, not just *what*, at the moment a structural decision is made** — a comment or a docs line explaining the reasoning (like this document, or the `LOCKED`/`TARGET`/`OPEN DECISION`/`LEGACY` vocabulary already established in `WHMX_APP_ARCHITECTURE.md`) lets a future reader judge whether the original reasoning still holds, instead of either blindly preserving a decision whose reason no longer applies, or blindly discarding one whose reason still does.

## 4. When NOT to apply this — the explicit exception

Flexibility has a cost: an extra layer of indirection, a function signature to maintain, a seam to keep in sync. **Do not add that cost when making something flexible is harder than just rewriting it later would be.** Concretely:

- A one-off script run manually by the owner once (an import fix, a data-repair pass) does not need a reusable resolver function — it needs to work once, correctly, and be deletable.
- A UI component with exactly one real caller and no plausible second use does not need to be pre-emptively generalized "in case" a second caller shows up — `WHMX_APP_ARCHITECTURE.md`'s own **shared promotion rule** already says a component moves to `shared/` only after real, proven reuse, never in anticipation of it.
- A trivial bug fix does not need an architectural seam introduced around it just because the file it's in *could* theoretically be made more flexible.

The test is simple: **if writing the flexible version takes meaningfully longer than writing the direct version would, and nothing concrete today needs the flexibility, write the direct version.** Revisit when — and only when — a second real, concrete use case actually shows up (`WHMX_ARCHITECTURE_MIGRATION_PLAN.md`'s "touch it, improve it" philosophy is the same rule applied to file organization; this section is that same rule applied to code-level design).

## 5. Checklist before starting a new feature or domain

1. What part of this is stable (the business rule, the data shape) and what part is genuinely still open (delivery mechanism, which vendor, which UI pattern)? Put the seam at the open part.
2. Does this reuse an existing per-entity function/module, or does it duplicate logic that already exists as a batch/script? If duplicating, can the existing logic be extracted into a shared function instead?
3. Does this pull in a vendor-specific SDK where the standard library would do the same job? If so, is the vendor-specific feature the actual reason for this choice, or just convenience from a tutorial?
4. Does this land inside an already-large file "because it's related," or does it deserve its own module split by responsibility?
5. Is this genuinely new complexity for a real, current need — or speculative flexibility for a need that does not exist yet? If the latter, per Section 4, skip it.
6. If this makes a structural decision, is the *why* written down somewhere a future reader (human or AI) will actually find it — this document, `WHMX_APP_ARCHITECTURE.md`, or a code comment at the exact seam?
