import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FamilyGraph } from '@family-tree/family-core';
import { buildApp } from './app.js';
import { createOrganizerAuthenticator } from './features/auth/auth.service.js';
import type { PeopleQueries } from './features/people/people.queries.js';
import type { NewPhotoRecord, PhotoQueries, PhotoRecord } from './features/photos/photos.queries.js';
import type { PeopleService } from './features/people/people.service.js';
import type { RelationshipsService } from './features/relationships/relationships.service.js';
import type { ShareLinkStatus, SharingQueries } from './features/sharing/sharing.queries.js';
import { createSharingService, hashShareToken } from './features/sharing/sharing.service.js';
import type { TreesService } from './features/trees/trees.service.js';
import type { Queryable, TreeSummary } from './features/trees/trees.queries.js';
import type { PhotoStorage } from './lib/photo-storage.js';

const organizerId = randomUUID();
const otherOwnerId = randomUUID();
const ownTreeId = randomUUID();
const otherTreeId = randomUUID();
const personId = randomUUID();
const photoId = randomUUID();
const firstToken = 'a'.repeat(43);
const secondToken = 'b'.repeat(43);
const unusedDatabase = {} as pg.Pool;

class MemorySharingStore implements SharingQueries, PeopleQueries, PhotoQueries {
  readonly trees = new Map<string, TreeSummary & { organizerUserId: string }>([
    [ownTreeId, { id: ownTreeId, name: 'Martin family', createdAt: '2026-09-10T12:00:00.000Z', organizerUserId: organizerId }],
    [otherTreeId, { id: otherTreeId, name: 'Other family', createdAt: '2026-09-10T12:00:00.000Z', organizerUserId: otherOwnerId }],
  ]);
  readonly hashes = new Map<string, { hash: string; createdAt: string }>();
  readonly graph: FamilyGraph = {
    treeId: ownTreeId,
    people: [{
      id: personId,
      treeId: ownTreeId,
      firstName: 'Marie',
      lastName: 'Martin',
      lifeStatus: 'living',
      birthYear: 1980,
      deathYear: null,
      adopted: false,
      mainPhotoId: photoId,
      funFacts: ['Plays accordion'],
      parentsComplete: false,
      partnersComplete: false,
      childrenComplete: false,
    }],
    parentChild: [],
    partnerships: [],
  };

  async findStatusForOwner(_database: Queryable, treeId: string, userId: string) {
    const tree = this.trees.get(treeId);
    if (!tree || tree.organizerUserId !== userId) return null;
    const link = this.hashes.get(treeId);
    return { active: Boolean(link), createdAt: link?.createdAt ?? null };
  }

  async replaceForOwner(_database: Queryable, treeId: string, userId: string, tokenHash: string) {
    const tree = this.trees.get(treeId);
    if (!tree || tree.organizerUserId !== userId) return null;
    const createdAt = tokenHash === hashShareToken(firstToken)
      ? '2026-09-10T12:00:00.000Z'
      : '2026-09-10T12:01:00.000Z';
    this.hashes.set(treeId, { hash: tokenHash, createdAt });
    return { active: true, createdAt } satisfies ShareLinkStatus;
  }

  async resolveTree(_database: Queryable, treeId: string, tokenHash: string) {
    const link = this.hashes.get(treeId);
    const tree = this.trees.get(treeId);
    if (!link || !tree || link.hash !== tokenHash) return null;
    const { organizerUserId: _owner, ...summary } = tree;
    return summary;
  }

  async loadGraph(_database: Queryable, treeId: string) {
    if (treeId === ownTreeId) return structuredClone(this.graph);
    return { treeId, people: [], parentChild: [], partnerships: [] };
  }

  async insertPerson(): Promise<void> { throw new Error('unused'); }
  async updatePerson(): Promise<void> { throw new Error('unused'); }
  async personExists(): Promise<boolean> { throw new Error('unused'); }
  async findPhoto(): Promise<PhotoRecord | null> { throw new Error('unused'); }
  async insertPhoto(_database: Queryable, _photo: NewPhotoRecord): Promise<PhotoRecord> { throw new Error('unused'); }
  async setMainPhoto(): Promise<boolean> { throw new Error('unused'); }
  async deletePhoto(): Promise<boolean> { throw new Error('unused'); }
  async listTreePhotos(_database: Queryable, treeId: string): Promise<PhotoRecord[]> {
    if (treeId !== ownTreeId) return [];
    return [{
      id: photoId,
      treeId,
      personId,
      storagePath: `trees/${treeId}/people/${personId}/${photoId}.jpg`,
      ageBucket: '20s',
      createdAt: '2026-09-10T12:00:00.000Z',
      isMain: true,
    }];
  }
}

const storage: PhotoStorage = {
  async createSignedUpload() { throw new Error('unused'); },
  async getObjectInfo() { return { size: 1024, contentType: 'image/jpeg' }; },
  async readObjectHeader() { throw new Error('unused'); },
  async createSignedView(path, expiresInSeconds) { return `https://storage.test/${path}?expires=${expiresInSeconds}`; },
  async remove() { throw new Error('unused'); },
};

