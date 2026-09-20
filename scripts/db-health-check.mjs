import { checkDatabaseHealth, closeDb } from '../db/client.mjs';

try {
  await checkDatabaseHealth();
  console.log('DB_HEALTH_CHECK=PASS');
} finally {
  await closeDb();
}
