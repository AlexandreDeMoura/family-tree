import type { AgeBucket, FamilyGraph, Person, Sibling } from '@family-tree/family-core';
import type { PhotoView } from '../../lib/api';
import { PhotoGallery } from '../photos/PhotoGallery';
import {
  projectPersonCard,
  type PersonRelationshipSection,
  type RelationshipKnowledge,
} from './person-card';

interface PersonCardProps {
  graph: FamilyGraph;
  personId: string;
  onNavigate: (personId: string) => void;
  onClose: () => void;
  photos: PhotoView[];
  photosLoading: boolean;
  photosError: unknown;
  onRefreshPhotos: () => void;
  onUploadPhoto?: (file: File, ageBucket: AgeBucket, makeMain: boolean) => Promise<void>;
  onSetMainPhoto?: (photoId: string) => Promise<void>;
  onDeletePhoto?: (photoId: string) => Promise<void>;
}

export function PersonCard({
  graph,
  personId,
  onNavigate,
  onClose,
  photos,
  photosLoading,
  photosError,
  onRefreshPhotos,
  onUploadPhoto,
  onSetMainPhoto,
  onDeletePhoto,
}: PersonCardProps) {
  const card = projectPersonCard(graph, personId);
  if (!card) return null;

  const { person } = card;
  const personPhotos = photos.filter((photo) => photo.personId === person.id);
  const portrait = personPhotos.find(({ isMain, viewUrl }) => isMain && viewUrl)?.viewUrl;
  return (
    <aside className="person-card" aria-label={`${person.firstName} ${person.lastName}'s person card`}>
      <header className="person-card__header">
        <button className="person-card__close" type="button" onClick={onClose} aria-label="Close person card and show the whole tree">×</button>
        <div className="person-card__portrait">
          {portrait
            ? <img src={portrait} alt={`${person.firstName} ${person.lastName}'s main portrait`} onError={onRefreshPhotos} />
            : <span aria-hidden="true">{initials(person)}</span>}
        </div>
        <div>
          <span className="eyebrow">Family story</span>
          <h2>{person.firstName} {person.lastName}</h2>
          <p>{lifeSummary(person)}</p>
        </div>
        <div className="person-card__badges" aria-label="Person details">
          {person.lifeStatus === 'deceased' && <span className="person-card-badge person-card-badge--memory">✦ Remembered</span>}
          {person.adopted && <span className="person-card-badge">Adopted</span>}
          {person.lifeStatus === 'unknown' && <span className="person-card-badge person-card-badge--unknown">Life status unknown</span>}
        </div>
      </header>

      <PhotoGallery
        key={person.id}
        person={person}
        photos={personPhotos}
        loading={photosLoading}
        loadError={photosError}
        onRefresh={onRefreshPhotos}
        onUpload={onUploadPhoto}
        onSetMain={onSetMainPhoto}
        onDelete={onDeletePhoto}
      />

      <section className="person-card__facts" aria-labelledby={`facts-${person.id}`}>
        <span className="eyebrow" id={`facts-${person.id}`}>A little about {person.firstName}</span>
        {person.funFacts.length ? (
          <ul>{person.funFacts.map((fact, index) => <li key={`${index}-${fact}`}>{fact}</li>)}</ul>
        ) : (
          <p>Memories and fun facts are still waiting to be added.</p>
        )}
      </section>

      <div className="person-card__relationships">
        <RelationshipSection
          title="Parents"
          section={card.parents}
          unknownLabel="Parents unknown"
          noneLabel="No parents"
          onNavigate={onNavigate}
        />
        <SiblingSection section={card.siblings} onNavigate={onNavigate} />
        <RelationshipSection
          title="Partner(s)"
          section={card.partners}
          unknownLabel="Partners unknown"
          noneLabel="No partners"
          onNavigate={onNavigate}
        />
        <RelationshipSection
          title="Kids"
          section={card.children}
          unknownLabel="Children unknown"
          noneLabel="No children"
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}

function RelationshipSection({ title, section, unknownLabel, noneLabel, onNavigate }: {
  title: string;
  section: PersonRelationshipSection<Person>;
  unknownLabel: string;
  noneLabel: string;
  onNavigate: (personId: string) => void;
}) {
  return (
    <details className="person-card-section">
      <summary>
        <span>{title}</span>
        <small>{knowledgeLabel(section.knowledge, section.people.length, unknownLabel, noneLabel)}</small>
      </summary>
      <div className="person-card-section__body">
        {section.people.length
          ? section.people.map((person) => <FamilyLink key={person.id} person={person} onNavigate={onNavigate} />)
          : <EmptyRelationship knowledge={section.knowledge} unknownLabel={unknownLabel} noneLabel={noneLabel} />}
      </div>
    </details>
  );
}

function SiblingSection({ section, onNavigate }: {
  section: PersonRelationshipSection<Sibling>;
  onNavigate: (personId: string) => void;
}) {
  return (
    <details className="person-card-section">
      <summary>
        <span>Brothers / Sisters</span>
        <small>{knowledgeLabel(section.knowledge, section.people.length, 'Siblings unknown', 'No brothers or sisters')}</small>
      </summary>
      <div className="person-card-section__body">
        {section.people.length ? section.people.map(({ person, type }) => (
          <FamilyLink key={person.id} person={person} onNavigate={onNavigate} badge={type === 'half' ? 'Half' : undefined} />
        )) : (
          <EmptyRelationship knowledge={section.knowledge} unknownLabel="Siblings unknown" noneLabel="No brothers or sisters" />
        )}
      </div>
    </details>
  );
}

function FamilyLink({ person, onNavigate, badge }: {
  person: Person;
  onNavigate: (personId: string) => void;
  badge?: string;
}) {
  return (
    <button className="person-card-link" type="button" onClick={() => onNavigate(person.id)}>
      <span className="person-card-link__avatar" aria-hidden="true">{initials(person)}</span>
      <span><strong>{person.firstName} {person.lastName}</strong><small>{compactLifeSummary(person)}</small></span>
      {badge && <span className="person-card-link__badge">{badge}</span>}
      <span className="person-card-link__arrow" aria-hidden="true">→</span>
    </button>
  );
}

function EmptyRelationship({ knowledge, unknownLabel, noneLabel }: {
  knowledge: RelationshipKnowledge;
  unknownLabel: string;
  noneLabel: string;
}) {
  const unknown = knowledge === 'unknown';
  return (
    <p className={unknown ? 'person-card-section__empty is-unknown' : 'person-card-section__empty'}>
      <span aria-hidden="true">{unknown ? '◌' : '—'}</span>
      {unknown ? `${unknownLabel}. There may be more to discover.` : `${noneLabel}.`}
    </p>
  );
}

function knowledgeLabel(
  knowledge: RelationshipKnowledge,
  count: number,
  unknownLabel: string,
  noneLabel: string,
) {
  if (knowledge === 'unknown') return unknownLabel;
  if (knowledge === 'none') return noneLabel;
  if (knowledge === 'partial') return `${count} known · more may be added`;
  return `${count} known`;
}

function lifeSummary(person: Person) {
  if (person.lifeStatus === 'deceased') {
    if (person.birthYear !== null && person.deathYear !== null) return `${person.birthYear}–${person.deathYear}`;
    if (person.birthYear !== null) return `${person.birthYear}–?`;
    if (person.deathYear !== null) return `?–${person.deathYear}`;
    return 'Dates unknown';
  }
  const birth = person.birthYear === null ? 'Birth year unknown' : `Born ${person.birthYear}`;
  if (person.lifeStatus === 'living') return `${birth} · Living`;
  const death = person.deathYear === null ? '' : ` · Death year ${person.deathYear}`;
  return `${birth}${death} · Life status unknown`;
}

function compactLifeSummary(person: Person) {
  if (person.lifeStatus === 'deceased') return person.deathYear === null ? 'Remembered' : `Died ${person.deathYear}`;
  return person.birthYear === null ? 'Year unknown' : `Born ${person.birthYear}`;
}

function initials(person: Person) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}