describe('private read-only sharing API', () => {
  let app: ReturnType<typeof buildApp>;
  let store: MemorySharingStore;

  beforeEach(() => {
    store = new MemorySharingStore();
    const tokens = [firstToken, secondToken];
    const authenticator = createOrganizerAuthenticator({
      async verifyAccessToken(token) {
        return token === 'organizer-token' ? { id: organizerId } : null;
      },
    }, organizerId);
    const sharing = createSharingService(unusedDatabase, storage, {
      sharingQueries: store,
      peopleQueries: store,
      photoQueries: store,
      createToken: () => tokens.shift()!,
      now: () => new Date('2026-09-10T12:00:00.000Z'),
    });
    app = buildApp({
      webOrigin: 'http://localhost:5173',
      organizerApi: {
        authenticator,
        trees: {} as TreesService,
        people: {} as PeopleService,
        relationships: {} as RelationshipsService,
      },
      sharingApi: { authenticator, sharing },
    });
  });

  afterEach(async () => app.close());

  async function replace(treeId = ownTreeId) {
    return app.inject({
      method: 'PUT',
      url: `/trees/${treeId}/share-link`,
      headers: { authorization: 'Bearer organizer-token' },
    });
  }

  it('stores only a hash and exposes link status only to the organizer', async () => {
    const absent = await app.inject({
      method: 'GET', url: `/trees/${ownTreeId}/share-link`,
      headers: { authorization: 'Bearer organizer-token' },
    });
    expect(absent.json()).toEqual({ shareLink: { active: false, createdAt: null } });

    const created = await replace();
    expect(created.statusCode).toBe(200);
    expect(created.json().shareLink).toEqual({
      active: true,
      createdAt: '2026-09-10T12:00:00.000Z',
      token: firstToken,
    });
    expect(store.hashes.get(ownTreeId)?.hash).toBe(hashShareToken(firstToken));
    expect(JSON.stringify([...store.hashes.values()])).not.toContain(firstToken);

    expect((await replace(otherTreeId)).statusCode).toBe(404);
    const unauthenticated = await app.inject({ method: 'PUT', url: `/trees/${ownTreeId}/share-link` });
    expect(unauthenticated.statusCode).toBe(401);
  });

  it('allows account-free tree and signed-photo reads with privacy headers', async () => {
    await replace();
    const headers = { authorization: `Share ${firstToken}` };
    const tree = await app.inject({ method: 'GET', url: `/viewer/trees/${ownTreeId}`, headers });
    expect(tree.statusCode).toBe(200);
    expect(tree.json().tree).toMatchObject({
      id: ownTreeId,
      name: 'Martin family',
      graph: { treeId: ownTreeId, people: [{ id: personId }] },
    });
    expect(tree.headers['cache-control']).toBe('private, no-store');
    expect(tree.headers['referrer-policy']).toBe('no-referrer');
    expect(tree.headers['x-robots-tag']).toContain('noindex');

    const photos = await app.inject({ method: 'GET', url: `/viewer/trees/${ownTreeId}/photos`, headers });
    expect(photos.statusCode).toBe(200);
    expect(photos.json().photos[0]).toMatchObject({
      id: photoId,
      availability: 'ready',
      viewExpiresAt: '2026-09-10T12:05:00.000Z',
    });
  });

  it('rejects absent, malformed, cross-tree, and replaced viewer tokens', async () => {
    await replace();
    const absent = await app.inject({ method: 'GET', url: `/viewer/trees/${ownTreeId}` });
    expect(absent.statusCode).toBe(401);
    expect(absent.json().error.code).toBe('share_link_required');

    for (const authorization of ['Bearer organizer-token', `Share ${'x'.repeat(42)}`, `Share ${secondToken}`]) {
      const response = await app.inject({
        method: 'GET', url: `/viewer/trees/${ownTreeId}`, headers: { authorization },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('invalid_share_link');
    }

    const crossTree = await app.inject({
      method: 'GET', url: `/viewer/trees/${otherTreeId}`,
      headers: { authorization: `Share ${firstToken}` },
    });
    expect(crossTree.statusCode).toBe(404);

    await replace();
    const replaced = await app.inject({
      method: 'GET', url: `/viewer/trees/${ownTreeId}`,
      headers: { authorization: `Share ${firstToken}` },
    });
    expect(replaced.statusCode).toBe(404);
    const current = await app.inject({
      method: 'GET', url: `/viewer/trees/${ownTreeId}`,
      headers: { authorization: `Share ${secondToken}` },
    });
    expect(current.statusCode).toBe(200);
  });

  it('never accepts a share token on organizer mutations or viewer write paths', async () => {
    await replace();
    const organizerMutation = await app.inject({
      method: 'POST',
      url: `/trees/${ownTreeId}/people`,
      headers: { authorization: `Share ${firstToken}` },
      payload: { firstName: 'Denied', lastName: 'Viewer', lifeStatus: 'unknown' },
    });
    expect(organizerMutation.statusCode).toBe(401);

    const viewerMutation = await app.inject({
      method: 'POST',
      url: `/viewer/trees/${ownTreeId}/people`,
      headers: { authorization: `Share ${firstToken}` },
      payload: { firstName: 'Denied' },
    });
    expect(viewerMutation.statusCode).toBe(404);
    expect(store.graph.people).toHaveLength(1);
  });
});
