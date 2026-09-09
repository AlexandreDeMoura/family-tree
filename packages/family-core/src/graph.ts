import { createFamilyGraphSchema, type FamilyGraph, type ParentChild, type Partnership, type PersonInput } from './schemas.js';
import { findAncestryCycle } from './invariants.js';

export type DomainIssueCode =
  | 'invalid_schema' | 'death_before_birth' | 'future_death' | 'living_death'
  | 'self_parent' | 'self_partner' | 'duplicate_person' | 'cross_tree_person'
  | 'missing_person' | 'duplicate_parent' | 'too_many_parents'
  | 'parent_younger_than_child' | 'ancestry_cycle' | 'duplicate_partnership';

export interface DomainIssue {
  code: DomainIssueCode;
  message: string;
  path: PropertyKey[];
  personIds: string[];
}

export type GraphValidationResult =
  | { success: true; data: FamilyGraph }
  | { success: false; issues: DomainIssue[] };

/** Validates a full proposed snapshot; does not modify or persist the input. */
export function validateFamilyGraph(input: unknown, currentYear: number): GraphValidationResult {
  const parsed = createFamilyGraphSchema(currentYear).safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        code: (issue.code === 'custom' ? issue.params?.domainCode : undefined) ?? 'invalid_schema',
        message: issue.message,
        path: issue.path,
        personIds: [],
      })),
    };
  }

  const graph = parsed.data;
  const issues: DomainIssue[] = [];
  const add = (code: DomainIssueCode, message: string, path: PropertyKey[], personIds: string[]) => {
    issues.push({ code, message, path, personIds });
  };
  const people = new Map<string, FamilyGraph['people'][number]>();
  graph.people.forEach((person, index) => {
    if (people.has(person.id)) {
      add('duplicate_person', `Person ${person.id} appears more than once.`, ['people', index, 'id'], [person.id]);
    }
    if (person.treeId !== graph.treeId) {
      add('cross_tree_person', `Person ${person.id} belongs to a different tree.`, ['people', index, 'treeId'], [person.id]);
    }
    people.set(person.id, person);
  });

  const parents = new Map<string, Set<string>>();
  graph.parentChild.forEach(({ parentId, childId }, index) => {
    const path = ['parentChild', index];
    const parent = people.get(parentId);
    const child = people.get(childId);
    if (!parent || !child) {
      add('missing_person', 'Both parent and child must exist in this tree.', path, [parentId, childId]);
    }
    const knownParents = parents.get(childId) ?? new Set<string>();
    if (knownParents.has(parentId)) {
      add('duplicate_parent', 'This parent relationship already exists.', path, [parentId, childId]);
    }
    knownParents.add(parentId);
    parents.set(childId, knownParents);
    if (knownParents.size > 2) {
      add('too_many_parents', 'A person can have at most two parents.', path, [childId, ...knownParents]);
    }
    if (parent && child && parent.birthYear !== null && child.birthYear !== null && parent.birthYear > child.birthYear) {
      add('parent_younger_than_child',
        `${parent.firstName} ${parent.lastName} (${parent.birthYear}) cannot be a parent of ${child.firstName} ${child.lastName} (${child.birthYear}) because their birth year is later.`,
        path, [parentId, childId]);
    }
  });

  const cycle = findAncestryCycle(graph.parentChild);
  if (cycle) add('ancestry_cycle', 'Parent relationships must not form an ancestry cycle.', ['parentChild'], cycle);

  const partners = new Set<string>();
  graph.partnerships.forEach(({ person1Id, person2Id }, index) => {
    const path = ['partnerships', index];
    if (!people.has(person1Id) || !people.has(person2Id)) {
      add('missing_person', 'Both partners must exist in this tree.', path, [person1Id, person2Id]);
    }
    const pair = JSON.stringify([person1Id, person2Id]);
    if (partners.has(pair)) {
      add('duplicate_partnership', 'This partnership already exists.', path, [person1Id, person2Id]);
    }
    partners.add(pair);
  });

  return issues.length ? { success: false, issues } : { success: true, data: graph };
}

/** Application callers persist only the successful result, under their tree lock. */
export function validateParentRelationship(graph: FamilyGraph, edge: ParentChild, currentYear: number) {
  return validateFamilyGraph({ ...graph, parentChild: [...graph.parentChild, edge] }, currentYear);
}

export function validatePartnership(graph: FamilyGraph, edge: Partnership, currentYear: number) {
  return validateFamilyGraph({ ...graph, partnerships: [...graph.partnerships, edge] }, currentYear);
}

/** Supply a complete replacement (merge patches before calling), keeping identity fixed. */
export function validatePersonEdit(graph: FamilyGraph, person: PersonInput, currentYear: number): GraphValidationResult {
  if (!graph.people.some(({ id }) => id === person.id)) {
    return { success: false, issues: [{
      code: 'missing_person', message: `Person ${person.id} does not exist in this tree.`,
      path: ['people'], personIds: [person.id],
    }] };
  }
  return validateFamilyGraph({
    ...graph, people: graph.people.map((existing) => existing.id === person.id ? person : existing),
  }, currentYear);
}
