import { ageBucketLabels, type AgeBucket, type Person } from '@family-tree/family-core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { errorMessage, familyApi, type PhotoView } from '../../lib/api';
import {
  buildPrivatePhotoViewerPath,
  buildPrivateViewerPath,
  readPrivateViewerToken,
} from '../sharing/share-link';
import { isPhotoAvailable, projectLifeStageGallery } from './life-stage-gallery';

export function LifeStagePhotoViewerPage() {
  const { treeId = '', personId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const token = readPrivateViewerToken(location.hash);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(() => new Set());
  const tree = useQuery({
    queryKey: ['viewer-tree', treeId, token],
    queryFn: () => familyApi.loadSharedTree(token!, treeId),
    enabled: Boolean(treeId && token),
    retry: false,
  });
  const photos = useQuery({
    queryKey: ['viewer-photos', treeId, token],
    queryFn: () => familyApi.listSharedPhotos(token!, treeId),
    enabled: Boolean(treeId && token && tree.isSuccess),
    staleTime: 4 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
    retry: false,
  });

  if (!token) return <PhotoViewerStatus title="This private link is incomplete" message="Ask the family organizer for a fresh viewer link." />;
  if (tree.isPending) return <PhotoViewerStatus loading title="Opening the family album…" />;
  if (tree.isError) return <PhotoViewerStatus title="This private link is unavailable" message={errorMessage(tree.error)} />;

  const person = tree.data.graph.people.find(({ id }) => id === personId);
  if (!person) {
    return (
      <PhotoViewerStatus
        title="This person is not in the family tree"
        message="The album may have changed since this link was opened."
        actionLabel="Back to tree"
        onAction={() => navigate(buildPrivateViewerPath(treeId, token))}
      />
    );
  }

  const personPhotos = (photos.data ?? []).filter((photo) => photo.personId === person.id);
  const gallery = projectLifeStageGallery(
    personPhotos,
    searchParameters.get('bucket'),
    searchParameters.get('photo'),
  );
  const portrait = personPhotos.find(({ isMain }) => isMain) ?? null;

  function selectBucket(bucket: AgeBucket) {
    navigate(buildPrivatePhotoViewerPath(treeId, person!.id, token!, bucket));
  }

  function selectPhoto(photo: PhotoView) {
    navigate(buildPrivatePhotoViewerPath(treeId, person!.id, token!, photo.ageBucket, photo.id));
  }

  function markBroken(photo: PhotoView) {
    if (photo.viewUrl) setBrokenUrls((current) => new Set(current).add(photo.viewUrl!));
    void photos.refetch();
  }

  return (
    <div className="life-stage-viewer">
      <header className="life-stage-viewer__header">
        <div className="life-stage-viewer__identity">
          <span className={person.lifeStatus === 'deceased' ? 'life-stage-viewer__portrait is-remembered' : 'life-stage-viewer__portrait'}>
            {isPhotoAvailable(portrait, brokenUrls)
              ? <img src={portrait!.viewUrl!} alt="" onError={() => markBroken(portrait!)} />
              : <span aria-hidden="true">{initials(person)}</span>}
          </span>
          <span>
            <h1>{person.firstName} {person.lastName}</h1>
            <small>{lifeSummary(person)} · {photoCountLabel(personPhotos.length, gallery.filledBucketCount)}</small>
          </span>
        </div>
        <nav className="life-stage-viewer__actions" aria-label="Photo viewer navigation">
          <button type="button" onClick={() => navigate(buildPrivateViewerPath(treeId, token, person.id))}>Back to card</button>
          <button className="life-stage-viewer__close" type="button" onClick={() => navigate(buildPrivateViewerPath(treeId, token))} aria-label="Close photo viewer and return to the family tree">×</button>
        </nav>
      </header>

      <main className="life-stage-viewer__body">
        <section className="life-stage-viewer__stage" aria-label={`${person.firstName}'s ${ageBucketLabels[gallery.activeBucket]} photos`}>
          {photos.isPending ? (
            <div className="life-stage-viewer__state" role="status"><div className="loading-orb" /><p>Opening the private gallery…</p></div>
          ) : photos.isError ? (
            <div className="life-stage-viewer__state is-error">
              <span aria-hidden="true">◌</span>
              <h2>The private photos could not be opened</h2>
              <p>{errorMessage(photos.error)}</p>
              <button type="button" onClick={() => void photos.refetch()}>Try again</button>
            </div>
          ) : gallery.selectedPhoto ? (
            <>
              <div className="life-stage-viewer__image">
                {isPhotoAvailable(gallery.selectedPhoto, brokenUrls) ? (
                  <img
                    src={gallery.selectedPhoto.viewUrl!}
                    alt={`${person.firstName} ${person.lastName} — ${ageBucketLabels[gallery.activeBucket]}`}
                    onError={() => markBroken(gallery.selectedPhoto!)}
                  />
                ) : (
                  <div className="life-stage-viewer__missing">
                    <span aria-hidden="true">◌</span>
                    <strong>Photo unavailable</strong>
                    <small>Its private link may have expired. Refresh and try again.</small>
                    <button type="button" onClick={() => void photos.refetch()}>Refresh private link</button>
                  </div>
                )}
              </div>
              <div className="life-stage-viewer__caption">
                <p>Assigned to <strong>{ageBucketLabels[gallery.activeBucket]}</strong> by the organizer · exact year not required</p>
                <span>{gallery.selectedPosition} of {gallery.bucketPhotos.length}</span>
              </div>
              <div className="life-stage-viewer__thumbnails" aria-label={`${ageBucketLabels[gallery.activeBucket]} photo choices`}>
                {gallery.bucketPhotos.map((photo, index) => (
                  <button
                    className={gallery.selectedPhoto?.id === photo.id ? 'is-active' : ''}
                    type="button"
                    key={photo.id}
                    onClick={() => selectPhoto(photo)}
                    aria-label={`Select photo ${index + 1} of ${gallery.bucketPhotos.length}`}
                    aria-current={gallery.selectedPhoto?.id === photo.id ? 'true' : undefined}
                  >
                    {isPhotoAvailable(photo, brokenUrls)
                      ? <img src={photo.viewUrl!} alt="" onError={() => markBroken(photo)} />
                      : <span aria-hidden="true">◌</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="life-stage-viewer__state is-empty">
              <span aria-hidden="true">◌</span>
              <h2>No {ageBucketLabels[gallery.activeBucket]} photos yet</h2>
              <p>This quiet gap is part of the family album, not an error.</p>
            </div>
          )}
        </section>

        <aside className="life-stage-viewer__buckets" aria-label="Browse photos by age">
          <span className="life-stage-viewer__eyebrow">Browse by age</span>
          <div role="tablist" aria-label="Life-stage photo buckets">
            {gallery.buckets.map(({ bucket, count }) => (
              <button
                key={bucket}
                type="button"
                role="tab"
                aria-selected={gallery.activeBucket === bucket}
                className={gallery.activeBucket === bucket ? 'is-active' : count ? 'has-photos' : ''}
                onClick={() => selectBucket(bucket)}
              >
                <span>{ageBucketLabels[bucket]}</span>
                {count ? <strong>{count}</strong> : <small>none yet</small>}
              </button>
            ))}
          </div>
          <p>Empty stages stay visible and quiet — a gap to fill, not an error.</p>
        </aside>
      </main>
    </div>
  );
}

function PhotoViewerStatus({ title, message, loading = false, actionLabel, onAction }: {
  title: string;
  message?: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="life-stage-viewer life-stage-viewer--status">
      <main className="life-stage-viewer__state" role={loading ? 'status' : undefined}>
        {loading ? <div className="loading-orb" /> : <span aria-hidden="true">◌</span>}
        <h1>{title}</h1>
        {message && <p>{message}</p>}
        {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
      </main>
    </div>
  );
}

function initials(person: Person) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

function lifeSummary(person: Person) {
  if (person.lifeStatus === 'deceased') {
    if (person.birthYear !== null && person.deathYear !== null) return `${person.birthYear}–${person.deathYear}`;
    if (person.birthYear !== null) return `${person.birthYear}–?`;
    if (person.deathYear !== null) return `?–${person.deathYear}`;
    return 'Dates unknown';
  }
  return person.birthYear === null ? 'Birth year unknown' : `Born ${person.birthYear}`;
}

function photoCountLabel(photoCount: number, bucketCount: number) {
  return `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} in ${bucketCount} ${bucketCount === 1 ? 'bucket' : 'buckets'}`;
}
