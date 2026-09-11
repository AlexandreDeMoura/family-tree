import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { errorMessage, familyApi } from '../../lib/api';
import { PersonCard } from '../people/PersonCard';
import { FamilyTree } from '../tree/FamilyTree';
import {
  buildPrivatePhotoViewerPath,
  buildPrivateViewerPath,
  readPrivateViewerToken,
} from './share-link';

export function ViewerPage() {
  const { treeId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const token = readPrivateViewerToken(location.hash);

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

  if (!token) return <ViewerStatus title="This private link is incomplete" message="Ask the family organizer for a fresh viewer link." />;
  if (tree.isPending) return <ViewerStatus loading title="Opening the family tree…" />;
  if (tree.isError) return <ViewerStatus title="This private link is unavailable" message={errorMessage(tree.error)} />;

  const graph = tree.data.graph;
  const photoList = photos.data ?? [];
  const portraitUrls = new Map(photoList.flatMap((photo) => photo.isMain && photo.viewUrl
    ? [[photo.personId, photo.viewUrl] as const]
    : []));
  const focusedPerson = graph.people.find(({ id }) => id === searchParameters.get('person'));

  function openPerson(personId: string) {
    navigate(buildPrivateViewerPath(treeId, token!, personId));
  }

  function closeCard() {
    navigate(buildPrivateViewerPath(treeId, token!));
  }

  return (
    <div className="app-shell viewer-shell tree-workspace">
      <header className="app-header viewer-header">
        <span className="brand">
          <span className="brand-mark">F</span>
          <span><h1>{tree.data.name}</h1><small>{focusedPerson ? `${focusedPerson.firstName} ${focusedPerson.lastName}` : `${graph.people.length} people · Whole tree`}</small></span>
        </span>
        <div className="header-account">
          {focusedPerson && <button className="button button--quiet" type="button" onClick={closeCard}>Back to whole tree</button>}
          <span className="viewer-badge">Private link · view only</span>
        </div>
      </header>
      <main className="tree-workspace__body" aria-label="Family tree workspace">
        {graph.people.length ? (
          <section className="family-map-panel" aria-label="Family map">
            <div className={focusedPerson ? 'family-map-body has-person-card' : 'family-map-body'}>
              <FamilyTree
                graph={graph}
                portraitUrls={portraitUrls}
                selectedPersonId={focusedPerson?.id}
                onSelectPerson={openPerson}
              />
              {focusedPerson && (
                <PersonCard
                  graph={graph}
                  personId={focusedPerson.id}
                  onNavigate={openPerson}
                  onClose={closeCard}
                  photos={photoList}
                  photosLoading={photos.isPending}
                  photosError={photos.error}
                  onRefreshPhotos={() => void photos.refetch()}
                  onOpenPhotoViewer={() => navigate(buildPrivatePhotoViewerPath(treeId, focusedPerson.id, token!))}
                />
              )}
            </div>
          </section>
        ) : <div className="family-tree-state"><p>The organizer has not added anyone to this family album yet.</p></div>}
      </main>
      <footer className="viewer-privacy-note">Unlisted family tree · Anyone who receives this link can view it.</footer>
    </div>
  );
}

function ViewerStatus({ title, message, loading = false }: {
  title: string;
  message?: string;
  loading?: boolean;
}) {
  return (
    <div className="app-shell">
      <main className="page-center">
        <section className="status-card" role={loading ? 'status' : undefined}>
          {loading ? <div className="loading-orb" /> : <span className="brand-mark">F</span>}
          <h1>{title}</h1>
          {message && <p>{message}</p>}
        </section>
      </main>
    </div>
  );
}
