import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  PHOTO_UPLOAD_MAX_BYTES,
  type AgeBucket,
} from '@family-tree/family-core';
import { ApiError, PersonNotFoundError, TreeAccessError } from '../../lib/api-errors.js';
import { withTreeTransaction } from '../../lib/database.js';
import type { PhotoStorage } from '../../lib/photo-storage.js';
import { postgresTreeQueries, type Queryable, type TreeQueries } from '../trees/trees.queries.js';
import {
  postgresPhotoQueries,
  type PhotoQueries,
  type PhotoRecord,
} from './photos.queries.js';

export const PHOTO_VIEW_TTL_SECONDS = 5 * 60;

export interface PhotoView {
  id: string;
  personId: string;
  ageBucket: AgeBucket;
  createdAt: string;
  isMain: boolean;
  viewUrl: string | null;
  viewExpiresAt: string | null;
  availability: 'ready' | 'missing';
}

export interface PhotoUploadTicket {
  photoId: string;
  path: string;
  uploadUrl: string;
  token: string;
  expiresInSeconds: number;
}

export interface PhotosService {
  createUpload(organizerUserId: string, treeId: string, personId: string): Promise<PhotoUploadTicket>;
  cleanupUpload(organizerUserId: string, treeId: string, personId: string, photoId: string): Promise<void>;
  completeUpload(
    organizerUserId: string,
    treeId: string,
    personId: string,
    photoId: string,
    input: { ageBucket: AgeBucket; makeMain: boolean },
  ): Promise<PhotoView>;
  listPhotos(organizerUserId: string, treeId: string): Promise<PhotoView[]>;
  setMainPhoto(organizerUserId: string, treeId: string, personId: string, photoId: string): Promise<void>;
  deletePhoto(organizerUserId: string, treeId: string, personId: string, photoId: string): Promise<void>;
}

type TreeTransactionRunner = <T>(treeId: string, work: (database: Queryable) => Promise<T>) => Promise<T>;

interface PhotosServiceOptions {
  treeQueries?: TreeQueries;
  photoQueries?: PhotoQueries;
  runInTreeTransaction?: TreeTransactionRunner;
  createId?: () => string;
  now?: () => Date;
}

function photoPath(treeId: string, personId: string, photoId: string) {
  return `trees/${treeId}/people/${personId}/${photoId}.jpg`;
}

