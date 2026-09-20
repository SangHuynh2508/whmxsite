module.exports = async function uploadIntentHandler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { createR2ManagedAssetStorage }, { issueManagedAssetUploadIntent }] = await Promise.all([
      import('../../../server/admin-api.mjs'),
      import('../../../server/r2-managed-assets.mjs'),
      import('../../../server/managed-asset-domain.mjs'),
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
    const { sendAdminError } = await import('../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
