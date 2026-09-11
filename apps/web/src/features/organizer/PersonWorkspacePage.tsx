import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deriveSiblings, type AgeBucket, type Person } from '@family-tree/family-core';
import { Link, useNavigate, useParams } from 'react-router';
import {
  FamilyApiError,
  errorMessage,
  familyApi,
  type LoadedTree,
  type PhotoView,
} from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { PhotoGallery } from '../photos/PhotoGallery';
import { PendingPhotoCleanupError, convertPhotoToJpeg } from '../photos/photo-upload';
import {
  createPersonWorkspaceDraft,
  discoveryPrompts,
  factConflict,
  invariantChecks,
  treeOverviewPath,
  validatePersonWorkspaceDraft,
  type ChildrenKnowledge,
  type PersonRelationshipDraft,
  type PersonWorkspaceDraft,
} from '../people/person-workspace';
import type { PersonFormValues } from '../people/person-form';
import { treePersonYears } from '../tree/tree-person';
import { useAuth } from './auth-context';
import { OrganizerHeader } from './OrganizerHeader';
import { photoKeys, treeKeys } from './tree-queries';

export function PersonWorkspacePage() {
  const { treeId = '', personId } = useParams();
  const { session } = useAuth();
  const accessToken = session!.access_token;
  const userId = session!.user.id;
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

  if (tree.isPending) return <WorkspaceStatus title="Opening the person workspace…" />;
  if (tree.isError) return <WorkspaceFailure message={errorMessage(tree.error)} retry={() => void tree.refetch()} />;

  const person = personId ? tree.data.graph.people.find(({ id }) => id === personId) : undefined;
  if (personId && !person) {
    return (
      <div className="app-shell"><OrganizerHeader treeName={tree.data.name} context="Person not found" />
        <main className="page-center"><section className="status-card"><span className="eyebrow">Editing unavailable</span><h1>This person is not in the tree</h1><p>The record may have changed since this page was opened.</p><Link className="button button--primary" to={treeOverviewPath(treeId)}>Back to tree</Link></section></main>
      </div>
    );
  }

  return (
    <PersonWorkspace
      key={person?.id ?? 'new-person'}
      tree={tree.data}
      person={person}
      photos={photos.data ?? []}
      photosLoading={photos.isPending}
      photosError={photos.error}
      accessToken={accessToken}
      userId={userId}
      refreshPhotos={() => void photos.refetch()}
    />
  );
}

