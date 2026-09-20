import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const databaseHealthHandler = require('../api/internal/db-health.js');

function createResponse() {
  return {
    body: undefined,
    code: undefined,
    headers: {},
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
  };
}

const secret = process.env.DB_HEALTHCHECK_SECRET;
assert.ok(secret, 'DB_HEALTHCHECK_SECRET is required for this test');

const unauthorizedResponse = createResponse();
await databaseHealthHandler(
  { headers: {}, method: 'GET' },
  unauthorizedResponse,
);
assert.equal(unauthorizedResponse.code, 401);
assert.deepEqual(unauthorizedResponse.body, { error: { code: 'UNAUTHORIZED' } });

const authorizedResponse = createResponse();
await databaseHealthHandler(
  { headers: { authorization: `Bearer ${secret}` }, method: 'GET' },
  authorizedResponse,
);
assert.equal(authorizedResponse.code, 200);
assert.deepEqual(authorizedResponse.body, { ok: true });

console.log('DB_HEALTH_ROUTE_TEST=PASS');
