import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { errorMessage, familyApi } from '../../lib/api';
import { PersonCard } from '../people/PersonCard';
import { personWorkspacePath } from '../people/person-workspace';
import { FamilyTree } from '../tree/FamilyTree';
import { SharePanel } from '../sharing/SharePanel';
import { useAuth } from './auth-context';
import { OrganizerHeader } from './OrganizerHeader';
import { photoKeys, treeKeys } from './tree-queries';

export function FamilyEditorPage() {
  const { treeId = '' } = useParams();
  const { session } = useAuth();
  const accessToken = session!.access_token;
  const userId = session!.user.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedId, setFocusedId] = useState<string | null>(() => searchParams.get('person'));
  const [shareOpen, setShareOpen] = useState(false);
  const tree = useQuery({
    queryKey: treeKeys.detail(userId, treeId),
    queryFn: () => familyApi.loadTree(accessToken, treeId),
    enabled: Boolean(treeId),
  });
  const photos = useQuery({
    queryKey: photoKeys.all(userId, treeId),
    queryFn: () => familyApi.listPhotos(accessToken, treeId),
    enabled: Boolean(treeId) && tree.isSuccess,
    staleTime: 4 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
  });

  if (tree.isPending) {
    return <div className="app-shell"><OrganizerHeader /><main className="page-center"><section className="status-card" role="status"><div className="loading-orb" /><h1>Loading the family record…</h1></section></main></div>;
  }
  if (tree.isError) {
    return (
      <div className="app-shell">
        <OrganizerHeader />
        <main className="page-center">
          <section className="status-card"><span className="eyebrow">Family tree unavailable</span><h1>We couldn't open this tree</h1><p>{errorMessage(tree.error)}</p><div className="button-row"><button className="button button--secondary" type="button" onClick={() => void tree.refetch()}>Try again</button><Link className="button button--quiet" to="/organizer">Back to trees</Link></div></section>
        </main>
      </div>
    );
  }

  const graph = tree.data.graph;
  const photoList = photos.data ?? [];
  const portraitUrls = new Map(photoList.flatMap((photo) => photo.isMain && photo.viewUrl
    ? [[photo.personId, photo.viewUrl] as const]
    : []));
  const focusedPerson = graph.people.find(({ id }) => id === focusedId);

  function openPerson(personId: string) {
    setFocusedId(personId);
    setShareOpen(false);
    setSearchParams({ person: personId }, { replace: true });
  }

  function closeFocus() {
    setFocusedId(null);
    setSearchParams({}, { replace: true });
  }

  return (
    <div className="app-shell tree-workspace">
      <OrganizerHeader treeName={tree.data.name} context={focusedPerson ? `${focusedPerson.firstName} ${focusedPerson.lastName}` : `${graph.people.length} people · Whole tree`}>
        {focusedPerson && <button className="button button--quiet" type="button" onClick={closeFocus}>Back to whole tree</button>}
        <button className="button button--quiet" type="button" aria-expanded={shareOpen} aria-controls="share-tools" onClick={() => setShareOpen((open) => !open)}>Share tree</button>
        <button className="button button--primary" type="button" onClick={() => navigate(personWorkspacePath(treeId))}>+ Add person</button>
      </OrganizerHeader>
      <main className="tree-workspace__body" aria-label="Family tree overview">
        <section className="family-map-panel" aria-label="Family map">
          <div className={focusedPerson && !shareOpen ? 'family-map-body has-person-card' : 'family-map-body'}>
            <FamilyTree graph={graph} portraitUrls={portraitUrls} selectedPersonId={focusedPerson?.id} onSelectPerson={openPerson} />
            {focusedPerson && !shareOpen && (
              <PersonCard
                graph={graph}
                personId={focusedPerson.id}
                onNavigate={openPerson}
                onClose={closeFocus}
                onEdit={() => navigate(personWorkspacePath(treeId, focusedPerson.id))}
                photos={photoList}
                photosLoading={photos.isPending}
                photosError={photos.error}
                onRefreshPhotos={() => void photos.refetch()}
              />
            )}
          </div>
        </section>
        <aside className="workspace-tools" id="share-tools" aria-label="Private sharing" hidden={!shareOpen}>
          <div className="workspace-tools__heading"><h2>Share the family</h2><button className="button button--quiet" type="button" onClick={() => setShareOpen(false)}>Close</button></div>
          <SharePanel accessToken={accessToken} treeId={treeId} userId={userId} />
        </aside>
      </main>
    </div>
  );
}
