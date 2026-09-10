import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import type { FamilyGraph } from '@family-tree/family-core';
import { ApiError, TreeAccessError } from '../../lib/api-errors.js';
import type { PhotoStorage } from '../../lib/photo-storage.js';
import { postgresPeopleQueries, type PeopleQueries } from '../people/people.queries.js';
import { postgresPhotoQueries, type PhotoQueries } from '../photos/photos.queries.js';
import { createPhotoViews, type PhotoView } from '../photos/photos.service.js';
import type { TreeSummary } from '../trees/trees.queries.js';
import {
  postgresSharingQueries,
  type ShareLinkStatus,
  type SharingQueries,
} from './sharing.queries.js';

export interface SharedTree extends TreeSummary {
  graph: FamilyGraph;
}

export interface ReplacedShareLink extends ShareLinkStatus {
  token: string;
}

export interface SharingService {
  getStatus(organizerUserId: string, treeId: string): Promise<ShareLinkStatus>;
  replaceLink(organizerUserId: string, treeId: string): Promise<ReplacedShareLink>;
  loadSharedTree(treeId: string, token: string): Promise<SharedTree>;
  listSharedPhotos(treeId: string, token: string): Promise<PhotoView[]>;
}

interface SharingServiceOptions {
  sharingQueries?: SharingQueries;
  peopleQueries?: PeopleQueries;
  photoQueries?: PhotoQueries;
  createToken?: () => string;
  now?: () => Date;
}

export function hashShareToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createSharingService(
  database: pg.Pool,
  storage: PhotoStorage,
  options: SharingServiceOptions = {},
): SharingService {
  const sharingQueries = options.sharingQueries ?? postgresSharingQueries;
  const peopleQueries = options.peopleQueries ?? postgresPeopleQueries;
  const photoQueries = options.photoQueries ?? postgresPhotoQueries;
  const createToken = options.createToken ?? (() => randomBytes(32).toString('base64url'));

  async function resolve(treeId: string, token: string) {
    const tree = await sharingQueries.resolveTree(database, treeId, hashShareToken(token));
    if (!tree) {
      throw new ApiError(404, 'invalid_share_link', 'This private family link is invalid or has been replaced.');
    }
    return tree;
  }

  return {
    async getStatus(organizerUserId, treeId) {
      const status = await sharingQueries.findStatusForOwner(database, treeId, organizerUserId);
      if (!status) throw new TreeAccessError();
      return status;
    },

    async replaceLink(organizerUserId, treeId) {
      const token = createToken();
      const status = await sharingQueries.replaceForOwner(
        database,
        treeId,
        organizerUserId,
        hashShareToken(token),
      );
      if (!status) throw new TreeAccessError();
      return { ...status, token };
    },

    async loadSharedTree(treeId, token) {
      const tree = await resolve(treeId, token);
      return { ...tree, graph: await peopleQueries.loadGraph(database, treeId) };
    },

    async listSharedPhotos(treeId, token) {
      await resolve(treeId, token);
      return createPhotoViews(
        await photoQueries.listTreePhotos(database, treeId),
        storage,
        options.now,
      );
    },
  };
}

