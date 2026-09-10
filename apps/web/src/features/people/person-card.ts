import {
  deriveImmediateFamily,
  type FamilyGraph,
  type Person,
  type Sibling,
} from '@family-tree/family-core';

export type RelationshipKnowledge = 'complete' | 'partial' | 'none' | 'unknown';

export interface PersonRelationshipSection<T> {
  people: T[];
  knowledge: RelationshipKnowledge;
}

export interface PersonCardProjection {
  person: Person;
  parents: PersonRelationshipSection<Person>;
  siblings: PersonRelationshipSection<Sibling>;
  partners: PersonRelationshipSection<Person>;
  children: PersonRelationshipSection<Person>;
}

export function projectPersonCard(
  graph: FamilyGraph,
  personId: string,
): PersonCardProjection | null {
  const person = graph.people.find(({ id }) => id === personId);
  if (!person) return null;

  const family = deriveImmediateFamily(graph, personId);
  const siblingsComplete = person.parentsComplete
    && family.parents.every((parent) => parent.childrenComplete);

  return {
    person,
    parents: section(family.parents, person.parentsComplete),
    siblings: section(family.siblings, siblingsComplete),
    partners: section(family.partners, person.partnersComplete),
    children: section(family.children, person.childrenComplete),
  };
}

/**
 * Returns the selected person and the family members shown in their card. The
 * full layout stays mounted; this induced graph only decides what is prominent.
 */
export function projectFocusedFamilyGraph(
  graph: FamilyGraph,
  personId: string,
): FamilyGraph | null {
  const card = projectPersonCard(graph, personId);
  if (!card) return null;

  const focusedIds = new Set([
    card.person.id,
    ...card.parents.people.map(({ id }) => id),
    ...card.siblings.people.map(({ person }) => person.id),
    ...card.partners.people.map(({ id }) => id),
    ...card.children.people.map(({ id }) => id),
  ]);

  return {
    treeId: graph.treeId,
    people: graph.people.filter(({ id }) => focusedIds.has(id)),
    parentChild: graph.parentChild.filter(({ parentId, childId }) => (
      focusedIds.has(parentId) && focusedIds.has(childId)
    )),
    partnerships: graph.partnerships.filter(({ person1Id, person2Id }) => (
      focusedIds.has(person1Id) && focusedIds.has(person2Id)
    )),
  };
}

function section<T>(people: T[], complete: boolean): PersonRelationshipSection<T> {
  if (people.length === 0) {
    return { people, knowledge: complete ? 'none' : 'unknown' };
  }
  return { people, knowledge: complete ? 'complete' : 'partial' };
}
