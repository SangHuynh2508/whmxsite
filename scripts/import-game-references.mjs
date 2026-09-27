// scripts/import-game-references.mjs
// Game database for the Build feature (and later popups / weapon / team pages): MasterData → game_references +
// game_texts (spec docs/superpowers/specs/2026-09-26-character-build-design.md §4; owner 2026-09-27: own tables,
// nothing in lore).
// Default: read-only plan. --apply writes (owner approval required). --check: no DB, prints what would be imported.
//   node --env-file=.env.local scripts/import-game-references.mjs            # plan against the development DB
//   node --env-file=.env.local scripts/import-game-references.mjs --apply    # write (owner yes)
//   node scripts/import-game-references.mjs --check [--fixtures]             # no DB; --fixtures reads scripts/fixtures/masterdata
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq, inArray, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import { gameReferences, gameTexts } from '../db/schema/build.mjs';
import { editHistory, importRuns, managedEntities, sourceSnapshots } from '../db/schema/core.mjs';
import { ensureEntities } from './import-character-profile.mjs';
import { planGameRefImport, textKey } from './lib/game-ref-import-plan.mjs';
import { BUILD_TABLES, FULL_TABLES, normalizeGameReferences, selectBuildTables } from './lib/game-ref-source.mjs';
import { hashValue, sha256 } from './lib/profile-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = resolve(ROOT, '..', 'NeoArtifacts', 'MasterData', 'json');
const ICONS = resolve(ROOT, '..', 'NeoArtifacts', 'Assets', 'ItemIcons');
const FIXTURES = join(ROOT, 'scripts', 'fixtures', 'masterdata');

function loadTables({ fixtures, masterRoot, iconRoot }) {
  const files = [];
  const read = (dir, name) => {
    const buffer = readFileSync(join(dir, name));
    files.push({ path: name, sha256: sha256(buffer) });
    return JSON.parse(buffer.toString('utf8'));
  };
  const tables = fixtures
    ? Object.fromEntries(BUILD_TABLES.map((name) => [name, read(FIXTURES, `${name}.json`)]))
    : selectBuildTables(Object.fromEntries(Object.entries(FULL_TABLES).map(([key, name]) => [key, read(masterRoot, name)])), (id) => existsSync(join(iconRoot, `itemicon_${id}.png`)));
  const icons = fixtures ? 'fixtures' : tables.weaponIconsPresent;
  return { tables, receipt: { sourceKind: 'masterdata', sourceVersion: 'game-references-masterdata-v1', contentHash: hashValue({ files, icons }), sourcePath: fixtures ? 'scripts/fixtures/masterdata' : 'NeoArtifacts/MasterData/json', manifest: { files } } };
}

async function loadCurrent(db) {
  const refs = await db.select({ id: gameReferences.id, kind: gameReferences.kind, code: gameReferences.code, sourceHash: gameReferences.sourceHash, sourcePresent: gameReferences.sourcePresent }).from(gameReferences);
  const texts = await db.select().from(gameTexts);
  return { refs: new Map(refs.map((r) => [`${r.kind}|${r.code}`, r])), texts: new Map(texts.map((t) => [textKey(t), t])) };
}

const counts = (rows) => rows.reduce((out, r) => ({ ...out, [r.kind]: (out[r.kind] ?? 0) + 1 }), {});

function grouped(changes) {
  const out = {};
  for (const [action, kind, key] of changes) {
    const g = ((out[action] ??= {})[kind] ??= { count: 0, examples: [] });
    g.count += 1;
    if (g.examples.length < 3) g.examples.push(key);
  }
  return out;
}

function summarize(plan, normalized) {
  return {
    counts: plan.counts,
    refs: counts(normalized.refs),
    texts: counts(normalized.texts),
    skipped: normalized.skipped,
    problems: normalized.problems,
    // grouped per action and kind, with a few examples (the full list runs to 1 000+ lines on a first import)
    refChanges: grouped(plan.refs.filter((r) => r.action !== 'unchanged').map((r) => [r.action, r.key.split('|')[0], r.key])),
    textChanges: grouped(plan.terms.filter((t) => t.action !== 'unchanged').map((t) => [t.action, t.code.split('|')[0], t.code])),
  };
}

