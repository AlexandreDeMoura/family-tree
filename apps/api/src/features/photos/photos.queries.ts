import type { AgeBucket } from '@family-tree/family-core';
import type { Queryable } from '../trees/trees.queries.js';

export interface PhotoRecord {
  id: string;
  treeId: string;
  personId: string;
  storagePath: string;
  ageBucket: AgeBucket;
  createdAt: string;
  isMain: boolean;
}

export interface NewPhotoRecord {
  id: string;
  treeId: string;
  personId: string;
  storagePath: string;
  ageBucket: AgeBucket;
}

export interface PhotoQueries {
  personExists(database: Queryable, treeId: string, personId: string): Promise<boolean>;
  listTreePhotos(database: Queryable, treeId: string): Promise<PhotoRecord[]>;
  findPhoto(database: Queryable, treeId: string, personId: string, photoId: string): Promise<PhotoRecord | null>;
  insertPhoto(database: Queryable, photo: NewPhotoRecord): Promise<PhotoRecord>;
  setMainPhoto(database: Queryable, treeId: string, personId: string, photoId: string): Promise<boolean>;
  deletePhoto(database: Queryable, treeId: string, personId: string, photoId: string): Promise<boolean>;
}

interface PhotoRow {
  id: string;
  tree_id: string;
  person_id: string;
  storage_path: string;
  age_bucket: AgeBucket;
  created_at: Date;
  is_main: boolean;
}

function toPhoto(row: PhotoRow): PhotoRecord {
  return {
    id: row.id,
    treeId: row.tree_id,
    personId: row.person_id,
    storagePath: row.storage_path,
    ageBucket: row.age_bucket,
    createdAt: row.created_at.toISOString(),
    isMain: row.is_main,
  };
}

const photoColumns = `photos.id, photos.tree_id, photos.person_id, photos.storage_path,
  photos.age_bucket, photos.created_at,
  COALESCE(people.main_photo_id = photos.id, false) AS is_main`;

export const postgresPhotoQueries: PhotoQueries = {
  async personExists(database, treeId, personId) {
    const result = await database.query(
      'SELECT 1 FROM public.people WHERE tree_id = $1 AND id = $2',
      [treeId, personId],
    );
    return result.rowCount === 1;
  },

  async listTreePhotos(database, treeId) {
    const result = await database.query<PhotoRow>(`
      SELECT ${photoColumns}
      FROM public.photos
      JOIN public.people ON people.tree_id = photos.tree_id AND people.id = photos.person_id
      WHERE photos.tree_id = $1
      ORDER BY photos.created_at ASC, photos.id ASC
    `, [treeId]);
    return result.rows.map(toPhoto);
  },

  async findPhoto(database, treeId, personId, photoId) {
    const result = await database.query<PhotoRow>(`
      SELECT ${photoColumns}
      FROM public.photos
      JOIN public.people ON people.tree_id = photos.tree_id AND people.id = photos.person_id
      WHERE photos.tree_id = $1 AND photos.person_id = $2 AND photos.id = $3
    `, [treeId, personId, photoId]);
    return result.rows[0] ? toPhoto(result.rows[0]) : null;
  },

  async insertPhoto(database, photo) {
    const result = await database.query<PhotoRow>(`
      WITH inserted AS (
        INSERT INTO public.photos (id, tree_id, person_id, storage_path, age_bucket)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      )
      SELECT inserted.id, inserted.tree_id, inserted.person_id, inserted.storage_path,
        inserted.age_bucket, inserted.created_at, false AS is_main
      FROM inserted
    `, [photo.id, photo.treeId, photo.personId, photo.storagePath, photo.ageBucket]);
    return toPhoto(result.rows[0]);
  },

  async setMainPhoto(database, treeId, personId, photoId) {
    const result = await database.query(`
      UPDATE public.people SET main_photo_id = $3
      WHERE tree_id = $1 AND id = $2
        AND EXISTS (
          SELECT 1 FROM public.photos
          WHERE tree_id = $1 AND person_id = $2 AND id = $3
        )
    `, [treeId, personId, photoId]);
    return result.rowCount === 1;
  },

  async deletePhoto(database, treeId, personId, photoId) {
    const result = await database.query(
      'DELETE FROM public.photos WHERE tree_id = $1 AND person_id = $2 AND id = $3',
      [treeId, personId, photoId],
    );
    return result.rowCount === 1;
  },
};
