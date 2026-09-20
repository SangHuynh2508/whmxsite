module.exports = async function finalizeUploadHandler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { createR2ManagedAssetStorage }, { finalizeManagedAssetUpload }] = await Promise.all([
      import('../../../../server/admin-api.mjs'),
      import('../../../../server/assets/r2-managed-assets.mjs'),
      import('../../../../server/assets/managed-asset-domain.mjs'),
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
    const { sendAdminError } = await import('../../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
