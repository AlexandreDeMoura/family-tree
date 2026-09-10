import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import type { Person } from '@family-tree/family-core';
import { errorMessage, familyApi, type LoadedTree, type PersonInput } from '../../lib/api';
import { PersonForm } from '../people/PersonForm';
import { PersonCard } from '../people/PersonCard';
import { RelationshipPanel } from '../people/RelationshipPanel';
import type { RelationshipKind } from '../people/relationship-form';
import { FamilyTree } from '../tree/FamilyTree';
import { useAuth } from './auth-context';
import { OrganizerHeader } from './OrganizerHeader';
import { treeKeys } from './tree-queries';

export function FamilyEditorPage() {
  const { treeId = '' } = useParams();
  const { session } = useAuth();
  const accessToken = session!.access_token;
  const userId = session!.user.id;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const tree = useQuery({
    queryKey: treeKeys.detail(userId, treeId),
    queryFn: () => familyApi.loadTree(accessToken, treeId),
    enabled: Boolean(treeId),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: treeKeys.detail(userId, treeId) });
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
  const effectiveSelectedId = selectedId ?? graph.people[0]?.id ?? null;
  const selectedPerson = graph.people.find(({ id }) => id === effectiveSelectedId);
  const focusedPerson = graph.people.find(({ id }) => id === focusedId);
  const showCreate = creating || graph.people.length === 0;

  function openPerson(personId: string) {
    setSelectedId(personId);
    setFocusedId(personId);
    setCreating(false);
  }

  function startCreating() {
    setFocusedId(null);
    setCreating(true);
  }

  return (
    <div className="app-shell">
      <OrganizerHeader treeName={tree.data.name} />
      <main className="editor-layout">
        <aside className="people-sidebar">
          <div className="sidebar-heading">
            <div><Link className="back-link" to="/organizer">← All trees</Link><h1>{tree.data.name}</h1><p>{graph.people.length} {graph.people.length === 1 ? 'person' : 'people'}</p></div>
            <button className="icon-button" type="button" title="Add person" aria-label="Add person" onClick={startCreating}>+</button>
          </div>
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
                  <span className="person-avatar">{person.firstName.charAt(0)}{person.lastName.charAt(0)}</span>
                  <span><strong>{person.firstName} {person.lastName}</strong><small>{person.birthYear ?? 'Year unknown'} · {lifeLabel(person)}</small></span>
                  {isIncomplete(person) && <span className="discovery-dot" title="Some family information is still unknown">✦</span>}
                </button>
              ))}
            </nav>
          )}
          {graph.people.length > 0 && <button className="button button--secondary button--wide sidebar-add" type="button" onClick={startCreating}>+ Add another person</button>}
        </aside>

        <div className="editor-main">
          {graph.people.length > 0 && (
            <section className="panel family-map-panel">
              <div className="family-map-heading">
                <div>
                  <span className="eyebrow">{focusedPerson ? 'Person focus' : 'Family map'}</span>
                  <h2>{focusedPerson ? `Exploring ${focusedPerson.firstName}'s family` : 'See the whole family at a glance'}</h2>
                  <p>{focusedPerson
                    ? 'Immediate family stays prominent while the broader tree remains in view. Select anyone nearby to continue exploring.'
                    : 'Select a person to open their story. Use the map controls to pan, zoom, or fit everyone into view.'}</p>
                </div>
                {focusedPerson ? (
                  <button className="button button--quiet" type="button" onClick={() => setFocusedId(null)}>Show whole tree</button>
                ) : <span className="count-pill">Automatic layout</span>}
              </div>
              <div className={focusedPerson && !showCreate ? 'family-map-body has-person-card' : 'family-map-body'}>
                <FamilyTree
                  graph={graph}
                  selectedPersonId={showCreate ? null : focusedPerson?.id}
                  onSelectPerson={openPerson}
                />
                {focusedPerson && !showCreate && (
                  <PersonCard
                    graph={graph}
                    personId={focusedPerson.id}
                    onNavigate={openPerson}
                    onClose={() => setFocusedId(null)}
                  />
                )}
              </div>
            </section>
          )}
          <section className="panel">
            <PersonForm
              key={showCreate ? 'new-person' : selectedPerson?.id}
              graph={graph}
              person={showCreate ? undefined : selectedPerson}
              onSave={(input) => savePerson(input, showCreate ? undefined : selectedPerson)}
              onSaved={(person) => { setSelectedId(person.id); setFocusedId(person.id); setCreating(false); }}
              onCancel={creating && graph.people.length ? () => setCreating(false) : undefined}
            />
          </section>
          <RelationshipPanel
            graph={graph}
            selectedPerson={showCreate ? undefined : selectedPerson}
            onAdd={addRelationship}
            onRemoveParent={removeParent}
            onRemovePartner={removePartner}
          />
        </div>
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
