import { ageBucketLabels, type Person } from '@family-tree/family-core';
import { useState } from 'react';
import { errorMessage, type PhotoView } from '../../lib/api';
import { isPhotoAvailable } from './life-stage-gallery';

interface PhotoGalleryPreviewProps {
  person: Person;
  photos: PhotoView[];
  loading: boolean;
  loadError: unknown;
  onOpen: () => void;
  onRefresh: () => void;
}

export function PhotoGalleryPreview({
  person,
  photos,
  loading,
  loadError,
  onOpen,
  onRefresh,
}: PhotoGalleryPreviewProps) {
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(() => new Set());
  const previews = photos.slice(0, 3);

  function markBroken(photo: PhotoView) {
    if (photo.viewUrl) setBrokenUrls((current) => new Set(current).add(photo.viewUrl!));
    onRefresh();
  }

  return (
    <section className="person-card__photos person-card__photo-preview" aria-labelledby={`photos-${person.id}`}>
      <div className="person-card__photos-heading">
        <div>
          <span className="eyebrow" id={`photos-${person.id}`}>Photos through the years</span>
          <p>{photos.length ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} across ${bucketCount(photos)} life ${bucketCount(photos) === 1 ? 'stage' : 'stages'}.` : `No photos of ${person.firstName} yet.`}</p>
        </div>
      </div>

      {loading ? <p className="photo-gallery__status">Opening the private gallery…</p> : loadError ? (
        <div className="photo-gallery__status is-error">
          <span>{errorMessage(loadError)}</span>
          <button className="text-button" type="button" onClick={onRefresh}>Try again</button>
        </div>
      ) : previews.length ? (
        <div className="photo-preview-grid">
          {previews.map((photo) => isPhotoAvailable(photo, brokenUrls) ? (
            <button key={photo.id} type="button" onClick={onOpen} aria-label={`Open ${person.firstName}'s ${ageBucketLabels[photo.ageBucket]} photos`}>
              <img src={photo.viewUrl!} alt="" onError={() => markBroken(photo)} />
            </button>
          ) : (
            <button className="photo-preview-grid__missing" key={photo.id} type="button" onClick={onOpen} aria-label="Open photo viewer; preview unavailable">
              <span aria-hidden="true">◌</span>
            </button>
          ))}
        </div>
      ) : (
        <button className="photo-preview-empty" type="button" onClick={onOpen}>
          <span aria-hidden="true">◌</span>
          <span>Life-stage album</span>
        </button>
      )}

      {!loading && !loadError && (
        <button className="button button--secondary button--wide photo-preview-open" type="button" onClick={onOpen}>
          Browse life-stage photos <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}

function bucketCount(photos: PhotoView[]) {
  return new Set(photos.map(({ ageBucket }) => ageBucket)).size;
}
