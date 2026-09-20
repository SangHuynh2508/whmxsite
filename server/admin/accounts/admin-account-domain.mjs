import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../../../db/client.mjs';
import { adminAccountAudits, sessions, users } from '../../../db/schema/auth.mjs';
import { internalAuthHeaders, provisioningAuth } from '../../auth.mjs';

const roleSchema = z.enum(['owner', 'editor']);
const accountInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  role: roleSchema.default('editor'),
  requestId: z.string().uuid().nullable().optional(),
});

const provisionInput = accountInput.extend({ actorUserId: z.string().uuid() });
const bootstrapInput = accountInput.omit({ requestId: true }).extend({ requestId: z.string().uuid().nullable().optional() });
const updateInput = z
  .object({
    actorUserId: z.string().uuid(),
    subjectUserId: z.string().uuid(),
    role: roleSchema.optional(),
    status: z.enum(['active', 'disabled']).optional(),
    requestId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, 'an account change is required');

export class AdminAccountDomainError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'AdminAccountDomainError';
    this.code = code;
    this.status = status;
  }
}

function domainError(code, status) {
  throw new AdminAccountDomainError(code, status);
}

function safeAccount(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    disabledAt: user.disabledAt,
    disabledByUserId: user.disabledByUserId,
  };
}

async function activeOwnerActor(tx, actorUserId) {
  const [actor] = await tx
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, actorUserId));
  if (!actor || actor.status !== 'active') domainError('UNAUTHORIZED', 401);
  if (actor.role !== 'owner') domainError('FORBIDDEN', 403);
  return actor;
}

async function writeAudit(tx, { action, actorUserId = null, subjectUserId, oldValue = null, newValue, requestId = null }) {
  await tx.insert(adminAccountAudits).values({
    action,
    actorUserId,
    subjectUserId,
    oldValue,
    newValue,
    requestId,
  });
}

async function createCredentialUser({ name, email, password }) {
  let created;
  try {
    // This private Better Auth instance has no HTTP handler. Its only purpose
    // is applying Better Auth's normal password policy and hash implementation.
    created = await provisioningAuth.api.signUpEmail({
      body: { name, email, password },
      headers: internalAuthHeaders(),
    });
  } catch {
    domainError('ACCOUNT_PROVISIONING_FAILED', 400);
  }

  const createdId = created?.user?.id;
  if (!createdId) domainError('ACCOUNT_PROVISIONING_FAILED', 400);

  // With Better Auth 1.7.5 and autoSignIn disabled, an existing email returns
  // a synthetic user response (to avoid email enumeration) instead of an
  // exception. Its generated ID does not exist in our database. Verify that
  // the returned ID is the persisted credential user before applying roles.
  const db = getDb();
  const [persisted] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, createdId));
  if (persisted?.email === email) return { user: persisted };

  if (await existingEmail(db, email)) domainError('DUPLICATE_EMAIL', 409);
  domainError('ACCOUNT_PROVISIONING_FAILED', 400);
}

async function existingEmail(tx, email) {
  const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
  return user;
}

export async function listAdminAccounts(actorUserId) {
  const db = getDb();
  await db.transaction((tx) => activeOwnerActor(tx, actorUserId));
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      disabledAt: users.disabledAt,
      disabledByUserId: users.disabledByUserId,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
  return rows.map(safeAccount);
}

