import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FamilyGraph, Person } from '@family-tree/family-core';
import { buildApp } from './app.js';
import { createOrganizerAuthenticator, type AuthVerifier } from './features/auth/auth.service.js';
import { createPeopleService } from './features/people/people.service.js';
import type { PeopleQueries } from './features/people/people.queries.js';
import type { RelationshipQueries } from './features/relationships/relationships.queries.js';
import { createRelationshipsService } from './features/relationships/relationships.service.js';
import { createTreesService } from './features/trees/trees.service.js';
import type { Queryable, TreeQueries, TreeSummary } from './features/trees/trees.queries.js';

const organizerId = randomUUID();
const otherUserId = randomUUID();
const bearer = { authorization: 'Bearer valid-token' };
const unusedDatabase = {} as pg.Pool;

class MemoryFamilyStore implements TreeQueries, PeopleQueries, RelationshipQueries {
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

  async insertParent(_database: Queryable, treeId: string, edge: FamilyGraph['parentChild'][number]) {
    this.graphs.get(treeId)!.parentChild.push(structuredClone(edge));
  }

  async deleteParent(_database: Queryable, treeId: string, edge: FamilyGraph['parentChild'][number]) {
    const graph = this.graphs.get(treeId)!;
    const before = graph.parentChild.length;
    graph.parentChild = graph.parentChild.filter((candidate) =>
      candidate.parentId !== edge.parentId || candidate.childId !== edge.childId);
    return graph.parentChild.length < before;
  }

  async insertPartnership(_database: Queryable, treeId: string, edge: FamilyGraph['partnerships'][number]) {
    this.graphs.get(treeId)!.partnerships.push(structuredClone(edge));
  }

  async deletePartnership(_database: Queryable, treeId: string, edge: FamilyGraph['partnerships'][number]) {
    const graph = this.graphs.get(treeId)!;
    const before = graph.partnerships.length;
    graph.partnerships = graph.partnerships.filter((candidate) =>
      candidate.person1Id !== edge.person1Id || candidate.person2Id !== edge.person2Id);
    return graph.partnerships.length < before;
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
        relationships: createRelationshipsService(unusedDatabase, {
          currentYear: () => 2026,
          treeQueries: store,
          peopleQueries: store,
          relationshipQueries: store,
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

  it('adds and removes parents without inferring a partnership', async () => {
    const tree = await createTree();
    const parent = (await createPerson(tree.id, {
      firstName: 'Parent', birthYear: 1970, parentsComplete: true,
    })).json().person as Person;
    const child = (await createPerson(tree.id, {
      firstName: 'Child', birthYear: 2000, parentsComplete: false,
    })).json().person as Person;

    const added = await app.inject({
      method: 'POST', url: `/trees/${tree.id}/relationships/parents`, headers: bearer,
      payload: { parentId: parent.id, childId: child.id },
    });
    expect(added.statusCode).toBe(201);
    expect(added.json().graph).toMatchObject({
      treeId: tree.id,
      parentChild: [{ parentId: parent.id, childId: child.id }],
      partnerships: [],
    });
    expect(added.json().graph.people.find(({ id }: Person) => id === child.id).parentsComplete)
      .toBe(false);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/trees/${tree.id}/relationships/parents/${parent.id}/${child.id}`,
      headers: bearer,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().graph.parentChild).toEqual([]);
  });

  it('supports multiple partners, canonical pairs, and reverse-order removal without inferring parents', async () => {
    const tree = await createTree();
    const first = (await createPerson(tree.id, { firstName: 'First' })).json().person as Person;
    const second = (await createPerson(tree.id, { firstName: 'Second' })).json().person as Person;
    const third = (await createPerson(tree.id, { firstName: 'Third' })).json().person as Person;

    for (const partnerId of [second.id, third.id]) {
      const response = await app.inject({
        method: 'POST', url: `/trees/${tree.id}/relationships/partners`, headers: bearer,
        payload: { person1Id: partnerId, person2Id: first.id },
      });
      expect(response.statusCode).toBe(201);
    }
    const graph = store.graphs.get(tree.id)!;
    expect(graph.partnerships).toHaveLength(2);
    expect(graph.partnerships.every(({ person1Id, person2Id }) => person1Id < person2Id)).toBe(true);
    expect(graph.parentChild).toEqual([]);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/trees/${tree.id}/relationships/partners/${first.id}/${second.id}`,
      headers: bearer,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().graph.partnerships).toHaveLength(1);
  });

  it('rejects invalid parent mutations and leaves the authoritative graph unchanged', async () => {
    const tree = await createTree();
    const older = (await createPerson(tree.id, { firstName: 'Older', birthYear: 1950 })).json().person as Person;
    const middle = (await createPerson(tree.id, { firstName: 'Middle', birthYear: 1975 })).json().person as Person;
    const younger = (await createPerson(tree.id, { firstName: 'Younger', birthYear: 2000 })).json().person as Person;
    const fourth = (await createPerson(tree.id, { firstName: 'Fourth', birthYear: 1960 })).json().person as Person;

    for (const parentId of [older.id, middle.id]) {
      const response = await app.inject({
        method: 'POST', url: `/trees/${tree.id}/relationships/parents`, headers: bearer,
        payload: { parentId, childId: younger.id },
      });
      expect(response.statusCode).toBe(201);
    }
    const before = structuredClone(store.graphs.get(tree.id));
    const thirdParent = await app.inject({
      method: 'POST', url: `/trees/${tree.id}/relationships/parents`, headers: bearer,
      payload: { parentId: fourth.id, childId: younger.id },
    });
    expect(thirdParent.statusCode).toBe(422);
    expect(thirdParent.json().error).toMatchObject({
      code: 'too_many_parents',
      message: 'A person can have at most two parents.',
    });

    const cycle = await app.inject({
      method: 'POST', url: `/trees/${tree.id}/relationships/parents`, headers: bearer,
      payload: { parentId: younger.id, childId: older.id },
    });
    expect(cycle.statusCode).toBe(422);
    expect(cycle.json().error.code).toBe('parent_younger_than_child');
    expect(cycle.json().error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ancestry_cycle' }),
    ]));
    expect(store.graphs.get(tree.id)).toEqual(before);
  });

