// server/admin-api-routes/tier-lists.mjs — Admin Tier List (routed by api/admin/[...].js).
import { withAdmin } from './lore.mjs';

const domain = () => import('../tier-lists/tier-list-admin.mjs');
const createBody = (z) => z.object({ slug: z.string().max(40), title: z.string().max(80), requestId: z.string().uuid().optional() });
const revision = (z) => z.object({ expectedRevision: z.coerce.number().int().positive(), requestId: z.string().uuid().optional() });
const saveBody = (z) => revision(z).extend({
  doc: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  position: z.number().int().min(0).optional(),
});

export const tierListIndex = (request, response) => withAdmin(request, response, ['GET', 'POST'], async ({ api, db, lore: d, z, user }) => {
  if (request.method === 'GET') return response.status(200).json({ lists: await d.listTierLists(db) });
  const body = createBody(z).parse(await api.requestBody(request));
  return response.status(201).json(await d.createTierList(db, { slug: body.slug, title: body.title, actorUserId: user.id, requestId: api.requestId(body) }));
}, domain);

export const tierList = (request, response) => withAdmin(request, response, ['GET', 'PATCH', 'DELETE'], async ({ api, db, lore: d, z, user }) => {
  const slug = request.query.slug;
  if (request.method === 'GET') return response.status(200).json(await d.getTierList(db, slug));
  const raw = await api.requestBody(request);
  if (request.method === 'DELETE') {
    const body = revision(z).parse(raw);
    return response.status(200).json(await d.deleteTierList(db, slug, { expectedRevision: body.expectedRevision, actorUserId: user.id, actorRole: user.role, requestId: api.requestId(body) }));
  }
  const body = saveBody(z).parse(raw);
  return response.status(200).json(await d.saveTierList(db, slug, { ...body, actorUserId: user.id, requestId: api.requestId(body) }));
}, domain);
