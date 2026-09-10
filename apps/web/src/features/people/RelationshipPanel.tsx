import { useMemo, useState, type FormEvent } from 'react';
import { deriveSiblings, type FamilyGraph, type Person } from '@family-tree/family-core';
import { errorMessage } from '../../lib/api';
import { validateRelationshipDraft, type RelationshipKind } from './relationship-form';

interface RelationshipPanelProps {
  graph: FamilyGraph;
  selectedPerson?: Person;
  onAdd: (kind: RelationshipKind, firstId: string, secondId: string) => Promise<void>;
  onRemoveParent: (parentId: string, childId: string) => Promise<void>;
  onRemovePartner: (person1Id: string, person2Id: string) => Promise<void>;
}

export function RelationshipPanel({
  graph, selectedPerson, onAdd, onRemoveParent, onRemovePartner,
}: RelationshipPanelProps) {
  const [kind, setKind] = useState<RelationshipKind>('parent');
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const names = useMemo(() => new Map(graph.people.map((person) => [person.id, `${person.firstName} ${person.lastName}`])), [graph.people]);
  const siblings = selectedPerson ? deriveSiblings(graph, selectedPerson.id) : [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateRelationshipDraft(
      graph, kind, firstId, secondId, new Date().getUTCFullYear(),
    );
    setError(validationError);
    if (validationError) return;
    setSaving(true);
    try {
      await onAdd(kind, firstId, secondId);
      setFirstId('');
      setSecondId('');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function remove(work: () => Promise<void>) {
    setError(null);
    try {
      await work();
    } catch (removeError) {
      setError(errorMessage(removeError));
    }
  }

  if (graph.people.length < 2) {
    return (
      <section className="panel relationship-panel">
        <div className="section-heading"><div><span className="eyebrow">Connections</span><h2>Build the family structure</h2></div></div>
        <div className="empty-inline"><strong>Add one more person</strong><p>Two people are needed before you can define a parent or partner connection.</p></div>
      </section>
    );
  }

  return (
    <section className="panel relationship-panel">
      <div className="section-heading">
        <div><span className="eyebrow">Connections</span><h2>Family relationships</h2></div>
        <span className="count-pill">{graph.parentChild.length + graph.partnerships.length} saved</span>
      </div>

      <form className="relationship-builder" onSubmit={submit}>
        <div className="segmented" aria-label="Relationship type">
          <button type="button" className={kind === 'parent' ? 'is-active' : ''} onClick={() => { setKind('parent'); setError(null); }}>Parent → child</button>
          <button type="button" className={kind === 'partner' ? 'is-active' : ''} onClick={() => { setKind('partner'); setError(null); }}>Partners</button>
        </div>
        <div className="relationship-fields">
          <PersonSelect
            label={kind === 'parent' ? 'Parent' : 'First partner'}
            people={graph.people}
            value={firstId}
            onChange={(value) => { setFirstId(value); setError(null); }}
          />
          <span className="relationship-arrow" aria-hidden="true">{kind === 'parent' ? '→' : '+'}</span>
          <PersonSelect
            label={kind === 'parent' ? 'Child' : 'Second partner'}
            people={graph.people}
            value={secondId}
            onChange={(value) => { setSecondId(value); setError(null); }}
          />
          <button className="button button--secondary" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add connection'}</button>
        </div>
        {error && <div className="alert alert--error" role="alert">{error}</div>}
        <p className="form-note">Sibling relationships are derived automatically from shared parents and cannot be edited directly.</p>
      </form>

      <div className="relationships-list">
        <RelationshipGroup title="Parents & children" empty="No parent connections yet.">
          {graph.parentChild.map((edge) => (
            <RelationshipRow
              key={`${edge.parentId}-${edge.childId}`}
              first={names.get(edge.parentId) ?? 'Unknown person'}
              connector="parent of"
              second={names.get(edge.childId) ?? 'Unknown person'}
              onRemove={() => remove(() => onRemoveParent(edge.parentId, edge.childId))}
            />
          ))}
        </RelationshipGroup>
        <RelationshipGroup title="Partners" empty="No partner connections yet.">
          {graph.partnerships.map((edge) => (
            <RelationshipRow
              key={`${edge.person1Id}-${edge.person2Id}`}
              first={names.get(edge.person1Id) ?? 'Unknown person'}
              connector="partner of"
              second={names.get(edge.person2Id) ?? 'Unknown person'}
              onRemove={() => remove(() => onRemovePartner(edge.person1Id, edge.person2Id))}
            />
          ))}
        </RelationshipGroup>
      </div>

      {selectedPerson && (
        <div className="derived-card">
          <span className="eyebrow">Derived, not stored</span>
          <strong>{selectedPerson.firstName}'s siblings</strong>
          <p>{siblings.length
            ? siblings.map(({ person, type }) => `${person.firstName} ${person.lastName} (${type})`).join(', ')
            : 'No siblings can be derived from the known parent connections.'}</p>
        </div>
      )}
    </section>
  );
}

function PersonSelect({ label, people, value, onChange }: {
  label: string;
  people: Person[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a person</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}
      </select>
    </label>
  );
}

function RelationshipGroup({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children.length : children ? 1 : 0;
  return <div><h3>{title}</h3>{rows ? children : <p className="muted">{empty}</p>}</div>;
}

function RelationshipRow({ first, connector, second, onRemove }: {
  first: string;
  connector: string;
  second: string;
  onRemove: () => void;
}) {
  return (
    <div className="relationship-row">
      <span><strong>{first}</strong> <small>{connector}</small> <strong>{second}</strong></span>
      <button className="text-button text-button--danger" type="button" onClick={onRemove}>Remove</button>
    </div>
  );
}
