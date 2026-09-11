import { ageBuckets, type AgeBucket } from '@family-tree/family-core';
import { describe, expect, it } from 'vitest';
import type { PhotoView } from '../../lib/api';
import { isPhotoAvailable, projectLifeStageGallery } from './life-stage-gallery';

describe('life-stage gallery state', () => {
  it('keeps all eleven buckets in life order with filled and empty counts', () => {
    const gallery = projectLifeStageGallery([
      photo('baby', 'baby_toddler'),
      photo('young-a', '20s'),
      photo('young-b', '20s'),
    ], '20s', null);

    expect(gallery.buckets.map(({ bucket }) => bucket)).toEqual(ageBuckets);
    expect(gallery.buckets.find(({ bucket }) => bucket === '20s')?.count).toBe(2);
    expect(gallery.buckets.find(({ bucket }) => bucket === '30s')?.count).toBe(0);
    expect(gallery.filledBucketCount).toBe(2);
  });

  it('selects only within the active bucket and reports its position', () => {
    const photos = [photo('first', '20s'), photo('second', '20s'), photo('later', '40s')];

    expect(projectLifeStageGallery(photos, '20s', 'second')).toMatchObject({
      activeBucket: '20s',
      selectedPhoto: { id: 'second' },
      selectedPosition: 2,
    });
    expect(projectLifeStageGallery(photos, '20s', 'later')).toMatchObject({
      selectedPhoto: { id: 'first' },
      selectedPosition: 1,
    });
  });

  it('defaults to the main portrait bucket without inventing an order', () => {
    const gallery = projectLifeStageGallery([
      photo('first', 'baby_toddler'),
      { ...photo('main', '70s'), isMain: true },
    ], null, null);

    expect(gallery).toMatchObject({ activeBucket: '70s', selectedPhoto: { id: 'main' } });
  });

  it('represents empty buckets and unavailable images without treating them as errors', () => {
    const missing = { ...photo('missing', '30s'), availability: 'missing' as const, viewUrl: null };
    const gallery = projectLifeStageGallery([missing], '40s', null);

    expect(gallery.bucketPhotos).toEqual([]);
    expect(gallery.selectedPhoto).toBeNull();
    expect(gallery.selectedPosition).toBeNull();
    expect(isPhotoAvailable(missing)).toBe(false);
    expect(isPhotoAvailable(photo('broken', '30s'), new Set(['https://photos.test/broken']))).toBe(false);
  });
});

function photo(id: string, ageBucket: AgeBucket): PhotoView {
  return {
    id,
    personId: 'person',
    ageBucket,
    createdAt: '2026-09-11T00:00:00.000Z',
    isMain: false,
    viewUrl: `https://photos.test/${id}`,
    viewExpiresAt: '2026-09-11T00:05:00.000Z',
    availability: 'ready',
  };
}