async function apply(db, { plan, receipt }) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [existingSnap] = await tx.select().from(sourceSnapshots).where(sql`${sourceSnapshots.sourceKind} = ${receipt.sourceKind} and ${sourceSnapshots.sourceVersion} = ${receipt.sourceVersion} and ${sourceSnapshots.contentHash} = ${receipt.contentHash}`);
    const snapshot = existingSnap ?? (await tx.insert(sourceSnapshots).values(receipt).returning())[0];
    const [run] = await tx.insert(importRuns).values({ sourceSnapshotId: snapshot.id, status: 'started', counts: {} }).returning();

    for (const r of plan.refs) {
      if (r.action === 'unchanged') continue;
      const [kind, code] = r.key.split('|');
      if (r.action === 'insert') await tx.insert(gameReferences).values({ kind, code, data: r.row.data, sourceHash: r.row.sourceHash, sourceSeenAt: now });
      else await tx.update(gameReferences).set({ ...r.patch, ...(r.action === 'update' ? { sourceSeenAt: now } : {}), updatedAt: now }).where(sql`${gameReferences.kind} = ${kind} and ${gameReferences.code} = ${code}`);
    }

    // game_texts: one managed entity per text (source_key "kind|code") for revisions + edit history
    const textEntity = await ensureEntities(tx, 'game_text', plan.terms.map((t) => t.code));
    for (const t of plan.terms) {
      const [kind, code] = t.code.split('|');
      if (t.action === 'insert') await tx.insert(gameTexts).values({ entityId: textEntity.get(t.code), kind, code, nameCn: t.row.nameCn, detailCn: t.row.detailCn, sourceHash: t.row.sourceHash });
      if (t.action === 'update' || t.action === 'absent') await tx.update(gameTexts).set({ ...t.patch, updatedAt: now }).where(sql`${gameTexts.kind} = ${kind} and ${gameTexts.code} = ${code}`);
    }
    const audits = plan.audits.map((a) => ({
      changeGroupId: run.id, requestId: run.id, importRunId: run.id, eventType: 'source_import',
      entityId: textEntity.get(a.key), entityType: 'game_text', fieldName: a.fieldName, oldValue: a.oldValue, newValue: a.newValue, metadata: {},
    }));
    if (audits.length) await tx.insert(editHistory).values(audits);
    const bumpIds = [...plan.touchedTerms].map((key) => textEntity.get(key));
    if (bumpIds.length) await tx.update(managedEntities).set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now }).where(inArray(managedEntities.id, bumpIds));
    // Nothing is published from here: the game document (game.<hash>.json) gets its publisher in Build PR 2.

    const status = plan.counts.conflicted ? 'completed_with_conflicts' : 'completed';
    await tx.update(importRuns).set({ status, finishedAt: new Date(), counts: plan.counts }).where(eq(importRuns.id, run.id));
    return { importRunId: run.id, status, counts: plan.counts };
  });
}

function parseArgs(argv) {
  const args = { masterRoot: MASTER, iconRoot: ICONS };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--apply') args.apply = true;
    else if (a === '--fixtures') args.fixtures = true;
    else if (a === '--master-root') args.masterRoot = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (args.apply && args.fixtures) throw new Error('--apply reads NeoArtifacts, not the trimmed fixtures');
  return args;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  let db = null;
  try {
    const args = parseArgs(process.argv.slice(2));
    const { tables, receipt } = loadTables(args);
    const normalized = normalizeGameReferences(tables);
    if (args.check) {
      console.log(JSON.stringify({ check: normalized.problems.length ? 'problems' : 'ok', refs: counts(normalized.refs), texts: counts(normalized.texts), skipped: normalized.skipped, problems: normalized.problems }, null, 2));
      if (normalized.problems.length) process.exitCode = 1;
    } else {
      db = getDb();
      const plan = planGameRefImport({ normalized, current: await loadCurrent(db) });
      if (!args.apply) console.log(JSON.stringify({ mode: 'plan (read-only, nothing written)', ...summarize(plan, normalized) }, null, 2));
      else if (normalized.problems.length) throw new Error(`MasterData has problems, nothing written: ${normalized.problems.join('; ')}`);
      else console.log(JSON.stringify(await apply(db, { plan, receipt })));
    }
  } catch (error) {
    console.error(`GAME_REF_IMPORT_FAILED: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    if (db) await closeDb();
  }
}
