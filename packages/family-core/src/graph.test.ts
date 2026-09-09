import { describe, expect, it } from 'vitest';
import {
  createPersonSchema, findAncestryCycle, validateFamilyGraph, validateParentRelationship,
  validatePartnership, validatePersonEdit, wouldCreateAncestryCycle,
  type DomainIssueCode, type FamilyGraph, type GraphValidationResult, type Person,
} from './index.js';

const year = 2026;
function person(id: string, birthYear: number | null = null): Person {
  return createPersonSchema(year).parse({ id, treeId: 'family', firstName: id, lastName: 'Martin', lifeStatus: 'unknown', birthYear });
}
function graph(): FamilyGraph {
  return {
    treeId: 'family', people: [person('grandparent', 1940), person('parent', 1970), person('child', 2000), person('other'), person('third')],
    parentChild: [{ parentId: 'grandparent', childId: 'parent' }, { parentId: 'parent', childId: 'child' }],
    partnerships: [],
  };
}
function expectIssue(result: GraphValidationResult, code: DomainIssueCode) {
  expect(result.success).toBe(false);
  if (!result.success) expect(result.issues).toContainEqual(expect.objectContaining({ code }));
}

describe('family graph validation', () => {
  it('accepts empty, disconnected, and incomplete family graphs', () => {
    expect(validateFamilyGraph({ treeId: 'family', people: [], parentChild: [], partnerships: [] }, year).success).toBe(true);
    expect(validateFamilyGraph(graph(), year).success).toBe(true);
  });

  it('rejects invalid person fields through the graph entry point', () => {
    const source = graph();
    source.people[0].deathYear = 1939;
    expectIssue(validateFamilyGraph(source, year), 'death_before_birth');
    source.people[0].deathYear = 2027;
    expectIssue(validateFamilyGraph(source, year), 'future_death');
    source.people[0].deathYear = 2020;
    source.people[0].lifeStatus = 'living';
    expectIssue(validateFamilyGraph(source, year), 'living_death');
  });

  it('rejects self-links of either relationship type', () => {
    expectIssue(validateParentRelationship(graph(), { parentId: 'child', childId: 'child' }, year), 'self_parent');
    expectIssue(validatePartnership(graph(), { person1Id: 'child', person2Id: 'child' }, year), 'self_partner');
  });

  it('allows two distinct parents but rejects a third and duplicate edges', () => {
    const second = validateParentRelationship(graph(), { parentId: 'other', childId: 'child' }, year);
    expect(second.success).toBe(true);
    if (!second.success) throw new Error('Expected valid second parent');
    expectIssue(validateParentRelationship(second.data, { parentId: 'third', childId: 'child' }, year), 'too_many_parents');
    const duplicate = validateParentRelationship(second.data, { parentId: 'other', childId: 'child' }, year);
    expectIssue(duplicate, 'duplicate_parent');
    if (!duplicate.success) expect(duplicate.issues.map(({ code }) => code)).not.toContain('too_many_parents');
  });

  it.each([[2000, 2000], [null, 1900], [2000, null], [null, null]])(
    'allows equal or unknown parent/child years (%s, %s)', (parentYear, childYear) => {
      const source: FamilyGraph = { treeId: 'family', people: [person('p', parentYear), person('c', childYear)], parentChild: [], partnerships: [] };
      expect(validateParentRelationship(source, { parentId: 'p', childId: 'c' }, year).success).toBe(true);
    },
  );

  it('identifies both people and conflicting birth years', () => {
    const result = validateParentRelationship(graph(), { parentId: 'child', childId: 'other' }, year);
    expect(result.success).toBe(true);
    const invalid = validateParentRelationship(graph(), { parentId: 'child', childId: 'grandparent' }, year);
    expectIssue(invalid, 'parent_younger_than_child');
    expectIssue(invalid, 'ancestry_cycle');
    if (!invalid.success) expect(invalid.issues).toContainEqual(expect.objectContaining({
      code: 'parent_younger_than_child', personIds: ['child', 'grandparent'],
      message: expect.stringMatching(/child Martin \(2000\).*grandparent Martin \(1940\)/),
    }));
  });

  it('supports multiple partners and canonicalizes unordered pairs without mutation', () => {
    const source = graph();
    source.partnerships = [{ person1Id: 'parent', person2Id: 'other' }];
    const before = structuredClone(source);
    const result = validatePartnership(source, { person1Id: 'third', person2Id: 'parent' }, year);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected valid multiple partners');
    expect(result.data.partnerships).toEqual([
      { person1Id: 'other', person2Id: 'parent' }, { person1Id: 'parent', person2Id: 'third' },
    ]);
    expect(result.data.parentChild).toEqual(source.parentChild);
    expect(source).toEqual(before);
    expectIssue(validatePartnership(source, { person1Id: 'other', person2Id: 'parent' }, year), 'duplicate_partnership');
    expectIssue(validatePartnership(source, { person1Id: 'parent', person2Id: 'other' }, year), 'duplicate_partnership');
  });

  it('rejects missing endpoints, duplicate people, and people from another tree', () => {
    expectIssue(validateParentRelationship(graph(), { parentId: 'missing', childId: 'child' }, year), 'missing_person');
    expectIssue(validateParentRelationship(graph(), { parentId: 'parent', childId: 'missing' }, year), 'missing_person');
    expectIssue(validatePartnership(graph(), { person1Id: 'parent', person2Id: 'missing' }, year), 'missing_person');
    const source = graph();
    source.people.push(person('child'));
    expectIssue(validateFamilyGraph(source, year), 'duplicate_person');
    source.people.pop();
    source.people[0].treeId = 'another-family';
    expectIssue(validateFamilyGraph(source, year), 'cross_tree_person');
  });

  it('rejects persisted derived relationships and layout state', () => {
    expectIssue(validateFamilyGraph({ ...graph(), siblings: [] }, year), 'invalid_schema');
    expectIssue(validateFamilyGraph({ ...graph(), coordinates: {} }, year), 'invalid_schema');
  });
});