  it('returns actionable duplicate, missing relationship, ownership, and request errors', async () => {
    const tree = await createTree();
    const first = (await createPerson(tree.id)).json().person as Person;
    const second = (await createPerson(tree.id)).json().person as Person;
    await app.inject({
      method: 'POST', url: `/trees/${tree.id}/relationships/partners`, headers: bearer,
      payload: { person1Id: first.id, person2Id: second.id },
    });
    const duplicate = await app.inject({
      method: 'POST', url: `/trees/${tree.id}/relationships/partners`, headers: bearer,
      payload: { person1Id: second.id, person2Id: first.id },
    });
    expect(duplicate.statusCode).toBe(422);
    expect(duplicate.json().error).toMatchObject({
      code: 'duplicate_partnership', message: 'This partnership already exists.',
    });

    const missing = await app.inject({
      method: 'DELETE',
      url: `/trees/${tree.id}/relationships/parents/${first.id}/${second.id}`,
      headers: bearer,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error).toMatchObject({
      code: 'parent_relationship_not_found',
      message: 'Parent relationship not found in this tree.',
    });

    const missingPartner = await app.inject({
      method: 'DELETE',
      url: `/trees/${tree.id}/relationships/partners/${first.id}/${randomUUID()}`,
      headers: bearer,
    });
    expect(missingPartner.statusCode).toBe(404);
    expect(missingPartner.json().error).toMatchObject({
      code: 'partnership_not_found',
      message: 'Partnership not found in this tree.',
    });

    const malformed = await app.inject({
      method: 'POST', url: `/trees/${tree.id}/relationships/parents`, headers: bearer,
      payload: { parentId: first.id, childId: 'not-a-uuid', unexpected: true },
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe('invalid_request');

    const foreign = await store.createTree(unusedDatabase, otherUserId, 'Other family');
    const denied = await app.inject({
      method: 'POST', url: `/trees/${foreign.id}/relationships/parents`, headers: bearer,
      payload: { parentId: first.id, childId: second.id },
    });
    expect(denied.statusCode).toBe(404);
    expect(denied.json().error.code).toBe('tree_not_found');
  });
});
