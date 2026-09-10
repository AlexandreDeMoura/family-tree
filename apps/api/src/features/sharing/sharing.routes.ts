import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError } from '../../lib/api-errors.js';
import type { OrganizerAuthenticator } from '../auth/auth.service.js';
import { parseRequest, treeParamsSchema } from '../organizer.schemas.js';
import type { SharingService } from './sharing.service.js';

export interface SharingApiDependencies {
  authenticator: OrganizerAuthenticator;
  sharing: SharingService;
}

function shareToken(request: FastifyRequest) {
  const match = /^Share ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization ?? '');
  if (!request.headers.authorization) {
    throw new ApiError(401, 'share_link_required', 'A private family link is required.');
  }
  if (!match) {
    throw new ApiError(404, 'invalid_share_link', 'This private family link is invalid or has been replaced.');
  }
  return match[1];
}

function protectPrivateView(reply: { header(name: string, value: string): unknown }) {
  reply.header('Cache-Control', 'private, no-store');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

export async function registerSharingRoutes(
  app: FastifyInstance,
  dependencies: SharingApiDependencies,
) {
  app.get('/trees/:treeId/share-link', async (request) => {
    const principal = await dependencies.authenticator.authenticate(request.headers.authorization);
    const { treeId } = parseRequest(treeParamsSchema, request.params);
    return { shareLink: await dependencies.sharing.getStatus(principal.userId, treeId) };
  });

  app.put('/trees/:treeId/share-link', async (request, reply) => {
    const principal = await dependencies.authenticator.authenticate(request.headers.authorization);
    const { treeId } = parseRequest(treeParamsSchema, request.params);
    return reply.send({ shareLink: await dependencies.sharing.replaceLink(principal.userId, treeId) });
  });

  app.get('/viewer/trees/:treeId', async (request, reply) => {
    protectPrivateView(reply);
    const { treeId } = parseRequest(treeParamsSchema, request.params);
    return { tree: await dependencies.sharing.loadSharedTree(treeId, shareToken(request)) };
  });

  app.get('/viewer/trees/:treeId/photos', async (request, reply) => {
    protectPrivateView(reply);
    const { treeId } = parseRequest(treeParamsSchema, request.params);
    return { photos: await dependencies.sharing.listSharedPhotos(treeId, shareToken(request)) };
  });
}

