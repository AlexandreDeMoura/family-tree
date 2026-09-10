import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FamilyGraph, Person } from '@family-tree/family-core';
import { buildApp } from './app.js';
import { createOrganizerAuthenticator, type AuthVerifier } from './features/auth/auth.service.js';
import { createPeopleService } from './features/people/people.service.js';
import type { PeopleQueries } from './features/people/people.queries.js';
import { createTreesService } from './features/trees/trees.service.js';
import type { Queryable, TreeQueries, TreeSummary } from './features/trees/trees.queries.js';

const organizerId = randomUUID();
const otherUserId = randomUUID();
const bearer = { authorization: 'Bearer valid-token' };
const unusedDatabase = {} as pg.Pool;

class MemoryFamilyStore implements TreeQueries, PeopleQueries {
  readonly trees = new Map<string, TreeSummary & { organizerUserId: string }>();
  readonly graphs = new Map<string, FamilyGraph>();

  async createTree(_database: Queryable, organizerUserId: string, name: string) {
    const tree: TreeSummary = {
      id: randomUUID(),
      name,
      createdAt: '2026-09-10T12:00:00.000Z',
    };
    this.trees.set(tree.id, { ...tree, organizerUserId });
    this.graphs.set(tree.id, { treeId: tree.id, people: [], parentChild: [], partnerships: [] });
    return tree;
  }

  async findOwnedTree(_database: Queryable, treeId: string, organizerUserId: string) {
    const tree = this.trees.get(treeId);
    if (!tree || tree.organizerUserId !== organizerUserId) return null;
    const { organizerUserId: _owner, ...summary } = tree;
    return summary;
  }

  async loadGraph(_database: Queryable, treeId: string) {
    return structuredClone(this.graphs.get(treeId)!);
  }

  async insertPerson(_database: Queryable, person: Person) {
    this.graphs.get(person.treeId)!.people.push(structuredClone(person));
  }

  async updatePerson(_database: Queryable, person: Person) {
    const graph = this.graphs.get(person.treeId)!;
    graph.people = graph.people.map((current) => current.id === person.id
      ? structuredClone(person)
      : current);
  }

  addParent(treeId: string, parentId: string, childId: string) {
    this.graphs.get(treeId)!.parentChild.push({ parentId, childId });
  }
}

