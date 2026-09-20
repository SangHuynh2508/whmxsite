import { defineConfig } from 'drizzle-kit';

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  'postgresql://migration_generate_placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.mjs',
  out: './db/migrations',
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
});
