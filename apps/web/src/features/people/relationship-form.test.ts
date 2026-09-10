import { describe, expect, it } from 'vitest';
import type { FamilyGraph, Person } from '@family-tree/family-core';
import { validateRelationshipDraft } from './relationship-form';

function person(id: string, birthYear: number): Person {
  return {
    id, treeId: 'tree', firstName: id, lastName: 'Martin', lifeStatus: 'unknown',
    birthYear, deathYear: null, adopted: false, mainPhotoId: null, funFacts: [],
    parentsComplete: false, partnersComplete: false, childrenComplete: false,
  };
}

const graph: FamilyGraph = {
  treeId: 'tree', people: [person('older', 1950), person('younger', 2000), person('third', 1970)],
  parentChild: [{ parentId: 'older', childId: 'younger' }], partnerships: [],
};

describe('relationship form domain validation', () => {
  it('uses shared birth-order and cycle rules before submitting parents', () => {
    expect(validateRelationshipDraft(graph, 'parent', 'younger', 'older', 2026))
      .toContain('birth year is later');
  });

  it('uses shared duplicate and self-link rules before submitting', () => {
    expect(validateRelationshipDraft(graph, 'parent', 'older', 'younger', 2026))
      .toBe('This parent relationship already exists.');
    expect(validateRelationshipDraft(graph, 'partner', 'older', 'older', 2026))
      .toBe('A person cannot be their own partner.');
  });

  it('requires both people and accepts a valid independent partnership', () => {
    expect(validateRelationshipDraft(graph, 'partner', '', 'third', 2026)).toBe('Choose both people.');
    expect(validateRelationshipDraft(graph, 'partner', 'older', 'third', 2026)).toBeNull();
  });
});
