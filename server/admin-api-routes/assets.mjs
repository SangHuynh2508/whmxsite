export async function uploadIntent(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { createR2ManagedAssetStorage }, { issueManagedAssetUploadIntent }] = await Promise.all([
      import('../admin-api.mjs'),
      import('../assets/r2-managed-assets.mjs'),
      import('../assets/managed-asset-domain.mjs'),
    ]);
    const user = await authenticatedUser(request);
    const body = await requestBody(request);
    const storage = createR2ManagedAssetStorage();
    const result = await issueManagedAssetUploadIntent(storage, {
      ...body,
      actorUserId: user.id,
      requestId: requestId(body),
    });
    return response.status(201).json({
      id: result.id,
      uploadUrl: result.uploadUrl,
      expiresAt: result.expiresAt,
      maxBytes: result.maxBytes,
      allowedMimeTypes: result.allowedMimeTypes,
    });
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}

export async function finalizeUpload(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { createR2ManagedAssetStorage }, { finalizeManagedAssetUpload }] = await Promise.all([
      import('../admin-api.mjs'),
      import('../assets/r2-managed-assets.mjs'),
      import('../assets/managed-asset-domain.mjs'),
    ]);
    const user = await authenticatedUser(request);
    const body = await requestBody(request);
    const intentId = request.query?.id;
    if (typeof intentId !== 'string') return response.status(400).json({ error: { code: 'INVALID_INTENT_ID' } });
    const result = await finalizeManagedAssetUpload(createR2ManagedAssetStorage(), {
      actorUserId: user.id,
      requestId: requestId(body),
      intentId,
      acknowledgePublicPlaceholder: Boolean(body.acknowledgePublicPlaceholder),
    });
    return response.status(200).json(result);
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}
