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