describe('person edits', () => {
  it.each([1930, 2001])('rechecks existing parents and children when birth year becomes %s', (birthYear) => {
    const source = graph();
    const before = structuredClone(source);
    expectIssue(validatePersonEdit(source, { ...source.people[1], birthYear }, year), 'parent_younger_than_child');
    expect(source).toEqual(before);
  });

  it.each([null, 1940, 1980, 2000])('allows an unknown or compatible birth-year edit to %s', (birthYear) => {
    const source = graph();
    const result = validatePersonEdit(source, { ...source.people[1], birthYear, adopted: true }, year);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.people[1]).toMatchObject({ birthYear, adopted: true });
      expect(result.data.parentChild).toEqual(source.parentChild);
    }
  });

  it('rejects previously unknown years that invalidate either direction of an existing edge', () => {
    const source = graph();
    source.people[1].birthYear = null;
    expectIssue(validatePersonEdit(source, { ...source.people[1], birthYear: 1930 }, year), 'parent_younger_than_child');
    expectIssue(validatePersonEdit(source, { ...source.people[1], birthYear: 2001 }, year), 'parent_younger_than_child');
  });

  it('revalidates life data and rejects missing people or tree changes', () => {
    const source = graph();
    expectIssue(validatePersonEdit(source, { ...source.people[1], lifeStatus: 'living', deathYear: 2020 }, year), 'living_death');
    expectIssue(validatePersonEdit(source, person('missing'), year), 'missing_person');
    expectIssue(validatePersonEdit(source, { ...source.people[1], treeId: 'other-tree' }, year), 'cross_tree_person');
  });
});

describe('ancestry DFS', () => {
  it('detects self, direct, and indirect cycles regardless of birth-year knowledge', () => {
    const edges = [{ parentId: 'a', childId: 'b' }, { parentId: 'b', childId: 'c' }];
    expect(wouldCreateAncestryCycle([], 'a', 'a')).toBe(true);
    expect(wouldCreateAncestryCycle(edges, 'b', 'a')).toBe(true);
    expect(wouldCreateAncestryCycle(edges, 'c', 'a')).toBe(true);
    expect(wouldCreateAncestryCycle(edges, 'a', 'c')).toBe(false);
    const source = { treeId: 'family', people: ['a', 'b', 'c'].map((id) => person(id)), parentChild: edges, partnerships: [] };
    expectIssue(validateParentRelationship(source, { parentId: 'c', childId: 'a' }, year), 'ancestry_cycle');
  });

  it('handles long ancestry paths without recursion and terminates on already cyclic input', () => {
    const edges = Array.from({ length: 12000 }, (_, i) => ({ parentId: String(i), childId: String(i + 1) }));
    expect(findAncestryCycle(edges)).toBeNull();
    expect(wouldCreateAncestryCycle(edges, '12000', '0')).toBe(true);
    const cyclic = [...edges, { parentId: '12000', childId: '0' }];
    expect(findAncestryCycle(cyclic)).toHaveLength(12002);
    expect(wouldCreateAncestryCycle(cyclic, 'unrelated', '0')).toBe(false);
  });

  it('allows converging ancestry paths and detects cycles in disconnected components', () => {
    const edges = [
      { parentId: 'a', childId: 'b' }, { parentId: 'a', childId: 'c' },
      { parentId: 'b', childId: 'd' }, { parentId: 'c', childId: 'd' },
    ];
    expect(findAncestryCycle(edges)).toBeNull();
    expect(findAncestryCycle([...edges, { parentId: 'x', childId: 'y' }, { parentId: 'y', childId: 'x' }])).toEqual(['x', 'y', 'x']);
  });
});
