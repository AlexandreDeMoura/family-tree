import type { FamilyGraph, Person } from './schemas.js';

// Projections assume a validated graph, preserve people order, and never infer edges.
function selectPeople(graph: FamilyGraph, ids: Set<string>): Person[] {
  return graph.people.filter(({ id }) => ids.has(id));
}

function parentIds(graph: FamilyGraph, personId: string): Set<string> {
  return new Set(graph.parentChild.filter(({ childId }) => childId === personId).map(({ parentId }) => parentId));
}

export function deriveParents(graph: FamilyGraph, personId: string): Person[] {
  return selectPeople(graph, parentIds(graph, personId));
}

export function deriveChildren(graph: FamilyGraph, personId: string): Person[] {
  return selectPeople(graph, new Set(graph.parentChild.filter(({ parentId }) => parentId === personId).map(({ childId }) => childId)));
}

export function derivePartners(graph: FamilyGraph, personId: string): Person[] {
  const ids = new Set<string>();
  for (const { person1Id, person2Id } of graph.partnerships) {
    if (person1Id === personId) ids.add(person2Id);
    if (person2Id === personId) ids.add(person1Id);
  }
  return selectPeople(graph, ids);
}

export type SiblingType = 'full' | 'half';
export interface Sibling { person: Person; type: SiblingType }

export function getSiblingType(graph: FamilyGraph, personId: string, otherId: string): SiblingType | null {
  if (personId === otherId) return null;
  const parents = parentIds(graph, personId);
  const shared = [...parentIds(graph, otherId)].filter((id) => parents.has(id)).length;
  return shared === 2 ? 'full' : shared === 1 ? 'half' : null;
}

export function deriveSiblings(graph: FamilyGraph, personId: string): Sibling[] {
  const parents = parentIds(graph, personId);
  const sharedCounts = new Map<string, Set<string>>();
  for (const { parentId, childId } of graph.parentChild) {
    if (childId === personId || !parents.has(parentId)) continue;
    const shared = sharedCounts.get(childId) ?? new Set<string>();
    shared.add(parentId);
    sharedCounts.set(childId, shared);
  }
  return graph.people.flatMap((person): Sibling[] => {
    const count = sharedCounts.get(person.id)?.size ?? 0;
    return count === 2 ? [{ person, type: 'full' }] : count === 1 ? [{ person, type: 'half' }] : [];
  });
}

export function deriveImmediateFamily(graph: FamilyGraph, personId: string) {
  return {
    parents: deriveParents(graph, personId),
    children: deriveChildren(graph, personId),
    partners: derivePartners(graph, personId),
    siblings: deriveSiblings(graph, personId),
  };
}