function isJpegHeader(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function createPhotosService(
  database: pg.Pool,
  storage: PhotoStorage,
  options: PhotosServiceOptions = {},
): PhotosService {
  const treeQueries = options.treeQueries ?? postgresTreeQueries;
  const photoQueries = options.photoQueries ?? postgresPhotoQueries;
  const createId = options.createId ?? randomUUID;
  const now = options.now ?? (() => new Date());
  const runInTreeTransaction = options.runInTreeTransaction
    ?? (<T>(treeId: string, work: (client: Queryable) => Promise<T>) =>
      withTreeTransaction(database, treeId, work));

  async function assertOwnership(client: Queryable, treeId: string, organizerUserId: string) {
    if (!await treeQueries.findOwnedTree(client, treeId, organizerUserId)) throw new TreeAccessError();
  }

  async function assertPerson(client: Queryable, treeId: string, personId: string) {
    if (!await photoQueries.personExists(client, treeId, personId)) throw new PersonNotFoundError();
  }

  async function toView(photo: PhotoRecord): Promise<PhotoView> {
    const object = await storage.getObjectInfo(photo.storagePath);
    if (!object) return {
      id: photo.id,
      personId: photo.personId,
      ageBucket: photo.ageBucket,
      createdAt: photo.createdAt,
      isMain: photo.isMain,
      viewUrl: null,
      viewExpiresAt: null,
      availability: 'missing',
    };
    const issuedAt = now();
    return {
      id: photo.id,
      personId: photo.personId,
      ageBucket: photo.ageBucket,
      createdAt: photo.createdAt,
      isMain: photo.isMain,
      viewUrl: await storage.createSignedView(photo.storagePath, PHOTO_VIEW_TTL_SECONDS),
      viewExpiresAt: new Date(issuedAt.getTime() + PHOTO_VIEW_TTL_SECONDS * 1000).toISOString(),
      availability: 'ready',
    };
  }

  return {
    async createUpload(organizerUserId, treeId, personId) {
      await assertOwnership(database, treeId, organizerUserId);
      await assertPerson(database, treeId, personId);
      const photoId = createId();
      const path = photoPath(treeId, personId, photoId);
      const signed = await storage.createSignedUpload(path);
      return { photoId, path, ...signed, expiresInSeconds: 2 * 60 * 60 };
    },

    async cleanupUpload(organizerUserId, treeId, personId, photoId) {
      await assertOwnership(database, treeId, organizerUserId);
      await assertPerson(database, treeId, personId);
      if (await photoQueries.findPhoto(database, treeId, personId, photoId)) {
        throw new ApiError(409, 'photo_already_published', 'Published photos must be removed from the gallery.');
      }
      await storage.remove(photoPath(treeId, personId, photoId));
    },

    async completeUpload(organizerUserId, treeId, personId, photoId, input) {
      await assertOwnership(database, treeId, organizerUserId);
      await assertPerson(database, treeId, personId);
      const path = photoPath(treeId, personId, photoId);
      const object = await storage.getObjectInfo(path);
      if (!object) throw new ApiError(404, 'photo_upload_not_found', 'The uploaded photo was not found. Please upload it again.');
      const header = await storage.readObjectHeader(path);
      if (
        object.contentType !== 'image/jpeg'
        || !Number.isSafeInteger(object.size)
        || object.size! <= 0
        || object.size! > PHOTO_UPLOAD_MAX_BYTES
        || !isJpegHeader(header)
      ) {
        await storage.remove(path);
        throw new ApiError(422, 'invalid_photo_object', 'The upload must be a valid JPEG no larger than 5 MB.');
      }

      let photo: PhotoRecord;
      try {
        photo = await runInTreeTransaction(treeId, async (client) => {
          await assertOwnership(client, treeId, organizerUserId);
          await assertPerson(client, treeId, personId);
          const existing = await photoQueries.findPhoto(client, treeId, personId, photoId);
          const saved = existing ?? await photoQueries.insertPhoto(client, {
            id: photoId,
            treeId,
            personId,
            storagePath: path,
            ageBucket: input.ageBucket,
          });
          if (input.makeMain && !await photoQueries.setMainPhoto(client, treeId, personId, photoId)) {
            throw new PersonNotFoundError();
          }
          return { ...saved, isMain: input.makeMain || saved.isMain };
        });
      } catch (error) {
        try {
          await storage.remove(path);
        } catch {
          throw new ApiError(
            409,
            'photo_upload_cleanup_required',
            'The photo could not be published or cleaned up. Retry removing the unfinished upload.',
          );
        }
        throw error;
      }
      return toView(photo);
    },

    async listPhotos(organizerUserId, treeId) {
      await assertOwnership(database, treeId, organizerUserId);
      return Promise.all((await photoQueries.listTreePhotos(database, treeId)).map(toView));
    },

    async setMainPhoto(organizerUserId, treeId, personId, photoId) {
      await runInTreeTransaction(treeId, async (client) => {
        await assertOwnership(client, treeId, organizerUserId);
        await assertPerson(client, treeId, personId);
        if (!await photoQueries.findPhoto(client, treeId, personId, photoId)) {
          throw new ApiError(404, 'photo_not_found', 'Photo not found for this person.');
        }
        if (!await photoQueries.setMainPhoto(client, treeId, personId, photoId)) {
          throw new ApiError(404, 'photo_not_found', 'Photo not found for this person.');
        }
      });
    },

    async deletePhoto(organizerUserId, treeId, personId, photoId) {
      await assertOwnership(database, treeId, organizerUserId);
      await assertPerson(database, treeId, personId);
      const photo = await photoQueries.findPhoto(database, treeId, personId, photoId);
      if (!photo) throw new ApiError(404, 'photo_not_found', 'Photo not found for this person.');
      // Storage first makes retries safe: a database failure leaves a visible
      // missing-image record that the organizer can remove with the same action.
      await storage.remove(photo.storagePath);
      await runInTreeTransaction(treeId, async (client) => {
        await assertOwnership(client, treeId, organizerUserId);
        if (!await photoQueries.deletePhoto(client, treeId, personId, photoId)) {
          throw new ApiError(404, 'photo_not_found', 'Photo not found for this person.');
        }
      });
    },
  };
}
