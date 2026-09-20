import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import '../server/load-local-env.mjs';
import * as schema from './schema/index.mjs';

let queryClient;
let db;

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DATABASE_URL is required for server-side database access.');
  }
  return value;
}

export function getDb() {
  if (!db) {
    queryClient = postgres(requireDatabaseUrl(), {
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
    });
    db = drizzle(queryClient, { schema });
  }
  return db;
}

export async function checkDatabaseHealth() {
  const rows = await getDb().execute(sql`select 1 as ok`);
  const firstRow = Array.isArray(rows) ? rows[0] : rows.rows?.[0];
  if (!firstRow || Number(firstRow.ok) !== 1) {
    throw new Error('Database health query returned an unexpected result.');
  }
  return { ok: true };
}

export async function closeDb() {
  if (queryClient) {
    await queryClient.end({ timeout: 5 });
    queryClient = undefined;
    db = undefined;
  }
}
