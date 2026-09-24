// scripts/import-character-profile.mjs
// Profile/lore importer. Default: read-only plan. --apply writes (owner approval required).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq, inArray, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import { characters } from '../db/schema/character-skin.mjs';
import { editHistory, importRuns, managedEntities, sourceSnapshots } from '../db/schema/core.mjs';
import { characterProfiles, lorePublishState, loreTerms, profileTexts } from '../db/schema/profile.mjs';
import { matchLegacyCells } from './lib/profile-legacy.mjs';
import { planProfileImport } from './lib/profile-import-plan.mjs';
import { hashValue, normalizeProfileSources, sha256 } from './lib/profile-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = resolve(ROOT, '..', 'NeoArtifacts', 'MasterData', 'json');
const SOURCES = {
  characterFiles: 'characterFiles.json', characterFileTextMap: 'characterFileTextMap.json',
  historicalRelicsMap: 'historicalRelicsMap.json', historicalTextMap: 'HistoricalTextMap.json',
  friendshipDescription: 'friendshipDescription.json', characterTable: 'characterTable.json', typeJJHMap: 'TypeJJHMap.json',
};

function loadRaw(masterRoot) {
  const raw = {};
  const files = [];
  for (const [key, name] of Object.entries(SOURCES)) {
    const buffer = readFileSync(join(masterRoot, name));
    raw[key] = JSON.parse(buffer.toString('utf8'));
    files.push({ path: `NeoArtifacts/MasterData/json/${name}`, sha256: sha256(buffer) });
  }
  return { raw, receipt: { sourceKind: 'masterdata', sourceVersion: 'character-profile-masterdata-v1', contentHash: hashValue(files), sourcePath: 'NeoArtifacts/MasterData/json', manifest: { files } } };
}

function readLegacyRows(workbook) {
  const out = execFileSync('python', [join(ROOT, 'scripts', 'read_profile_legacy_vi.py'), '--workbook', workbook], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  return JSON.parse(out);
}

async function loadCurrent(db) {
  const profileRows = await db.select({ characterId: characters.characterId, entityId: characterProfiles.entityId, sourceHash: characterProfiles.sourceHash, sourcePresent: characterProfiles.sourcePresent })
    .from(characterProfiles).innerJoin(characters, eq(characters.entityId, characterProfiles.characterEntityId));
  const byEntity = new Map(profileRows.map((r) => [r.entityId, r.characterId]));
  const textRows = await db.select().from(profileTexts);
  const termRows = await db.select().from(loreTerms);
  return {
    profiles: new Map(profileRows.map((r) => [r.characterId, r])),
    texts: new Map(textRows.map((r) => [`${byEntity.get(r.profileEntityId)}|${r.unitKey}`, r])),
    terms: new Map(termRows.map((r) => [r.code, r])),
  };
}

function summarize(plan, normalized, seeds) {
  return {
    counts: plan.counts,
    skippedRawCharacters: normalized.skipped,
    profiles: plan.profiles.filter((p) => p.action !== 'unchanged').map((p) => `${p.action} ${p.characterId}`),
    textInserts: plan.textInserts.length,
    textUpdates: plan.textUpdates.map((u) => `${u.characterId} ${u.unitKey} ${JSON.stringify(u.patch.state ?? (u.patch.sourcePresent === false ? 'absent' : 'source'))}`),
    terms: plan.terms.filter((t) => t.action !== 'unchanged').map((t) => `${t.action} ${t.code}`),
    legacySeeds: seeds ? seeds.map((s) => `${s.characterId} ${s.unitKey}${s.sourceChanged ? ' (source_changed)' : ''}`) : undefined,
  };
}

async function ensureEntities(tx, entityType, keys) {
  if (keys.length) await tx.insert(managedEntities).values(keys.map((sourceKey) => ({ entityType, sourceKey }))).onConflictDoNothing();
  const rows = keys.length ? await tx.select().from(managedEntities).where(inArray(managedEntities.sourceKey, keys)) : [];
  return new Map(rows.filter((r) => r.entityType === entityType).map((r) => [r.sourceKey, r.id]));
}

async function apply(db, { plan, receipt, seeds }) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [existingSnap] = await tx.select().from(sourceSnapshots).where(sql`${sourceSnapshots.sourceKind} = ${receipt.sourceKind} and ${sourceSnapshots.sourceVersion} = ${receipt.sourceVersion} and ${sourceSnapshots.contentHash} = ${receipt.contentHash}`);
    const snapshot = existingSnap ?? (await tx.insert(sourceSnapshots).values(receipt).returning())[0];
    const [run] = await tx.insert(importRuns).values({ sourceSnapshotId: snapshot.id, status: 'started', counts: {} }).returning();

    const characterRows = await tx.select({ entityId: characters.entityId, characterId: characters.characterId }).from(characters);
    const characterEntity = new Map(characterRows.map((r) => [r.characterId, r.entityId]));
    const profileEntity = await ensureEntities(tx, 'character_profile', plan.profiles.map((p) => p.characterId));
    const termEntity = await ensureEntities(tx, 'lore_term', plan.terms.map((t) => t.code));

    for (const p of plan.profiles) {
      if (p.action === 'unchanged') continue;
      const { characterId, ...row } = p.row;
      const values = { ...row, characterEntityId: characterEntity.get(characterId), sourceSnapshotId: snapshot.id, sourcePresent: true, sourceSeenAt: now, updatedAt: now };
      if (p.action === 'insert') await tx.insert(characterProfiles).values({ entityId: profileEntity.get(characterId), ...values });
      else await tx.update(characterProfiles).set(values).where(eq(characterProfiles.entityId, profileEntity.get(characterId)));
    }
    if (plan.textInserts.length) {
      await tx.insert(profileTexts).values(plan.textInserts.map(({ characterId, unitKey, sourceCn, sourceRef, sourceHash }) => ({ profileEntityId: profileEntity.get(characterId), unitKey, sourceCn, sourceRef, sourceHash })));
    }
    for (const u of plan.textUpdates) await tx.update(profileTexts).set({ ...u.patch, updatedAt: now }).where(eq(profileTexts.id, u.id));
    for (const t of plan.terms) {
      if (t.action === 'insert') await tx.insert(loreTerms).values({ entityId: termEntity.get(t.code), code: t.code, kind: t.row.kind, nameCn: t.row.nameCn, detailCn: t.row.detailCn, sourceHash: t.row.sourceHash });
      if (t.action === 'update') await tx.update(loreTerms).set({ ...t.patch, updatedAt: now }).where(eq(loreTerms.code, t.code));
    }

    const touched = new Set(plan.touchedProfiles);
    for (const seed of seeds ?? []) {
      const entityId = profileEntity.get(seed.characterId);
      const updated = await tx.update(profileTexts)
        .set({ vi: seed.vi, viOrigin: 'legacy_workbook', state: seed.sourceChanged ? 'source_changed' : 'ok', viUpdatedAt: now, updatedAt: now })
        .where(sql`${profileTexts.profileEntityId} = ${entityId} and ${profileTexts.unitKey} = ${seed.unitKey} and ${profileTexts.vi} is null`).returning({ id: profileTexts.id });
      if (updated.length) {
        touched.add(seed.characterId);
        plan.audits.push({ scope: 'profile', key: seed.characterId, fieldName: seed.unitKey, oldValue: null, newValue: { vi: seed.vi, viOrigin: 'legacy_workbook' }, metadata: { legacySeed: true } });
      }
    }

    const audits = plan.audits.map((a) => ({
      changeGroupId: run.id, requestId: run.id, importRunId: run.id, eventType: 'source_import',
      entityId: a.scope === 'profile' ? profileEntity.get(a.key) : termEntity.get(a.key),
      entityType: a.scope === 'profile' ? 'character_profile' : 'lore_term',
      fieldName: a.fieldName, oldValue: a.oldValue, newValue: a.newValue, metadata: a.metadata ?? {},
    }));
    if (audits.length) await tx.insert(editHistory).values(audits);

    const bumpIds = [...[...touched].map((id) => profileEntity.get(id)), ...[...plan.touchedTerms].map((code) => termEntity.get(code))];
    if (bumpIds.length) await tx.update(managedEntities).set({ revision: sql`${managedEntities.revision} + 1`, updatedAt: now }).where(inArray(managedEntities.id, bumpIds));
    if (plan.cnChanged || (seeds ?? []).length) {
      await tx.insert(lorePublishState).values({ id: 1, lastEditAt: now }).onConflictDoUpdate({ target: lorePublishState.id, set: { lastEditAt: now } });
    }
    const status = plan.counts.conflicted ? 'completed_with_conflicts' : 'completed';
    await tx.update(importRuns).set({ status, finishedAt: new Date(), counts: plan.counts }).where(eq(importRuns.id, run.id));
    return { importRunId: run.id, status, counts: plan.counts };
  });
}

