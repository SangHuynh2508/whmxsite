import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';

const databaseArgument = process.argv.find((argument) => argument.startsWith('--database='));
const requestedDatabase = databaseArgument?.slice('--database='.length);
if (!requestedDatabase || !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(requestedDatabase)) {
  throw new Error('A valid disposable --database value is required.');
}
let connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
const databaseUrl = new URL(connectionString);
databaseUrl.pathname = `/${requestedDatabase}`;
connectionString = databaseUrl.toString();

const client = postgres(connectionString, { max: 1, prepare: false });
const db = drizzle(client);
try {
  await migrate(db, { migrationsFolder: 'db/migrations' });
  const expectedMigrations = readMigrationFiles({ migrationsFolder: 'db/migrations' });
  const rows = await client.unsafe('select count(*)::int as count from drizzle.__drizzle_migrations');
  if (Number(rows[0]?.count) !== expectedMigrations.length) {
    throw new Error('Normal Drizzle replay did not record the complete migration chain.');
  }
  const version = await client.unsafe('select version() as version');
  console.log(JSON.stringify({
    status: 'PASS',
    normalDrizzleReplay: 'SUCCEEDED',
    migrationCount: Number(rows[0].count),
    postgresVersion: version[0]?.version,
    reason: 'Neon PostgreSQL accepts the enum addition and later preview_character usage in the Drizzle transaction.',
  }));
} finally {
  await client.end({ timeout: 5 });
}
