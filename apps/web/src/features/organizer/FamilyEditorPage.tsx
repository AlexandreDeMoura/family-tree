import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import type { AgeBucket, Person } from '@family-tree/family-core';
import {
  FamilyApiError,
  errorMessage,
  familyApi,
  type LoadedTree,
  type PersonInput,
} from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { PendingPhotoCleanupError, convertPhotoToJpeg } from '../photos/photo-upload';
import { PersonForm } from '../people/PersonForm';
import { PersonCard } from '../people/PersonCard';
import { RelationshipPanel } from '../people/RelationshipPanel';
import type { RelationshipKind } from '../people/relationship-form';
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
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [panel, setPanel] = useState<'people' | 'share' | null>(null);
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

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: treeKeys.detail(userId, treeId) });
  }

  async function refreshPhotos() {
    await queryClient.invalidateQueries({ queryKey: photoKeys.all(userId, treeId) });
  }

  async function uploadPhoto(personId: string, file: File, ageBucket: AgeBucket, makeMain: boolean) {
    const jpeg = await convertPhotoToJpeg(file);
    const upload = await familyApi.createPhotoUpload(accessToken, treeId, personId, jpeg.size);
    const { error } = await supabase.storage
      .from('family-photos')
      .uploadToSignedUrl(upload.path, upload.token, jpeg, {
        cacheControl: '300',
        contentType: 'image/jpeg',
        upsert: false,
      });
    if (error) {
      const uploadError = new Error(`The photo upload failed: ${error.message}`);
      try {
        await familyApi.cleanupPhotoUpload(accessToken, treeId, personId, upload.photoId);
      } catch {
        throw pendingCleanupError(personId, upload.photoId, uploadError);
      }
      throw uploadError;
    }
    try {
      await familyApi.completePhotoUpload(
        accessToken,
        treeId,
        personId,
        upload.photoId,
        ageBucket,
        makeMain,
      );
    } catch (completionError) {
      try {
        await familyApi.cleanupPhotoUpload(accessToken, treeId, personId, upload.photoId);
      } catch (cleanupError) {
        // A lost completion response can leave a valid published record. In
        // that case cleanup correctly refuses to remove it; refreshing reveals it.
        if (cleanupError instanceof FamilyApiError && cleanupError.code === 'photo_already_published') {
          await Promise.all([refreshPhotos(), refresh()]);
          return;
        }
        throw pendingCleanupError(personId, upload.photoId, completionError);
      }
      throw completionError;
    }
    await Promise.all([refreshPhotos(), makeMain ? refresh() : Promise.resolve()]);
  }

  function pendingCleanupError(personId: string, photoId: string, cause: unknown) {
    return new PendingPhotoCleanupError(
      `${errorMessage(cause)} The unfinished private upload still needs cleanup.`,
      () => familyApi.cleanupPhotoUpload(accessToken, treeId, personId, photoId),
    );
  }

  async function setMainPhoto(personId: string, photoId: string) {
    await familyApi.setMainPhoto(accessToken, treeId, personId, photoId);
    await Promise.all([refreshPhotos(), refresh()]);
  }

  async function deletePhoto(personId: string, photoId: string) {
    await familyApi.deletePhoto(accessToken, treeId, personId, photoId);
    await Promise.all([refreshPhotos(), refresh()]);
  }

  async function savePerson(input: PersonInput, person?: Person) {
    const saved = person
      ? await familyApi.editPerson(accessToken, treeId, person.id, input)
      : await familyApi.createPerson(accessToken, treeId, input);
    await refresh();
    return saved;
  }

  async function addRelationship(kind: RelationshipKind, firstId: string, secondId: string) {
    const graph = kind === 'parent'
      ? await familyApi.addParent(accessToken, treeId, firstId, secondId)
      : await familyApi.addPartner(accessToken, treeId, firstId, secondId);
    queryClient.setQueryData<LoadedTree>(treeKeys.detail(userId, treeId), (current) => current ? { ...current, graph } : current);
    await refresh();
  }

  async function removeParent(parentId: string, childId: string) {
    const graph = await familyApi.removeParent(accessToken, treeId, parentId, childId);
    queryClient.setQueryData<LoadedTree>(treeKeys.detail(userId, treeId), (current) => current ? { ...current, graph } : current);
    await refresh();
  }

  async function removePartner(person1Id: string, person2Id: string) {
    const graph = await familyApi.removePartner(accessToken, treeId, person1Id, person2Id);
    queryClient.setQueryData<LoadedTree>(treeKeys.detail(userId, treeId), (current) => current ? { ...current, graph } : current);
    await refresh();
  }

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
  const effectiveSelectedId = selectedId ?? graph.people[0]?.id ?? null;
  const selectedPerson = graph.people.find(({ id }) => id === effectiveSelectedId);
  const focusedPerson = graph.people.find(({ id }) => id === focusedId);
  const showCreate = creating || graph.people.length === 0;
  const activePanel = panel ?? (graph.people.length === 0 ? 'people' : null);

  function openPerson(personId: string) {
    setSelectedId(personId);
    setFocusedId(personId);
    setCreating(false);
  }

  function startCreating() {
    setFocusedId(null);
    setCreating(true);
    setPanel('people');
  }

  return (
    <div className="app-shell tree-workspace">
      <OrganizerHeader treeName={tree.data.name} context={focusedPerson ? `${focusedPerson.firstName} ${focusedPerson.lastName}` : `${graph.people.length} people · Whole tree`}>
        {focusedPerson && <button className="button button--quiet" type="button" onClick={() => setFocusedId(null)}>Back to whole tree</button>}
        <button className="button button--quiet" type="button" aria-expanded={activePanel === 'people'} aria-controls="people-tools" onClick={() => setPanel(panel === 'people' ? null : 'people')}>People & editing</button>
        <button className="button button--quiet" type="button" aria-expanded={activePanel === 'share'} aria-controls="share-tools" onClick={() => setPanel(panel === 'share' ? null : 'share')}>Share tree</button>
        <button className="button button--primary" type="button" onClick={startCreating}>+ Add person</button>
      </OrganizerHeader>
      <main className="tree-workspace__body" aria-label="Family tree workspace">
        <section className="family-map-panel" aria-label="Family map">
          <div className={focusedPerson && !showCreate && !activePanel ? 'family-map-body has-person-card' : 'family-map-body'}>
            <FamilyTree
              graph={graph}
              portraitUrls={portraitUrls}
              selectedPersonId={showCreate ? null : focusedPerson?.id}
              onSelectPerson={openPerson}
            />
            {focusedPerson && !showCreate && !activePanel && (
              <PersonCard
                graph={graph}
                personId={focusedPerson.id}
                onNavigate={openPerson}
                onClose={() => setFocusedId(null)}
                onEdit={() => setPanel('people')}
                photos={photoList}
                photosLoading={photos.isPending}
                photosError={photos.error}
                onRefreshPhotos={() => void photos.refetch()}
                onUploadPhoto={(file, ageBucket, makeMain) => uploadPhoto(focusedPerson.id, file, ageBucket, makeMain)}
                onSetMainPhoto={(photoId) => setMainPhoto(focusedPerson.id, photoId)}
                onDeletePhoto={(photoId) => deletePhoto(focusedPerson.id, photoId)}
              />
            )}
          </div>
        </section>
        <aside className="workspace-tools" id="people-tools" aria-label="People and editing" hidden={activePanel !== 'people'}>
          <div className="workspace-tools__heading">
            <h2>{showCreate ? 'Add to the family' : 'People & editing'}</h2>
            {graph.people.length > 0 && <button className="button button--quiet" type="button" onClick={() => { setCreating(false); setPanel(null); }}>Close</button>}
          </div>
          <div className="people-sidebar">
            {graph.people.length === 0 ? (
              <div className="sidebar-empty"><span aria-hidden="true">✦</span><strong>No people yet</strong><p>Add the first person to begin this family story.</p></div>
            ) : (
              <nav className="people-list" aria-label="People in this tree">
                {graph.people.map((person) => (
                  <button
                    key={person.id}
                    className={person.id === effectiveSelectedId && !showCreate ? 'person-list-item is-active' : 'person-list-item'}
                    type="button"
                    onClick={() => openPerson(person.id)}
                  >
                    <span className="person-avatar">{portraitUrls.get(person.id)
                      ? <img src={portraitUrls.get(person.id)} alt="" onError={() => void photos.refetch()} />
                      : <>{person.firstName.charAt(0)}{person.lastName.charAt(0)}</>}</span>
                    <span><strong>{person.firstName} {person.lastName}</strong><small>{person.birthYear ?? 'Year unknown'} · {lifeLabel(person)}</small></span>
                    {isIncomplete(person) && <span className="discovery-dot" role="img" aria-label="More to discover" title="Some family information is still unknown" />}
                  </button>
                ))}
              </nav>
            )}
            {graph.people.length > 0 && <button className="button button--secondary button--wide sidebar-add" type="button" onClick={startCreating}>+ Add another person</button>}
          </div>
          <section className="panel">
            <PersonForm
              key={showCreate ? 'new-person' : selectedPerson?.id}
              graph={graph}
              person={showCreate ? undefined : selectedPerson}
              onSave={(input) => savePerson(input, showCreate ? undefined : selectedPerson)}
              onSaved={(person) => { setSelectedId(person.id); setFocusedId(person.id); setCreating(false); setPanel(null); }}
              onCancel={graph.people.length ? () => { setCreating(false); setPanel(null); } : undefined}
            />
          </section>
          <RelationshipPanel
            graph={graph}
            selectedPerson={showCreate ? undefined : selectedPerson}
            onAdd={addRelationship}
            onRemoveParent={removeParent}
            onRemovePartner={removePartner}
          />
        </aside>
        <aside className="workspace-tools" id="share-tools" aria-label="Private sharing" hidden={activePanel !== 'share'}>
          <div className="workspace-tools__heading"><h2>Share the family</h2><button className="button button--quiet" type="button" onClick={() => setPanel(null)}>Close</button></div>
          <SharePanel accessToken={accessToken} treeId={treeId} userId={userId} />
        </aside>
      </main>
    </div>
  );
}

function lifeLabel(person: Person) {
  if (person.lifeStatus === 'living') return 'Living';
  if (person.lifeStatus === 'deceased') return person.deathYear ? `Died ${person.deathYear}` : 'Deceased';
  return 'Status unknown';
}

function isIncomplete(person: Person) {
  return person.birthYear === null
    || person.lifeStatus === 'unknown'
    || !person.parentsComplete
    || !person.partnersComplete
    || !person.childrenComplete;
}
