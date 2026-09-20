import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const targetArgument = process.argv.find((argument) => argument.startsWith('--target='));
const target = targetArgument?.slice('--target='.length) || process.env.WHMX_MIGRATION_TARGET;
const databaseArgument = process.argv.find((argument) => argument.startsWith('--database='));
const requestedDatabase = databaseArgument?.slice('--database='.length);
const allowedTargets = new Set(['development', 'preview', 'production']);
if (!allowedTargets.has(target)) {
  throw new Error(
    'Migration target is required: use --target=development, --target=preview, or --target=production.',
  );
}

let connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
if (requestedDatabase) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(requestedDatabase)) {
    throw new Error('The optional --database value is not a valid PostgreSQL database name.');
  }
  const databaseUrl = new URL(connectionString);
  databaseUrl.pathname = `/${requestedDatabase}`;
  connectionString = databaseUrl.toString();
}

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  // Keep one executor for every environment. Drizzle owns migration ordering,
  // hash verification, journal writes, and transaction behavior.
  await migrate(drizzle(sql), { migrationsFolder: 'db/migrations' });
  console.log(`MIGRATION_CHAIN_OK target=${target}`);
} finally {
  await sql.end({ timeout: 5 });
}
