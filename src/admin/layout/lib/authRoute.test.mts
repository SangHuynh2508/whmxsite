import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authRedirect } from './authRoute.mts';

test('signed-out visitors see #/login, never an admin hash; signed-in users leave #/login', () => {
  assert.equal(authRedirect('#/admin/characters/A0001', false), '#/login');
  assert.equal(authRedirect('#/admin', false), '#/login');
  assert.equal(authRedirect('#/login', false), null);
  assert.equal(authRedirect('#/login', true, '#/admin/characters/A0001'), '#/admin/characters/A0001');
  assert.equal(authRedirect('#/login', true), '#/admin');
  assert.equal(authRedirect('#/admin/accounts', true), null);
});
