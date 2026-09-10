import type { AgeBucket } from './schemas.js';

export const PHOTO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 2400;

export const ageBucketLabels: Record<AgeBucket, string> = {
  baby_toddler: 'Baby / Toddler',
  kid: 'Kid',
  adolescent: 'Adolescent',
  '20s': '20s',
  '30s': '30s',
  '40s': '40s',
  '50s': '50s',
  '60s': '60s',
  '70s': '70s',
  '80s': '80s',
  '90s_plus': '90s+',
};
