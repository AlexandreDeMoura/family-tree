import { ageBuckets, type AgeBucket } from '@family-tree/family-core';
import type { PhotoView } from '../../lib/api';

export interface LifeStageBucketSummary {
  bucket: AgeBucket;
  count: number;
}

export interface LifeStageGalleryState {
  activeBucket: AgeBucket;
  bucketPhotos: PhotoView[];
  buckets: LifeStageBucketSummary[];
  filledBucketCount: number;
  selectedPhoto: PhotoView | null;
  selectedPosition: number | null;
}

export function projectLifeStageGallery(
  photos: PhotoView[],
  requestedBucket: string | null,
  requestedPhotoId: string | null,
): LifeStageGalleryState {
  const defaultPhoto = photos.find(({ isMain }) => isMain) ?? photos[0] ?? null;
  const activeBucket = isAgeBucket(requestedBucket)
    ? requestedBucket
    : defaultPhoto?.ageBucket ?? ageBuckets[0];
  const bucketPhotos = photos.filter(({ ageBucket }) => ageBucket === activeBucket);
  const requestedPhoto = bucketPhotos.find(({ id }) => id === requestedPhotoId);
  const selectedPhoto = requestedPhoto ?? bucketPhotos[0] ?? null;
  const selectedIndex = selectedPhoto
    ? bucketPhotos.findIndex(({ id }) => id === selectedPhoto.id)
    : -1;
  const buckets = ageBuckets.map((bucket) => ({
    bucket,
    count: photos.filter(({ ageBucket }) => ageBucket === bucket).length,
  }));

  return {
    activeBucket,
    bucketPhotos,
    buckets,
    filledBucketCount: buckets.filter(({ count }) => count > 0).length,
    selectedPhoto,
    selectedPosition: selectedIndex < 0 ? null : selectedIndex + 1,
  };
}

export function isPhotoAvailable(photo: PhotoView | null, brokenUrls: ReadonlySet<string> = new Set()) {
  return Boolean(
    photo
    && photo.availability === 'ready'
    && photo.viewUrl
    && !brokenUrls.has(photo.viewUrl),
  );
}

function isAgeBucket(value: string | null): value is AgeBucket {
  return value !== null && ageBuckets.some((bucket) => bucket === value);
}
