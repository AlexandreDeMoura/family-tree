import type { Person } from '@family-tree/family-core';

/** Display explicit life data without inferring a status or an age. */
export function treePersonYears(person: Pick<Person, 'lifeStatus' | 'birthYear' | 'deathYear'>): string {
  if (person.lifeStatus === 'deceased') {
    if (person.birthYear === null && person.deathYear === null) return 'Dates unknown';
    return `${person.birthYear ?? '?'}–${person.deathYear ?? '?'}`;
  }
  return person.birthYear === null ? 'Year unknown' : String(person.birthYear);
}

/** A leaf is not necessarily childless: completeness carries that distinction. */
export function childBranchLabel(childrenComplete: boolean, hasChildren: boolean): string | null {
  if (hasChildren) return null;
  return childrenComplete ? 'No children' : 'Children unknown';
}
