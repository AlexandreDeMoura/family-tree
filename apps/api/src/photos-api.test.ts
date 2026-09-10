import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PHOTO_UPLOAD_MAX_BYTES, type AgeBucket } from '@family-tree/family-core';
import { buildApp } from './app.js';
import { createOrganizerAuthenticator, type AuthVerifier } from './features/auth/auth.service.js';
import type { PeopleService } from './features/people/people.service.js';
import type {
  NewPhotoRecord,
  PhotoQueries,
  PhotoRecord,
} from './features/photos/photos.queries.js';
import { createPhotosService } from './features/photos/photos.service.js';
import type { RelationshipsService } from './features/relationships/relationships.service.js';
import type { TreesService } from './features/trees/trees.service.js';
import type { Queryable, TreeQueries, TreeSummary } from './features/trees/trees.queries.js';
import type { PhotoStorage, StoredPhotoObject } from './lib/photo-storage.js';

const organizerId = randomUUID();
const foreignOwnerId = randomUUID();
const ownTreeId = randomUUID();
const foreignTreeId = randomUUID();
const personId = randomUUID();
const secondPersonId = randomUUID();
const bearer = { authorization: 'Bearer valid-token' };
const unusedDatabase = {} as pg.Pool;

class MemoryPhotos implements TreeQueries, PhotoQueries {
  readonly trees = new Map<string, TreeSummary & { organizerUserId: string }>([
    [ownTreeId, { id: ownTreeId, name: 'Own', createdAt: '2026-09-10T12:00:00.000Z', organizerUserId: organizerId }],
    [foreignTreeId, { id: foreignTreeId, name: 'Foreign', createdAt: '2026-09-10T12:00:00.000Z', organizerUserId: foreignOwnerId }],
  ]);
  readonly people = new Set([`${ownTreeId}:${personId}`, `${ownTreeId}:${secondPersonId}`]);
  readonly photos = new Map<string, PhotoRecord>();

  async createTree(): Promise<TreeSummary> { throw new Error('unused'); }
  async listOwnedTrees(): Promise<TreeSummary[]> { throw new Error('unused'); }
  async findOwnedTree(_database: Queryable, treeId: string, organizerUserId: string) {
    const tree = this.trees.get(treeId);
    if (!tree || tree.organizerUserId !== organizerUserId) return null;
    const { organizerUserId: _owner, ...summary } = tree;
    return summary;
  }
  async personExists(_database: Queryable, treeId: string, candidatePersonId: string) {
    return this.people.has(`${treeId}:${candidatePersonId}`);
  }
  async listTreePhotos(_database: Queryable, treeId: string) {
    return [...this.photos.values()].filter((photo) => photo.treeId === treeId);
  }
  async findPhoto(_database: Queryable, treeId: string, candidatePersonId: string, photoId: string) {
    const photo = this.photos.get(photoId);
    return photo?.treeId === treeId && photo.personId === candidatePersonId ? structuredClone(photo) : null;
  }
  async insertPhoto(_database: Queryable, photo: NewPhotoRecord) {
    if (this.photos.has(photo.id)) throw new Error('duplicate');
    const saved: PhotoRecord = {
      ...photo,
      createdAt: '2026-09-10T12:00:00.000Z',
      isMain: false,
    };
    this.photos.set(photo.id, saved);
    return structuredClone(saved);
  }
  async setMainPhoto(_database: Queryable, treeId: string, candidatePersonId: string, photoId: string) {
    const photo = this.photos.get(photoId);
    if (!photo || photo.treeId !== treeId || photo.personId !== candidatePersonId) return false;
    for (const saved of this.photos.values()) {
      if (saved.treeId === treeId && saved.personId === candidatePersonId) saved.isMain = false;
    }
    photo.isMain = true;
    return true;
  }
  async deletePhoto(_database: Queryable, treeId: string, candidatePersonId: string, photoId: string) {
    const photo = this.photos.get(photoId);
    if (!photo || photo.treeId !== treeId || photo.personId !== candidatePersonId) return false;
    return this.photos.delete(photoId);
  }
}

class MemoryStorage implements PhotoStorage {
  readonly objects = new Map<string, StoredPhotoObject & { header: Uint8Array }>();
  readonly removed: string[] = [];

