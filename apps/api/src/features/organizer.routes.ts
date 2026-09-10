import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { OrganizerAuthenticator } from './auth/auth.service.js';
import type { PeopleService } from './people/people.service.js';
import type { TreesService } from './trees/trees.service.js';
import {
  createPersonBodySchema,
  createTreeBodySchema,
  editPersonBodySchema,
  parseRequest,
  personParamsSchema,
  treeParamsSchema,
} from './organizer.schemas.js';

export interface OrganizerApiDependencies {
  authenticator: OrganizerAuthenticator;
  trees: TreesService;
  people: PeopleService;
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
}