function PersonWorkspace({
  tree,
  person,
  photos,
  photosLoading,
  photosError,
  accessToken,
  userId,
  refreshPhotos,
}: {
  tree: LoadedTree;
  person?: Person;
  photos: PhotoView[];
  photosLoading: boolean;
  photosError: unknown;
  accessToken: string;
  userId: string;
  refreshPhotos: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PersonWorkspaceDraft>(() => createPersonWorkspaceDraft(tree.graph, person));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const validation = useMemo(
    () => validatePersonWorkspaceDraft(draft, tree.graph, new Date().getUTCFullYear(), person?.id),
    [draft, person?.id, tree.graph],
  );
  const conflict = factConflict(validation, tree.graph);
  const checks = invariantChecks(validation);
  const personPhotos = person ? photos.filter(({ personId }) => personId === person.id) : [];
  const prompts = discoveryPrompts(draft, personPhotos, person);
  const preview = previewPerson(draft.values, person, tree.graph.treeId);
  const portrait = personPhotos.find(({ isMain, viewUrl }) => isMain && viewUrl)?.viewUrl;
  const returnPath = treeOverviewPath(tree.id, person?.id);

  function updateValue<K extends keyof PersonFormValues>(field: K, value: PersonFormValues[K]) {
    setDraft((current) => ({ ...current, values: { ...current.values, [field]: value } }));
    setSaveError(null);
  }

  function updateRelationships(patch: Partial<PersonRelationshipDraft>) {
    setDraft((current) => ({
      ...current,
      relationships: { ...current.relationships, ...patch },
    }));
    setSaveError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.valid || !validation.input) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await familyApi.savePersonWorkspace(
        accessToken,
        tree.id,
        validation.input,
        {
          parentIds: draft.relationships.parentIds,
          partnerIds: draft.relationships.partnerIds,
          childIds: draft.relationships.childrenKnowledge === 'none' ? [] : draft.relationships.childIds,
        },
        person?.id,
      );
      queryClient.setQueryData<LoadedTree>(treeKeys.detail(userId, tree.id), (current) => current
        ? { ...current, graph: saved.graph }
        : current);
      await queryClient.invalidateQueries({ queryKey: treeKeys.detail(userId, tree.id) });
      navigate(treeOverviewPath(tree.id, saved.person.id), { replace: true });
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function refreshTreeAndPhotos(refreshTree = false) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: photoKeys.all(userId, tree.id) }),
      refreshTree ? queryClient.invalidateQueries({ queryKey: treeKeys.detail(userId, tree.id) }) : Promise.resolve(),
    ]);
  }

  async function uploadPhoto(file: File, ageBucket: AgeBucket, makeMain: boolean) {
    if (!person) return;
    const jpeg = await convertPhotoToJpeg(file);
    const upload = await familyApi.createPhotoUpload(accessToken, tree.id, person.id, jpeg.size);
    const { error } = await supabase.storage.from('family-photos').uploadToSignedUrl(
      upload.path,
      upload.token,
      jpeg,
      { cacheControl: '300', contentType: 'image/jpeg', upsert: false },
    );
    if (error) {
      const uploadError = new Error(`The photo upload failed: ${error.message}`);
      try {
        await familyApi.cleanupPhotoUpload(accessToken, tree.id, person.id, upload.photoId);
      } catch {
        throw pendingCleanupError(person.id, upload.photoId, uploadError);
      }
      throw uploadError;
    }
    try {
      await familyApi.completePhotoUpload(accessToken, tree.id, person.id, upload.photoId, ageBucket, makeMain);
    } catch (completionError) {
      try {
        await familyApi.cleanupPhotoUpload(accessToken, tree.id, person.id, upload.photoId);
      } catch (cleanupError) {
        if (cleanupError instanceof FamilyApiError && cleanupError.code === 'photo_already_published') {
          await refreshTreeAndPhotos(true);
          return;
        }
        throw pendingCleanupError(person.id, upload.photoId, completionError);
      }
      throw completionError;
    }
    await refreshTreeAndPhotos(makeMain);
  }

  function pendingCleanupError(personId: string, photoId: string, cause: unknown) {
    return new PendingPhotoCleanupError(
      `${errorMessage(cause)} The unfinished private upload still needs cleanup.`,
      () => familyApi.cleanupPhotoUpload(accessToken, tree.id, personId, photoId),
    );
  }

  async function setMainPhoto(photoId: string) {
    if (!person) return;
    await familyApi.setMainPhoto(accessToken, tree.id, person.id, photoId);
    await refreshTreeAndPhotos(true);
  }

  async function deletePhoto(photoId: string) {
    if (!person) return;
    await familyApi.deletePhoto(accessToken, tree.id, person.id, photoId);
    await refreshTreeAndPhotos(true);
  }

  const otherPeople = tree.graph.people.filter(({ id }) => id !== person?.id);
  const siblings = person ? deriveSiblings(validation.proposedGraph ?? tree.graph, person.id) : [];
  return (
    <div className="app-shell person-workspace">
      <OrganizerHeader treeName={tree.name} context={person ? `Editing ${person.firstName} ${person.lastName}` : 'Adding a person'}>
        <Link className="button button--quiet" to={returnPath}>Discard</Link>
        <button className="button button--primary" type="submit" form="person-workspace-form" disabled={!validation.valid || saving}>
          {saving ? 'Saving…' : 'Save person'}
        </button>
      </OrganizerHeader>
      <main className="person-workspace__body">
        <form id="person-workspace-form" className="person-workspace__form" onSubmit={(event) => void save(event)} noValidate>
          {(conflict || saveError) && (
            <div className="fact-conflict" role="alert"><span aria-hidden="true">!</span><div><strong>{conflict?.title ?? 'The person could not be saved'}</strong><p>{conflict?.detail ?? `${saveError} Your entered values are still here.`}</p></div></div>
          )}
          <div className="person-workspace__columns">
            <div className="person-workspace__column">
              <EditorSection title="Identity">
                <div className="form-grid form-grid--two">
                  <Field label="First name" error={validation.form.fieldErrors.firstName}><input value={draft.values.firstName} onChange={(event) => updateValue('firstName', event.target.value)} required /></Field>
                  <Field label="Last name" error={validation.form.fieldErrors.lastName}><input value={draft.values.lastName} onChange={(event) => updateValue('lastName', event.target.value)} required /></Field>
                </div>
                <div className="life-status-field"><span className="field-label">Life status</span><div className="segmented segmented--wide" aria-label="Life status">
                  {(['living', 'deceased', 'unknown'] as const).map((status) => <button key={status} className={draft.values.lifeStatus === status ? 'is-active' : ''} type="button" aria-pressed={draft.values.lifeStatus === status} onClick={() => {
                    updateValue('lifeStatus', status);
                    if (status === 'living') updateValue('deathYear', '');
                  }}>{status[0].toUpperCase() + status.slice(1)}</button>)}
                </div><small>Always set by hand — never guessed from a birth year.</small></div>
                <div className="form-grid form-grid--two">
                  <Field label="Birth year" hint="Leave blank when unknown" error={validation.form.fieldErrors.birthYear}><input inputMode="numeric" value={draft.values.birthYear} placeholder="e.g. 1952" onChange={(event) => updateValue('birthYear', event.target.value)} /></Field>
                  <Field label="Death year" hint={draft.values.lifeStatus === 'living' ? 'Not applicable when living' : 'Leave blank when unknown'} error={validation.form.fieldErrors.deathYear}><input inputMode="numeric" value={draft.values.deathYear} placeholder="e.g. 2019" disabled={draft.values.lifeStatus === 'living'} onChange={(event) => updateValue('deathYear', event.target.value)} /></Field>
                </div>
                <label className="checkbox-card"><input type="checkbox" checked={draft.values.adopted} onChange={(event) => updateValue('adopted', event.target.checked)} /><span><strong>Adopted</strong><small>Shows a positive badge without changing family connections.</small></span></label>
              </EditorSection>

              <EditorSection title={`Fun facts · ${draft.values.funFacts.filter((fact) => fact.trim()).length} of 3`}>
                <div className="workspace-facts">{draft.values.funFacts.map((fact, index) => <Field key={index} label={`Fact ${index + 1}`}><input value={fact} maxLength={180} placeholder={index ? 'Add another memory' : 'Owned a bakery in Lyon'} onChange={(event) => {
                  const funFacts = [...draft.values.funFacts] as PersonFormValues['funFacts'];
                  funFacts[index] = event.target.value;
                  updateValue('funFacts', funFacts);
                }} /></Field>)}</div>
              </EditorSection>
            </div>

            <div className="person-workspace__column">
              <EditorSection title="Photos">
                {person ? <PhotoGallery
                  person={person}
                  photos={personPhotos}
                  loading={photosLoading}
                  loadError={photosError}
                  onRefresh={refreshPhotos}
                  onUpload={uploadPhoto}
                  onSetMain={setMainPhoto}
                  onDelete={deletePhoto}
                /> : <div className="workspace-empty"><span aria-hidden="true">◌</span><strong>Photos follow the person record</strong><p>Save this person first, then reopen their editing workspace to add a main portrait and life-stage photos.</p></div>}
              </EditorSection>

              <EditorSection title="Family">
                <RelationshipChooser title="Parents" note="Maximum 2" people={otherPeople} selectedIds={draft.relationships.parentIds} max={2} onChange={(parentIds) => updateRelationships({ parentIds })} />
                <KnowledgeToggle label="All selected parents are known" checked={draft.values.parentsComplete} onChange={(checked) => updateValue('parentsComplete', checked)} />
                <RelationshipChooser title="Partners" people={otherPeople} selectedIds={draft.relationships.partnerIds} onChange={(partnerIds) => updateRelationships({ partnerIds })} />
                <KnowledgeToggle label="All selected partners are known" checked={draft.values.partnersComplete} onChange={(checked) => updateValue('partnersComplete', checked)} />
                <div className="relationship-draft-card">
                  <div className="relationship-draft-card__heading"><strong>Children</strong><ChildrenControl knowledge={draft.relationships.childrenKnowledge} count={draft.relationships.childIds.length} onChange={(childrenKnowledge) => {
                    updateValue('childrenComplete', childrenKnowledge !== 'unknown');
                    updateRelationships({ childrenKnowledge, ...(childrenKnowledge === 'none' ? { childIds: [] } : {}) });
                  }} /></div>
                  {draft.relationships.childrenKnowledge === 'none' ? <p className="known-absence">No children</p> : <PersonChoices people={otherPeople} selectedIds={draft.relationships.childIds} onChange={(childIds) => {
                    updateRelationships({ childIds, ...(childIds.length && draft.relationships.childrenKnowledge === 'none' ? { childrenKnowledge: 'known' } : {}) });
                  }} />}
                </div>
                <div className="derived-card"><span className="eyebrow">Derived, not editable</span><strong>Siblings</strong><p>{siblings.length ? siblings.map(({ person: sibling, type }) => `${sibling.firstName} ${sibling.lastName} (${type})`).join(', ') : 'No siblings can be derived from the selected parent relationships yet.'}</p></div>
              </EditorSection>
            </div>
          </div>
        </form>

        <aside className="person-workspace__rail" aria-label="Live person preview and checks">
          <section><span className="eyebrow">What relatives will see</span><div className="node-preview-stage"><div className="tree-person node-preview"><div className={preview.lifeStatus === 'deceased' ? 'tree-person__portrait is-remembered' : 'tree-person__portrait'}>{portrait ? <img src={portrait} alt="" onError={refreshPhotos} /> : <span>{initials(preview)}</span>}</div><div className="tree-person__identity"><strong>{preview.firstName || 'First name'}</strong><span>{preview.lastName || 'Last name'}</span><small>{treePersonYears(preview)}</small></div>{preview.adopted && <span className="tree-badge tree-person__adoption">Adopted</span>}</div></div><p className="rail-copy">This preview updates as the person’s facts change.</p></section>
          <section><span className="eyebrow">Rules checked as you type</span><div className="invariant-list">{checks.map((check) => <div className={check.valid ? '' : 'is-conflict'} key={check.label}><span aria-hidden="true">{check.valid ? '✓' : '!'}</span><p>{check.label}</p></div>)}</div><p className="rail-copy">The server repeats every check under the tree lock when you save.</p></section>
          <section><span className="eyebrow">Still to discover</span>{prompts.length ? <div className="discovery-list">{prompts.map((prompt) => <p key={prompt}><span className="discovery-dot" aria-hidden="true" />{prompt}</p>)}</div> : <p className="rail-copy">This record is beautifully complete for now.</p>}<p className="rail-copy">Invitations only — missing information never blocks a save.</p></section>
        </aside>
      </main>
    </div>
  );
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="workspace-editor-section"><h2>{title}</h2>{children}</section>;
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label>{label}{children}{error ? <small className="field-error">{error}</small> : hint ? <small>{hint}</small> : null}</label>;
}

function KnowledgeToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="knowledge-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span><small>{checked ? 'Known complete' : 'Unknown or incomplete'}</small></label>;
}

function RelationshipChooser({ title, note, people, selectedIds, max, onChange }: { title: string; note?: string; people: Person[]; selectedIds: string[]; max?: number; onChange: (ids: string[]) => void }) {
  return <div className="relationship-draft-card"><div className="relationship-draft-card__heading"><strong>{title}</strong>{note && <small>{note}</small>}</div><PersonChoices people={people} selectedIds={selectedIds} max={max} onChange={onChange} /></div>;
}

function PersonChoices({ people, selectedIds, max, onChange }: { people: Person[]; selectedIds: string[]; max?: number; onChange: (ids: string[]) => void }) {
  if (!people.length) return <p className="muted">Add another person to make a selection.</p>;
  return <div className="person-choices">{people.map((candidate) => {
    const selected = selectedIds.includes(candidate.id);
    const disabled = !selected && max !== undefined && selectedIds.length >= max;
    return <label className={selected ? 'is-selected' : ''} key={candidate.id}><input type="checkbox" checked={selected} disabled={disabled} onChange={(event) => onChange(event.target.checked ? [...selectedIds, candidate.id] : selectedIds.filter((id) => id !== candidate.id))} /><span><strong>{candidate.firstName} {candidate.lastName}</strong><small>{treePersonYears(candidate)}</small></span></label>;
  })}</div>;
}