  async createSignedUpload(path: string) {
    return { uploadUrl: `https://storage.test/upload/${path}?token=signed`, token: 'signed' };
  }
  async getObjectInfo(path: string) {
    const object = this.objects.get(path);
    return object ? { size: object.size, contentType: object.contentType } : null;
  }
  async readObjectHeader(path: string) {
    return this.objects.get(path)?.header ?? new Uint8Array();
  }
  async createSignedView(path: string, expiresInSeconds: number) {
    return `https://storage.test/view/${path}?expires=${expiresInSeconds}`;
  }
  async remove(path: string) {
    this.removed.push(path);
    this.objects.delete(path);
  }
}

describe('private organizer photo API', () => {
  let app: ReturnType<typeof buildApp>;
  let records: MemoryPhotos;
  let storage: MemoryStorage;

  beforeEach(() => {
    records = new MemoryPhotos();
    storage = new MemoryStorage();
    const verifier: AuthVerifier = {
      async verifyAccessToken(token) {
        if (token === 'valid-token') return { id: organizerId };
        if (token === 'other-token') return { id: foreignOwnerId };
        return null;
      },
    };
    const photos = createPhotosService(unusedDatabase, storage, {
      treeQueries: records,
      photoQueries: records,
      createId: randomUUID,
      now: () => new Date('2026-09-10T12:00:00.000Z'),
      runInTreeTransaction: async (_treeId, work) => work(unusedDatabase),
    });
    app = buildApp({
      webOrigin: 'http://localhost:5173',
      organizerApi: {
        authenticator: createOrganizerAuthenticator(verifier, organizerId),
        trees: {} as TreesService,
        people: {} as PeopleService,
        relationships: {} as RelationshipsService,
        photos,
      },
    });
  });

  afterEach(async () => app.close());

  async function prepareUpload(targetTreeId = ownTreeId, targetPersonId = personId) {
    return app.inject({
      method: 'POST',
      url: `/trees/${targetTreeId}/people/${targetPersonId}/photos/uploads`,
      headers: bearer,
      payload: { contentType: 'image/jpeg', sizeBytes: 1024 },
    });
  }

  async function uploadObject(path: string, overrides: Partial<StoredPhotoObject & { header: Uint8Array }> = {}) {
    storage.objects.set(path, {
      size: 1024,
      contentType: 'image/jpeg',
      header: new Uint8Array([0xff, 0xd8, 0xff]),
      ...overrides,
    });
  }

  async function complete(photoId: string, bucket: AgeBucket = '20s', targetPersonId = personId) {
    return app.inject({
      method: 'POST',
      url: `/trees/${ownTreeId}/people/${targetPersonId}/photos/${photoId}/complete`,
      headers: bearer,
      payload: { ageBucket: bucket, makeMain: true },
    });
  }

  it('rejects unauthenticated and cross-tree upload or viewing requests', async () => {
    const unauthenticated = await app.inject({
      method: 'POST',
      url: `/trees/${ownTreeId}/people/${personId}/photos/uploads`,
      payload: { contentType: 'image/jpeg', sizeBytes: 1024 },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const crossTree = await prepareUpload(foreignTreeId, personId);
    expect(crossTree.statusCode).toBe(404);
    expect(crossTree.json().error.code).toBe('tree_not_found');

    const crossTreeView = await app.inject({ method: 'GET', url: `/trees/${foreignTreeId}/photos`, headers: bearer });
    expect(crossTreeView.statusCode).toBe(404);
  });

  it('publishes a verified JPEG with one bucket and returns short-lived private views', async () => {
    const prepared = await prepareUpload();
    expect(prepared.statusCode).toBe(201);
    const upload = prepared.json().upload;
    expect(upload.path).toBe(`trees/${ownTreeId}/people/${personId}/${upload.photoId}.jpg`);
    expect(upload.uploadUrl).toContain('token=signed');
    await uploadObject(upload.path);

    const published = await complete(upload.photoId, '20s');
    expect(published.statusCode).toBe(201);
    expect(published.json().photo).toMatchObject({
      id: upload.photoId,
      personId,
      ageBucket: '20s',
      isMain: true,
      availability: 'ready',
      viewExpiresAt: '2026-09-10T12:05:00.000Z',
    });
    expect(records.photos.get(upload.photoId)).toMatchObject({
      storagePath: upload.path,
      ageBucket: '20s',
      isMain: true,
    });
    expect(JSON.stringify(records.photos.get(upload.photoId))).not.toContain('storage.test');

    const viewed = await app.inject({ method: 'GET', url: `/trees/${ownTreeId}/photos`, headers: bearer });
    expect(viewed.statusCode).toBe(200);
    expect(viewed.json().photos[0].viewUrl).toContain('expires=300');
  });

  it('does not publish missing, oversized, non-JPEG, or invalid-bucket uploads', async () => {
    const oversizedRequest = await app.inject({
      method: 'POST',
      url: `/trees/${ownTreeId}/people/${personId}/photos/uploads`,
      headers: bearer,
      payload: { contentType: 'image/jpeg', sizeBytes: PHOTO_UPLOAD_MAX_BYTES + 1 },
    });
    expect(oversizedRequest.statusCode).toBe(400);

    const missing = (await prepareUpload()).json().upload;
    expect((await complete(missing.photoId)).statusCode).toBe(404);

    const invalid = (await prepareUpload()).json().upload;
    await uploadObject(invalid.path, { contentType: 'image/png', header: new Uint8Array([1, 2, 3]) });
    const rejected = await complete(invalid.photoId);
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json().error.code).toBe('invalid_photo_object');
    expect(storage.objects.has(invalid.path)).toBe(false);

    const badBucket = (await prepareUpload()).json().upload;
    await uploadObject(badBucket.path);
    const response = await app.inject({
      method: 'POST',
      url: `/trees/${ownTreeId}/people/${personId}/photos/${badBucket.photoId}/complete`,
      headers: bearer,
      payload: { ageBucket: 'teenager', makeMain: false },
    });
    expect(response.statusCode).toBe(400);
    expect(records.photos.size).toBe(0);
  });

  it('shows a missing state for a vanished object and supports retry-safe deletion', async () => {
    const upload = (await prepareUpload()).json().upload;
    await uploadObject(upload.path);
    expect((await complete(upload.photoId)).statusCode).toBe(201);
    storage.objects.delete(upload.path);

    const list = await app.inject({ method: 'GET', url: `/trees/${ownTreeId}/photos`, headers: bearer });
    expect(list.json().photos[0]).toMatchObject({ availability: 'missing', viewUrl: null });

    const removed = await app.inject({
      method: 'DELETE',
      url: `/trees/${ownTreeId}/people/${personId}/photos/${upload.photoId}`,
      headers: bearer,
    });
    expect(removed.statusCode).toBe(204);
    expect(records.photos.size).toBe(0);
    expect(storage.removed).toContain(upload.path);
  });

  it('cleans unfinished uploads without allowing cleanup to remove published photos', async () => {
    const pending = (await prepareUpload()).json().upload;
    await uploadObject(pending.path);
    const cleaned = await app.inject({
      method: 'DELETE',
      url: `/trees/${ownTreeId}/people/${personId}/photos/uploads/${pending.photoId}`,
      headers: bearer,
    });
    expect(cleaned.statusCode).toBe(204);
    expect(storage.objects.has(pending.path)).toBe(false);

    const published = (await prepareUpload()).json().upload;
    await uploadObject(published.path);
    expect((await complete(published.photoId)).statusCode).toBe(201);
    const refused = await app.inject({
      method: 'DELETE',
      url: `/trees/${ownTreeId}/people/${personId}/photos/uploads/${published.photoId}`,
      headers: bearer,
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('photo_already_published');
    expect(storage.objects.has(published.path)).toBe(true);
  });

  it('prevents a photo from becoming another person\'s portrait', async () => {
    const upload = (await prepareUpload()).json().upload;
    await uploadObject(upload.path);
    expect((await complete(upload.photoId)).statusCode).toBe(201);

    const response = await app.inject({
      method: 'PATCH',
      url: `/trees/${ownTreeId}/people/${secondPersonId}/photos/${upload.photoId}/portrait`,
      headers: bearer,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('photo_not_found');
  });
});
