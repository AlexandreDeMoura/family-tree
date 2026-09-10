import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { OrganizerAuthenticator } from './auth/auth.service.js';
import type { PeopleService } from './people/people.service.js';
import type { PhotosService } from './photos/photos.service.js';
import type { RelationshipsService } from './relationships/relationships.service.js';
import type { TreesService } from './trees/trees.service.js';
import {
  createPersonBodySchema,
  createPhotoUploadBodySchema,
  createTreeBodySchema,
  completePhotoUploadBodySchema,
  editPersonBodySchema,
  parentRelationshipBodySchema,
  parentRelationshipParamsSchema,
  parseRequest,
  partnershipBodySchema,
  partnershipParamsSchema,
  personParamsSchema,
  photoParamsSchema,
  treeParamsSchema,
} from './organizer.schemas.js';

export interface OrganizerApiDependencies {
  authenticator: OrganizerAuthenticator;
  trees: TreesService;
  people: PeopleService;
  relationships: RelationshipsService;
  photos?: PhotosService;
}

async function organizer(request: FastifyRequest, authenticator: OrganizerAuthenticator) {
  return authenticator.authenticate(request.headers.authorization);
}

export async function registerOrganizerRoutes(
  app: FastifyInstance,
  dependencies: OrganizerApiDependencies,
) {
  app.post('/trees', async (request, reply) => {
    const principal = await organizer(request, dependencies.authenticator);
    const body = parseRequest(createTreeBodySchema, request.body);
    const tree = await dependencies.trees.createTree(principal.userId, body);
    return reply.code(201).send({ tree });
  });

  app.get('/trees', async (request) => {
    const principal = await organizer(request, dependencies.authenticator);
    return { trees: await dependencies.trees.listTrees(principal.userId) };
  });

  app.get('/trees/:treeId', async (request) => {
    const principal = await organizer(request, dependencies.authenticator);
    const { treeId } = parseRequest(treeParamsSchema, request.params);
    return { tree: await dependencies.trees.loadTree(principal.userId, treeId) };
  });

  app.post('/trees/:treeId/people', async (request, reply) => {
    const principal = await organizer(request, dependencies.authenticator);
    const { treeId } = parseRequest(treeParamsSchema, request.params);
    const body = parseRequest(createPersonBodySchema, request.body);
    const person = await dependencies.people.createPerson(principal.userId, treeId, body);
    return reply.code(201).send({ person });
  });

  app.patch('/trees/:treeId/people/:personId', async (request) => {
    const principal = await organizer(request, dependencies.authenticator);
    const { treeId, personId } = parseRequest(personParamsSchema, request.params);
    const body = parseRequest(editPersonBodySchema, request.body);
    return { person: await dependencies.people.editPerson(principal.userId, treeId, personId, body) };
  });

  if (dependencies.photos) {
    app.get('/trees/:treeId/photos', async (request) => {
      const principal = await organizer(request, dependencies.authenticator);
      const { treeId } = parseRequest(treeParamsSchema, request.params);
      return { photos: await dependencies.photos!.listPhotos(principal.userId, treeId) };
    });

    app.post('/trees/:treeId/people/:personId/photos/uploads', async (request, reply) => {
      const principal = await organizer(request, dependencies.authenticator);
      const { treeId, personId } = parseRequest(personParamsSchema, request.params);
      parseRequest(createPhotoUploadBodySchema, request.body);
      const upload = await dependencies.photos!.createUpload(principal.userId, treeId, personId);
      return reply.code(201).send({ upload });
    });

    app.delete('/trees/:treeId/people/:personId/photos/uploads/:photoId', async (request, reply) => {
      const principal = await organizer(request, dependencies.authenticator);
      const { treeId, personId, photoId } = parseRequest(photoParamsSchema, request.params);
      await dependencies.photos!.cleanupUpload(principal.userId, treeId, personId, photoId);
      return reply.code(204).send();
    });

    app.post('/trees/:treeId/people/:personId/photos/:photoId/complete', async (request, reply) => {
      const principal = await organizer(request, dependencies.authenticator);
      const { treeId, personId, photoId } = parseRequest(photoParamsSchema, request.params);
      const body = parseRequest(completePhotoUploadBodySchema, request.body);
      const photo = await dependencies.photos!.completeUpload(
        principal.userId,
        treeId,
        personId,
        photoId,
        body,
      );
      return reply.code(201).send({ photo });
    });

    app.patch('/trees/:treeId/people/:personId/photos/:photoId/portrait', async (request) => {
      const principal = await organizer(request, dependencies.authenticator);
      const { treeId, personId, photoId } = parseRequest(photoParamsSchema, request.params);
      await dependencies.photos!.setMainPhoto(principal.userId, treeId, personId, photoId);
      return { photoId };
    });

    app.delete('/trees/:treeId/people/:personId/photos/:photoId', async (request, reply) => {
      const principal = await organizer(request, dependencies.authenticator);
      const { treeId, personId, photoId } = parseRequest(photoParamsSchema, request.params);
      await dependencies.photos!.deletePhoto(principal.userId, treeId, personId, photoId);
      return reply.code(204).send();
    });
  }

  app.post('/trees/:treeId/relationships/parents', async (request, reply) => {
    const principal = await organizer(request, dependencies.authenticator);
    const { treeId } = parseRequest(treeParamsSchema, request.params);
    const edge = parseRequest(parentRelationshipBodySchema, request.body);
    const graph = await dependencies.relationships.addParent(principal.userId, treeId, edge);
    return reply.code(201).send({ graph });
  });

  app.delete('/trees/:treeId/relationships/parents/:parentId/:childId', async (request) => {
    const principal = await organizer(request, dependencies.authenticator);
    const { treeId, parentId, childId } = parseRequest(parentRelationshipParamsSchema, request.params);
    return { graph: await dependencies.relationships.removeParent(
      principal.userId,
      treeId,
      { parentId, childId },
    ) };
  });

  app.post('/trees/:treeId/relationships/partners', async (request, reply) => {
    const principal = await organizer(request, dependencies.authenticator);
    const { treeId } = parseRequest(treeParamsSchema, request.params);
    const edge = parseRequest(partnershipBodySchema, request.body);
    const graph = await dependencies.relationships.addPartnership(principal.userId, treeId, edge);
    return reply.code(201).send({ graph });
  });

  app.delete('/trees/:treeId/relationships/partners/:person1Id/:person2Id', async (request) => {
    const principal = await organizer(request, dependencies.authenticator);
    const { treeId, person1Id, person2Id } = parseRequest(partnershipParamsSchema, request.params);
    return { graph: await dependencies.relationships.removePartnership(
      principal.userId,
      treeId,
      { person1Id, person2Id },
    ) };
  });
}