function parseArgs(argv) {
  const args = { masterRoot: MASTER, workbook: join(ROOT, 'localization', 'localization_master.xlsx'), dataJson: join(ROOT, 'public', 'data.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--apply') args.apply = true;
    else if (a === '--seed-legacy-workbook') args.seedLegacy = true;
    else if (a === '--master-root') args.masterRoot = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const { raw, receipt } = loadRaw(args.masterRoot);
    if (args.check) {
      // --check: never opens a DB connection; data.json's character IDs stand in for the DB roster.
      const ids = Object.keys(JSON.parse(readFileSync(args.dataJson, 'utf8')).characters);
      const normalized = normalizeProfileSources(raw, ids);
      const legacy = args.seedLegacy ? matchLegacyCells(readLegacyRows(args.workbook), normalized.profiles) : null;
      console.log(JSON.stringify({ check: 'ok', characters: normalized.profiles.length, units: normalized.profiles.reduce((n, p) => n + p.units.length, 0), terms: normalized.terms.length, skipped: normalized.skipped, legacySeeds: legacy?.seeds.length, legacyIgnored: legacy?.ignored.length }));
    } else {
      const db = getDb();
      const ids = (await db.select({ id: characters.characterId }).from(characters)).map((r) => r.id);
      const normalized = normalizeProfileSources(raw, ids);
      const plan = planProfileImport({ normalized, current: await loadCurrent(db) });
      const seeds = args.seedLegacy ? matchLegacyCells(readLegacyRows(args.workbook), normalized.profiles).seeds : null;
      if (!args.apply) console.log(JSON.stringify({ mode: 'plan (read-only, nothing written)', ...summarize(plan, normalized, seeds) }, null, 2));
      else console.log(JSON.stringify(await apply(db, { plan, receipt, seeds })));
    }
  } catch (error) {
    console.error(`PROFILE_IMPORT_FAILED: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
