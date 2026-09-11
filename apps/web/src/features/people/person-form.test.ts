import { describe, expect, it } from 'vitest';
import type { FamilyGraph, Person } from '@family-tree/family-core';
import { emptyPersonForm, personToForm, validatePersonForm } from './person-form';

const treeId = 'tree-1';
const parent: Person = {
  id: 'parent', treeId, firstName: 'Jean', lastName: 'Martin', lifeStatus: 'unknown',
  birthYear: 1970, deathYear: null, adopted: false, mainPhotoId: null, funFacts: [],
  parentsComplete: false, partnersComplete: false, childrenComplete: false,
};
const child: Person = {
  ...parent, id: 'child', firstName: 'Marie', birthYear: 2000,
};
const graph: FamilyGraph = {
  treeId, people: [parent, child], parentChild: [{ parentId: parent.id, childId: child.id }], partnerships: [],
};

describe('person form domain validation', () => {
  it('normalizes optional years and fun facts for a valid new person', () => {
    const values = {
      ...emptyPersonForm(),
      firstName: '  Anne ',
      lastName: ' Martin  ',
      birthYear: '1952',
      funFacts: ['  Owned a bakery  ', '', 'Played accordion'] as [string, string, string],
      childrenComplete: true,
    };

    expect(validatePersonForm(values, graph, 2026)).toEqual({
      input: expect.objectContaining({
        firstName: 'Anne', lastName: 'Martin', birthYear: 1952, deathYear: null,
        funFacts: ['Owned a bakery', 'Played accordion'], childrenComplete: true,
      }),
      fieldErrors: {},
    });
  });

  it('keeps invalid year text and reports field-specific life validation', () => {
    const malformed = validatePersonForm({
      ...emptyPersonForm(), firstName: 'Anne', lastName: 'Martin', birthYear: 'nineteen fifty',
    }, graph, 2026);
    expect(malformed.fieldErrors.birthYear).toBe('Birth year must be a whole year.');

    const living = validatePersonForm({
      ...emptyPersonForm(), firstName: 'Anne', lastName: 'Martin', lifeStatus: 'living', deathYear: '2020',
    }, graph, 2026);
    expect(living.fieldErrors.deathYear).toBe('A living person cannot have a death year.');
  });

  it.each([
    ['death before birth', { birthYear: '1980', deathYear: '1979' }, 'Death year must be equal to or later than birth year.'],
    ['future death', { birthYear: '1980', deathYear: '2027' }, 'Death year cannot be later than 2026.'],
    ['living death', { lifeStatus: 'living' as const, deathYear: '2020' }, 'A living person cannot have a death year.'],
  ])('blocks the %s invariant before person submission', (_label, overrides, message) => {
    const result = validatePersonForm({
      ...emptyPersonForm(), firstName: 'Anne', lastName: 'Martin', ...overrides,
    }, graph, 2026);
    expect(result.fieldErrors.deathYear).toBe(message);
  });

  it('revalidates connected relatives when editing a birth year', () => {
    const result = validatePersonForm({ ...personToForm(parent), birthYear: '2010' }, graph, 2026, parent.id);
    expect(result.formError).toContain('cannot be a parent of Marie Martin');
  });

  it('preserves known-absence completeness values through the form model', () => {
    const result = validatePersonForm({
      ...personToForm(child), parentsComplete: true, partnersComplete: true, childrenComplete: true,
    }, graph, 2026, child.id);
    expect(result.input).toMatchObject({
      parentsComplete: true, partnersComplete: true, childrenComplete: true,
    });
  });
});
