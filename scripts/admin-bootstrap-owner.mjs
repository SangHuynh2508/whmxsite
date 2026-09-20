import { randomUUID } from 'node:crypto';

const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim();
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

if (!name || !email || !password) {
  console.error('OWNER_BOOTSTRAP_INPUT_REQUIRED');
  process.exitCode = 1;
} else {
  try {
    const { bootstrapFirstOwner } = await import('../server/admin-account-domain.mjs');
    await bootstrapFirstOwner({ name, email, password, requestId: randomUUID() });
    // Do not emit identity, password, session, account, or database details.
    console.log('OWNER_BOOTSTRAP_COMPLETED');
  } catch (error) {
    const code = error?.code;
    console.error(code === 'OWNER_ALREADY_EXISTS' ? 'OWNER_BOOTSTRAP_REFUSED' : 'OWNER_BOOTSTRAP_FAILED');
    process.exitCode = 1;
  } finally {
    // The CLI is a one-shot command. Closing the pooled client lets it exit
    // promptly without changing the coarse, operator-safe result above.
    const { closeDb } = await import('../db/client.mjs');
    await closeDb().catch(() => undefined);
  }
}
