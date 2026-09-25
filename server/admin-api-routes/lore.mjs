// server/admin-api-routes/lore.mjs
export async function lorePublish(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser }, { getDb }, { createLoreRepository }, storageModule, { publishLore }] = await Promise.all([
      import('../admin-api.mjs'), import('../../db/client.mjs'), import('../profile/lore-repository.mjs'),
      import('../profile/lore-storage.mjs'), import('../profile/lore-publisher.mjs'),
    ]);
    const user = await authenticatedUser(request, { requireOrigin: request.method !== 'GET' });
    const repo = createLoreRepository(getDb());
    if (request.method === 'GET') {
      const state = await repo.readState(getDb());
      const hasUnpublishedChanges = Boolean(state?.lastEditAt && (!state.publishedAt || state.lastEditAt > state.publishedAt));
      return response.status(200).json({ state, hasUnpublishedChanges });
    }
    const storage = storageModule.createLoreStorage(storageModule.loadLoreStorageConfig());
    const result = await publishLore({ repo, storage, actorUserId: user.id });
    return response.status(result.status === 'busy' ? 409 : 200).json(result);
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}

const textsBody = (z) => z.object({ expectedRevision: z.coerce.number().int().positive(), texts: z.record(z.string(), z.string().max(20_000).nullable()), requestId: z.string().uuid().optional() });
const termBody = (z) => z.object({ expectedRevision: z.coerce.number().int().positive(), nameVi: z.string().max(500).nullable(), detailVi: z.string().max(20_000).nullable(), requestId: z.string().uuid().optional() });

async function withAdmin(request, response, methods, handle) {
  if (!methods.includes(request.method)) {
    response.setHeader('Allow', methods.join(', '));
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [api, { getDb }, lore, { z }] = await Promise.all([import('../admin-api.mjs'), import('../../db/client.mjs'), import('../profile/lore-admin.mjs'), import('zod')]);
    const user = await api.authenticatedUser(request, { requireOrigin: request.method !== 'GET' });
    return await handle({ api, db: getDb(), lore, z, user });
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}

export const loreCharacter = (request, response) => withAdmin(request, response, ['GET', 'PATCH'], async ({ api, db, lore, z, user }) => {
  const id = request.query.characterId;
  if (request.method === 'GET') return response.status(200).json(await lore.getLoreRecord(db, id));
  const body = textsBody(z).parse(await api.requestBody(request));
  return response.status(200).json(await lore.saveLoreTexts(db, id, { ...body, actorUserId: user.id, requestId: api.requestId(body) }));
});
export const loreTerms = (request, response) => withAdmin(request, response, ['GET'], async ({ db, lore }) =>
  response.status(200).json({ terms: await lore.listLoreTerms(db) }));
export const loreTerm = (request, response) => withAdmin(request, response, ['PATCH'], async ({ api, db, lore, z, user }) => {
  const body = termBody(z).parse(await api.requestBody(request));
  return response.status(200).json(await lore.saveLoreTerm(db, request.query.code, { ...body, actorUserId: user.id, requestId: api.requestId(body) }));
});
export const loreProgress = (request, response) => withAdmin(request, response, ['GET'], async ({ db, lore }) =>
  response.status(200).json({ progress: await lore.getLoreProgress(db) }));