describe('organizer tree and person API', () => {
  let app: ReturnType<typeof buildApp>;
  let store: MemoryFamilyStore;
  let transactionTreeIds: string[];

  beforeEach(() => {
    store = new MemoryFamilyStore();
    transactionTreeIds = [];
    const verifier: AuthVerifier = {
      async verifyAccessToken(token) {
        if (token === 'valid-token') return { id: organizerId };
        if (token === 'other-token') return { id: otherUserId };
        return null;
      },
    };
    const transaction = async <T>(treeId: string, work: (database: Queryable) => Promise<T>) => {
      transactionTreeIds.push(treeId);
      return work(unusedDatabase);
    };
    app = buildApp({
      webOrigin: 'http://localhost:5173',
      organizerApi: {
        authenticator: createOrganizerAuthenticator(verifier, organizerId),
        trees: createTreesService(unusedDatabase, store, store),
        people: createPeopleService(unusedDatabase, {
          currentYear: () => 2026,
          treeQueries: store,
          peopleQueries: store,
          runInTreeTransaction: transaction,
        }),
      },
    });
  });

  afterEach(async () => app.close());

  async function createTree(name = 'The Martin Family') {
    const response = await app.inject({ method: 'POST', url: '/trees', headers: bearer, payload: { name } });
    expect(response.statusCode).toBe(201);
    return response.json().tree as TreeSummary;
  }

  async function createPerson(treeId: string, overrides: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: `/trees/${treeId}/people`,
      headers: bearer,
      payload: {
        firstName: 'Marie',
        lastName: 'Martin',
        lifeStatus: 'unknown',
        ...overrides,
      },
    });
  }

  it('creates an owned tree and loads its authoritative empty graph', async () => {
    const tree = await createTree('  The Martin Family  ');
    expect(tree).toMatchObject({ name: 'The Martin Family' });

    const response = await app.inject({ method: 'GET', url: `/trees/${tree.id}`, headers: bearer });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ tree: {
      ...tree,
      graph: { treeId: tree.id, people: [], parentChild: [], partnerships: [] },
    } });
  });

  it('creates people with explicit unknown/default values and completeness flags', async () => {
    const tree = await createTree();
    const response = await createPerson(tree.id, {
      birthYear: null,
      adopted: true,
      funFacts: ['  Played accordion by ear  '],
      childrenComplete: true,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().person).toMatchObject({
      treeId: tree.id,
      firstName: 'Marie',
      birthYear: null,
      deathYear: null,
      adopted: true,
      mainPhotoId: null,
      funFacts: ['Played accordion by ear'],
      parentsComplete: false,
      partnersComplete: false,
      childrenComplete: true,
    });
  });

  it('returns stable request and domain validation errors', async () => {
    const tree = await createTree();
    const malformed = await createPerson(tree.id, { firstName: '   ', unexpected: true });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error).toMatchObject({ code: 'invalid_request' });

    const invalidLife = await createPerson(tree.id, {
      lifeStatus: 'living',
      birthYear: 1980,
      deathYear: 2020,
    });
    expect(invalidLife.statusCode).toBe(422);
    expect(invalidLife.json().error).toMatchObject({
      code: 'living_death',
      message: 'A living person cannot have a death year.',
    });

    const invalidJson = await app.inject({
      method: 'POST',
      url: '/trees',
      headers: { ...bearer, 'content-type': 'application/json' },
      payload: '{',
    });
    expect(invalidJson.statusCode).toBe(400);
    expect(invalidJson.json().error.code).toBe('invalid_request');
  });

  it.each([
    [undefined, 'authentication_required'],
    ['Basic valid-token', 'authentication_required'],
    ['Bearer forged-token', 'invalid_access_token'],
  ])('rejects missing, malformed, and forged authentication: %s', async (authorization, code) => {
    const response = await app.inject({
      method: 'POST',
      url: '/trees',
      headers: authorization ? { authorization } : {},
      payload: { name: 'Denied' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe(code);
  });

  it('rejects an authenticated user who is not the configured organizer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/trees',
      headers: { authorization: 'Bearer other-token' },
      payload: { name: 'Denied' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('organizer_access_required');
  });

  it('hides trees owned by another user and rejects cross-tree person access', async () => {
    const foreign = await store.createTree(unusedDatabase, otherUserId, 'Other family');
    const own = await createTree();
    const person = (await createPerson(own.id)).json().person as Person;

    const foreignTree = await app.inject({ method: 'GET', url: `/trees/${foreign.id}`, headers: bearer });
    expect(foreignTree.statusCode).toBe(404);
    expect(foreignTree.json().error.code).toBe('tree_not_found');

    const crossTreeEdit = await app.inject({
      method: 'PATCH',
      url: `/trees/${foreign.id}/people/${person.id}`,
      headers: bearer,
      payload: { firstName: 'Moved' },
    });
    expect(crossTreeEdit.statusCode).toBe(404);
    expect(crossTreeEdit.json().error.code).toBe('tree_not_found');
  });

  it('runs person writes through the tree transaction and rejects edits that invalidate an existing edge', async () => {
    const tree = await createTree();
    const parent = (await createPerson(tree.id, { firstName: 'Jean', birthYear: 1970 })).json().person as Person;
    const child = (await createPerson(tree.id, { firstName: 'Sophie', birthYear: 2000 })).json().person as Person;
    store.addParent(tree.id, parent.id, child.id);

    const response = await app.inject({
      method: 'PATCH',
      url: `/trees/${tree.id}/people/${parent.id}`,
      headers: bearer,
      payload: { birthYear: 2010 },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'parent_younger_than_child',
    });
    expect(transactionTreeIds).toEqual([tree.id, tree.id, tree.id]);
    expect(store.graphs.get(tree.id)!.people.find(({ id }) => id === parent.id)!.birthYear).toBe(1970);
  });

  it('edits person fields while preserving identity and omitted values', async () => {
    const tree = await createTree();
    const created = (await createPerson(tree.id, { birthYear: 1952 })).json().person as Person;
    const response = await app.inject({
      method: 'PATCH',
      url: `/trees/${tree.id}/people/${created.id}`,
      headers: bearer,
      payload: { firstName: 'Anne', partnersComplete: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().person).toMatchObject({
      id: created.id,
      treeId: tree.id,
      firstName: 'Anne',
      lastName: 'Martin',
      birthYear: 1952,
      partnersComplete: true,
    });
  });
});
