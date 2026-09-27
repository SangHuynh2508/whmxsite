// server/profile/lore-repository.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import { createLoreRepository } from './lore-repository.mjs';

// Before migration 0007 is applied the Build tables don't exist: publishing lore must keep working.
test('no Build tables yet (migration 0007 not applied) → no builds, and nothing reads them', async () => {
  const tx = {
    execute: async () => [{ present: false }],
    select: () => { throw new Error('must not query a missing table'); },
  };
  assert.equal(await createLoreRepository(null).loadPublishBuilds(tx), null);
});
