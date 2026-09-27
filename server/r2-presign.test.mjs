import assert from 'node:assert/strict';
import test from 'node:test';

import { createR2ManagedAssetStorage } from './assets/r2-managed-assets.mjs';

test('a presigned upload URL carries no body checksum (the browser uploads bytes the server never saw)', async () => {
  const storage = createR2ManagedAssetStorage({
    endpoint: 'https://account.r2.cloudflarestorage.com',
    bucket: 'bucket',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    publicBaseUrl: 'https://public.example',
    prefix: 'admin-dev',
  });
  const url = new URL(await storage.presignPut({ key: 'admin-dev/quarantine/uploads/x/original' }));
  const names = [...url.searchParams.keys()].map((name) => name.toLowerCase());
  assert.ok(names.includes('x-amz-signature'));
  assert.deepEqual(names.filter((name) => name.includes('checksum')), []);
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'host');
});