function ChildrenControl({ knowledge, count, onChange }: { knowledge: ChildrenKnowledge; count: number; onChange: (knowledge: ChildrenKnowledge) => void }) {
  return <div className="segmented children-control" aria-label="Children knowledge">{([
    ['known', `${count} known`], ['none', 'No children'], ['unknown', 'Unknown'],
  ] as const).map(([value, label]) => <button key={value} className={knowledge === value ? 'is-active' : ''} type="button" disabled={value === 'known' && count === 0} aria-pressed={knowledge === value} onClick={() => onChange(value)}>{label}</button>)}</div>;
}

function previewPerson(values: PersonFormValues, person: Person | undefined, treeId: string): Person {
  const numberOrNull = (value: string) => /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  return {
    id: person?.id ?? '__preview__', treeId,
    firstName: values.firstName.trim(), lastName: values.lastName.trim(), lifeStatus: values.lifeStatus,
    birthYear: numberOrNull(values.birthYear), deathYear: numberOrNull(values.deathYear),
    adopted: values.adopted, mainPhotoId: person?.mainPhotoId ?? null,
    funFacts: values.funFacts.filter(Boolean), parentsComplete: values.parentsComplete,
    partnersComplete: values.partnersComplete, childrenComplete: values.childrenComplete,
  };
}

function initials(person: Person) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase() || '?';
}

function WorkspaceStatus({ title }: { title: string }) {
  return <div className="app-shell"><OrganizerHeader /><main className="page-center"><section className="status-card" role="status"><div className="loading-orb" /><h1>{title}</h1></section></main></div>;
}

function WorkspaceFailure({ message, retry }: { message: string; retry: () => void }) {
  return <div className="app-shell"><OrganizerHeader /><main className="page-center"><section className="status-card"><span className="eyebrow">Workspace unavailable</span><h1>We couldn’t open this person</h1><p>{message}</p><div className="button-row"><button className="button button--secondary" type="button" onClick={retry}>Try again</button><Link className="button button--quiet" to="/organizer">Back to trees</Link></div></section></main></div>;
}
