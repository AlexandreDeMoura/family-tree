import { useMemo, useState, type FormEvent } from 'react';
import {
  ageBucketLabels,
  ageBuckets,
  type AgeBucket,
  type Person,
} from '@family-tree/family-core';
import { errorMessage, type PhotoView } from '../../lib/api';
import { PendingPhotoCleanupError } from './photo-upload';

interface PhotoGalleryProps {
  person: Person;
  photos: PhotoView[];
  loading: boolean;
  loadError: unknown;
  onRefresh: () => void;
  onUpload?: (file: File, ageBucket: AgeBucket, makeMain: boolean) => Promise<void>;
  onSetMain?: (photoId: string) => Promise<void>;
  onDelete?: (photoId: string) => Promise<void>;
}

export function PhotoGallery({
  person,
  photos,
  loading,
  loadError,
  onRefresh,
  onUpload,
  onSetMain,
  onDelete,
}: PhotoGalleryProps) {
  const editable = Boolean(onUpload && onSetMain && onDelete);
  const defaultBucket = photos.find(({ isMain }) => isMain)?.ageBucket ?? photos[0]?.ageBucket ?? 'baby_toddler';
  const [selectedBucket, setSelectedBucket] = useState<AgeBucket | null>(null);
  const [uploadBucket, setUploadBucket] = useState<AgeBucket | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [makeMain, setMakeMain] = useState(person.mainPhotoId === null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingCleanup, setPendingCleanup] = useState<PendingPhotoCleanupError | null>(null);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(() => new Set());
  const bucketCounts = useMemo(() => new Map(ageBuckets.map((bucket) => [
    bucket,
    photos.filter((photo) => photo.ageBucket === bucket).length,
  ])), [photos]);
  const activeBucket = selectedBucket ?? defaultBucket;
  const activeUploadBucket = uploadBucket ?? defaultBucket;
  const visible = photos.filter((photo) => photo.ageBucket === activeBucket);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy('upload');
    setActionError(null);
    setPendingCleanup(null);
    try {
      await onUpload!(file, activeUploadBucket, makeMain);
      setSelectedBucket(activeUploadBucket);
      setFile(null);
      setMakeMain(false);
      const input = event.currentTarget.querySelector<HTMLInputElement>('input[type=file]');
      if (input) input.value = '';
    } catch (error) {
      setActionError(errorMessage(error));
      if (error instanceof PendingPhotoCleanupError) setPendingCleanup(error);
    } finally {
      setBusy(null);
    }
  }

  async function act(key: string, action: () => Promise<void>) {
    setBusy(key);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="person-card__photos" aria-labelledby={`photos-${person.id}`}>
      <div className="person-card__photos-heading">
        <div><span className="eyebrow" id={`photos-${person.id}`}>Photos through the years</span><p>Browse {person.firstName}'s life by approximate age.</p></div>
        <button className="text-button" type="button" onClick={onRefresh}>Refresh links</button>
      </div>

      {loading ? <p className="photo-gallery__status">Opening the private gallery…</p> : loadError ? (
        <div className="photo-gallery__status is-error"><span>{errorMessage(loadError)}</span><button className="text-button" type="button" onClick={onRefresh}>Try again</button></div>
      ) : (
        <>
          <div className="photo-buckets" role="tablist" aria-label="Photo age buckets">
            {ageBuckets.map((bucket) => (
              <button
                key={bucket}
                type="button"
                role="tab"
                aria-selected={activeBucket === bucket}
                className={activeBucket === bucket ? 'is-active' : ''}
                onClick={() => setSelectedBucket(bucket)}
              >
                {ageBucketLabels[bucket]} <small>{bucketCounts.get(bucket)}</small>
              </button>
            ))}
          </div>

          <div className="photo-gallery" role="tabpanel">
            {visible.length ? visible.map((photo) => {
              const unavailable = !photo.viewUrl || brokenUrls.has(photo.viewUrl);
              return (
                <article className="photo-tile" key={photo.id}>
                  {unavailable ? (
                    <div className="photo-tile__missing"><span aria-hidden="true">◌</span><strong>Photo unavailable</strong><small>{editable ? 'Refresh its private link or remove it.' : 'Refresh its private link and try again.'}</small></div>
                  ) : (
                    <img
                      src={photo.viewUrl!}
                      alt={`${person.firstName} ${person.lastName} — ${ageBucketLabels[photo.ageBucket]}`}
                      onError={() => {
                        setBrokenUrls((current) => new Set(current).add(photo.viewUrl!));
                        onRefresh();
                      }}
                    />
                  )}
                  {editable && <div className="photo-tile__actions">
                    {photo.isMain ? <span className="photo-main-label">Main portrait</span> : (
                      <button
                        className="text-button"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void act(`main-${photo.id}`, () => onSetMain!(photo.id))}
                      >Use as portrait</button>
                    )}
                    <button
                      className="text-button text-button--danger"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (window.confirm('Remove this private photo permanently?')) {
                          void act(`delete-${photo.id}`, () => onDelete!(photo.id));
                        }
                      }}
                    >{busy === `delete-${photo.id}` ? 'Removing…' : 'Remove'}</button>
                  </div>}
                </article>
              );
            }) : <p className="photo-gallery__empty">No photos in {ageBucketLabels[activeBucket]} yet.</p>}
          </div>
        </>
      )}

      {editable && <form className="photo-upload" onSubmit={(event) => void upload(event)}>
        <strong>Add a private photo</strong>
        <p>JPEG, PNG, or WebP up to 20 MB. It is converted to a JPEG no larger than 5 MB before upload.</p>
        <div className="photo-upload__fields">
          <label><span>Image</span><input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          <label><span>Age in photo</span><select value={activeUploadBucket} onChange={(event) => setUploadBucket(event.target.value as AgeBucket)}>{ageBuckets.map((bucket) => <option key={bucket} value={bucket}>{ageBucketLabels[bucket]}</option>)}</select></label>
        </div>
        <label className="photo-upload__main"><input type="checkbox" checked={makeMain} onChange={(event) => setMakeMain(event.target.checked)} /><span>Use as the main portrait</span></label>
        {actionError && <div className="alert alert--error" role="alert">{actionError}</div>}
        {pendingCleanup && (
          <button
            className="button button--quiet"
            type="button"
            disabled={busy !== null}
            onClick={() => void act('cleanup', async () => {
              await pendingCleanup.retryCleanup();
              setPendingCleanup(null);
              setActionError(null);
            })}
          >{busy === 'cleanup' ? 'Cleaning up…' : 'Retry unfinished-upload cleanup'}</button>
        )}
        <button className="button button--secondary" type="submit" disabled={!file || busy !== null || pendingCleanup !== null}>{busy === 'upload' ? 'Preparing and uploading…' : 'Add photo'}</button>
      </form>}
    </section>
  );
}
