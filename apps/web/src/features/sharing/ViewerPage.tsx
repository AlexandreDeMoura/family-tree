import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { errorMessage, familyApi } from '../../lib/api';
import { PersonCard } from '../people/PersonCard';
import { FamilyTree } from '../tree/FamilyTree';
import { readPrivateViewerToken } from './share-link';

export function ViewerPage() {
  const { treeId = '' } = useParams();
  const [token, setToken] = useState(() => readPrivateViewerToken(window.location.hash));
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const readHash = () => setToken(readPrivateViewerToken(window.location.hash));
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

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
  const focusedPerson = graph.people.find(({ id }) => id === focusedId);

  return (
    <div className="app-shell viewer-shell">
      <header className="app-header viewer-header">
        <span className="brand">
          <span className="brand-mark">F</span>
          <span><strong>{tree.data.name}</strong><small>Private family view</small></span>
        </span>
        <span className="viewer-badge">Read only</span>
      </header>
      <main className="viewer-workspace">
        <section className="viewer-intro">
          <span className="eyebrow">Shared with you privately</span>
          <h1>{focusedPerson ? `Exploring ${focusedPerson.firstName}'s family` : tree.data.name}</h1>
          <p>{focusedPerson
            ? 'Immediate family stays prominent. Select another relative to keep exploring, or return to the whole tree.'
            : 'Select a person to discover their relationships, photos, and family stories. You can pan, zoom, and browse without an account.'}</p>
          {focusedPerson && <button className="button button--quiet" type="button" onClick={() => setFocusedId(null)}>Show whole tree</button>}
        </section>
        {graph.people.length ? (
          <section className="panel family-map-panel">
            <div className={focusedPerson ? 'family-map-body has-person-card' : 'family-map-body'}>
              <FamilyTree
                graph={graph}
                portraitUrls={portraitUrls}
                selectedPersonId={focusedPerson?.id}
                onSelectPerson={setFocusedId}
              />
              {focusedPerson && (
                <PersonCard
                  graph={graph}
                  personId={focusedPerson.id}
                  onNavigate={setFocusedId}
                  onClose={() => setFocusedId(null)}
                  photos={photoList}
                  photosLoading={photos.isPending}
                  photosError={photos.error}
                  onRefreshPhotos={() => void photos.refetch()}
                />
              )}
            </div>
          </section>
        ) : <ViewerStatus title="This family tree is still taking root" message="The organizer has not added anyone yet." />}
        <p className="viewer-privacy-note">This is an unlisted private link. Anyone who receives it can view this tree.</p>
      </main>
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
