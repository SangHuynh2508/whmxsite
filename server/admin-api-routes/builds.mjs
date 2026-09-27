// server/admin-api-routes/builds.mjs — Build module + game-text translation (routed by api/admin/[...].js).
import { withAdmin } from './lore.mjs';

const builds = () => import('../builds/build-admin.mjs');
const gameTexts = () => import('../game/game-text-admin.mjs');
const docBody = (z) => z.object({ doc: z.record(z.string(), z.unknown()), requestId: z.string().uuid().optional() });
const revisionBody = (z) => z.object({ expectedRevision: z.coerce.number().int().positive(), requestId: z.string().uuid().optional() });

// GET: the character's builds + the game data to pick from; POST { doc }: a new build.
export const characterBuilds = (request, response) => withAdmin(request, response, ['GET', 'POST'], async ({ api, db, lore: domain, z, user }) => {
  const id = request.query.characterId;
  if (request.method === 'GET') return response.status(200).json(await domain.getBuildEditor(db, id));
  const body = docBody(z).parse(await api.requestBody(request));
  return response.status(201).json(await domain.createBuild(db, id, { doc: body.doc, actorUserId: user.id, requestId: api.requestId(body) }));
}, builds);

// PATCH { expectedRevision, doc }: save; DELETE { expectedRevision }: remove.
export const build = (request, response) => withAdmin(request, response, ['PATCH', 'DELETE'], async ({ api, db, lore: domain, z, user }) => {
  const id = request.query.buildId;
  const raw = await api.requestBody(request);
  if (request.method === 'DELETE') {
    const body = revisionBody(z).parse(raw);
    return response.status(200).json(await domain.deleteBuild(db, id, { expectedRevision: body.expectedRevision, actorUserId: user.id, requestId: api.requestId(body) }));
  }
  const body = revisionBody(z).merge(docBody(z)).parse(raw);
  return response.status(200).json(await domain.saveBuild(db, id, { expectedRevision: body.expectedRevision, doc: body.doc, actorUserId: user.id, requestId: api.requestId(body) }));
}, builds);

const textBody = (z) => z.object({ expectedRevision: z.coerce.number().int().positive(), nameVi: z.string().max(500).nullable(), detailVi: z.string().max(20_000).nullable(), requestId: z.string().uuid().optional() });

export const gameTextList = (request, response) => withAdmin(request, response, ['GET'], async ({ db, lore: domain }) =>
  response.status(200).json({ texts: await domain.listGameTexts(db) }), gameTexts);

export const gameText = (request, response) => withAdmin(request, response, ['PATCH'], async ({ api, db, lore: domain, z, user }) => {
  const body = textBody(z).parse(await api.requestBody(request));
  return response.status(200).json(await domain.saveGameText(db, request.query.kind, request.query.code, { ...body, actorUserId: user.id, requestId: api.requestId(body) }));
}, gameTexts);