export async function provisionAdminAccount(rawInput) {
  const input = provisionInput.parse(rawInput);
  const db = getDb();
  await db.transaction(async (tx) => {
    await activeOwnerActor(tx, input.actorUserId);
    if (await existingEmail(tx, input.email)) domainError('DUPLICATE_EMAIL', 409);
  });

  const created = await createCredentialUser(input);
  const createdId = created?.user?.id;
  if (!createdId) domainError('ACCOUNT_PROVISIONING_FAILED', 400);
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({ role: input.role, status: 'active', updatedAt: new Date() })
        .where(eq(users.id, createdId))
        .returning();
      if (!user) domainError('ACCOUNT_PROVISIONING_FAILED', 400);
      await writeAudit(tx, {
        action: 'provisioned',
        actorUserId: input.actorUserId,
        subjectUserId: user.id,
        newValue: { role: user.role, status: user.status },
        requestId: input.requestId ?? null,
      });
      return safeAccount(user);
    });
  } catch (error) {
    // Do not leave a credential row without its provision/audit completion.
    await db.delete(users).where(eq(users.id, createdId)).catch(() => undefined);
    throw error;
  }
}

export async function bootstrapFirstOwner(rawInput) {
  const input = bootstrapInput.parse(rawInput);
  const db = getDb();
  const owners = await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner')).limit(1);
  if (owners.length) domainError('OWNER_ALREADY_EXISTS', 409);
  if (await existingEmail(db, input.email)) domainError('DUPLICATE_EMAIL', 409);

  const created = await createCredentialUser(input);
  const createdId = created?.user?.id;
  if (!createdId) domainError('ACCOUNT_PROVISIONING_FAILED', 400);
  try {
    return await db.transaction(async (tx) => {
      const existingOwners = await tx.execute(sql`
        select id from users where role = 'owner' for update
      `);
      if (existingOwners.length) domainError('OWNER_ALREADY_EXISTS', 409);
      const [user] = await tx
        .update(users)
        .set({ role: 'owner', status: 'active', updatedAt: new Date() })
        .where(eq(users.id, createdId))
        .returning();
      if (!user) domainError('ACCOUNT_PROVISIONING_FAILED', 400);
      await writeAudit(tx, {
        action: 'bootstrap_owner',
        subjectUserId: user.id,
        newValue: { role: user.role, status: user.status },
        requestId: input.requestId ?? null,
      });
      return safeAccount(user);
    });
  } catch (error) {
    await db.delete(users).where(eq(users.id, createdId)).catch(() => undefined);
    throw error;
  }
}

async function lockActiveOwners(tx) {
  return tx.execute(sql`select id from users where role = 'owner' and status = 'active' for update`);
}

export async function updateAdminAccount(rawInput) {
  const input = updateInput.parse(rawInput);
  const db = getDb();
  return db.transaction(async (tx) => {
    const actor = await activeOwnerActor(tx, input.actorUserId);
    const [subject] = await tx.select().from(users).where(eq(users.id, input.subjectUserId));
    if (!subject) domainError('NOT_FOUND', 404);

    const nextRole = input.role ?? subject.role;
    const nextStatus = input.status ?? subject.status;
    if (nextRole === subject.role && nextStatus === subject.status) return safeAccount(subject);

    if (subject.role === 'owner' && subject.status === 'active' && (nextRole !== 'owner' || nextStatus !== 'active')) {
      const activeOwners = await lockActiveOwners(tx);
      if (activeOwners.length <= 1) domainError('LAST_ACTIVE_OWNER_PROTECTED', 409);
    }

    const now = new Date();
    const [updated] = await tx
      .update(users)
      .set({
        role: nextRole,
        status: nextStatus,
        disabledAt: nextStatus === 'disabled' ? now : null,
        disabledByUserId: nextStatus === 'disabled' ? actor.id : null,
        updatedAt: now,
      })
      .where(eq(users.id, subject.id))
      .returning();
    if (nextStatus === 'disabled') {
      await tx.delete(sessions).where(eq(sessions.userId, subject.id));
    }
    await writeAudit(tx, {
      action: nextStatus === 'disabled' ? 'disabled' : subject.status === 'disabled' ? 'enabled' : 'role_changed',
      actorUserId: actor.id,
      subjectUserId: updated.id,
      oldValue: { role: subject.role, status: subject.status },
      newValue: { role: updated.role, status: updated.status },
      requestId: input.requestId ?? null,
    });
    return safeAccount(updated);
  });
}
