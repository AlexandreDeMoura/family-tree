import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './api-errors.js';

const PHOTO_BUCKET = 'family-photos';

export interface StoredPhotoObject {
  size: number | undefined;
  contentType: string | undefined;
}

export interface PhotoStorage {
  createSignedUpload(path: string): Promise<{ uploadUrl: string; token: string }>;
  getObjectInfo(path: string): Promise<StoredPhotoObject | null>;
  readObjectHeader(path: string): Promise<Uint8Array>;
  createSignedView(path: string, expiresInSeconds: number): Promise<string>;
  remove(path: string): Promise<void>;
}

function storageFailure(message: string) {
  return new ApiError(503, 'photo_storage_unavailable', message);
}

function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = 'statusCode' in error ? String(error.statusCode) : '';
  return status === '404' || ('message' in error && /not found/i.test(String(error.message)));
}

export function createSupabasePhotoStorage(client: SupabaseClient): PhotoStorage {
  const bucket = client.storage.from(PHOTO_BUCKET);
  return {
    async createSignedUpload(path) {
      const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false });
      if (error) throw storageFailure('A private photo upload could not be prepared.');
      return { uploadUrl: data.signedUrl, token: data.token };
    },

    async getObjectInfo(path) {
      const { data, error } = await bucket.info(path);
      if (error && isNotFound(error)) return null;
      if (error) throw storageFailure('The uploaded photo could not be checked.');
      return { size: data.size, contentType: data.contentType };
    },

    async readObjectHeader(path) {
      const { data, error } = await bucket.download(path);
      if (error) throw storageFailure('The uploaded photo could not be checked.');
      return new Uint8Array(await data.slice(0, 3).arrayBuffer());
    },

    async createSignedView(path, expiresInSeconds) {
      const { data, error } = await bucket.createSignedUrl(path, expiresInSeconds);
      if (error) throw storageFailure('A private photo viewing URL could not be created.');
      return data.signedUrl;
    },

    async remove(path) {
      const { error } = await bucket.remove([path]);
      if (error && !isNotFound(error)) throw storageFailure('The private photo could not be removed.');
    },
  };
}
