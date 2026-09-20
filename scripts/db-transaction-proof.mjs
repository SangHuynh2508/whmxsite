import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { closeDb, getDb } from '../db/client.mjs';
import { sourceSnapshots } from '../db/schema/core.mjs';

const db = getDb();
const proofHash = `foundation-transaction-proof-${randomUUID()}`;

try {
  await assert.rejects(
    db.transaction(async (transaction) => {
      await transaction.insert(sourceSnapshots).values({
        sourceKind: 'normalized_build',
        sourceVersion: 'foundation-transaction-proof',
        contentHash: proofHash,
        sourcePath: 'non-persistent-test',
        manifest: { purpose: 'transaction-rollback-proof' },
      });
      throw new Error('intentional rollback proof');
    }),
    /intentional rollback proof/,
  );

  const remaining = await db
    .select({ id: sourceSnapshots.id })
    .from(sourceSnapshots)
    .where(eq(sourceSnapshots.contentHash, proofHash));

  assert.equal(remaining.length, 0, 'transaction rollback left a proof row behind');
  console.log('DB_TRANSACTION_PROOF=PASS');
} finally {
  await closeDb();
}
