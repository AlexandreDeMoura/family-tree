import { describe, expect, it } from 'vitest';
import type { FamilyGraph, Person } from '@family-tree/family-core';
import {
  createPersonWorkspaceDraft,
  discoveryPrompts,
  factConflict,
  invariantChecks,
  personWorkspacePath,
  treeOverviewPath,
  validatePersonWorkspaceDraft,
} from './person-workspace';

const treeId = 'tree';
function person(id: string, birthYear: number | null): Person {
  return {
    id, treeId, firstName: id, lastName: 'Moreau', lifeStatus: 'unknown', birthYear,
    deathYear: null, adopted: false, mainPhotoId: null, funFacts: [],
    parentsComplete: false, partnersComplete: false, childrenComplete: false,
  };
}
const parent = person('Lucien', 1925);
const subject = person('Odette', 1921);
const child = person('Marie', 1950);
const graph: FamilyGraph = {
  treeId,
  people: [parent, subject, child],
  parentChild: [{ parentId: subject.id, childId: child.id }],
  partnerships: [],
};

describe('person editing workspace view model', () => {
  it('builds an edit draft and validates person plus staged relationships together', () => {
    const draft = createPersonWorkspaceDraft(graph, subject);
    draft.relationships.parentIds = [parent.id];
    const result = validatePersonWorkspaceDraft(draft, graph, 2026, subject.id);

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('parent_younger_than_child');
    expect(factConflict(result, graph)).toEqual({
      title: 'Lucien Moreau can’t be Odette Moreau’s parent',
      detail: expect.stringContaining('Lucien Moreau’s birth year (1925) is later than Odette Moreau’s (1921)'),
    });
    expect(invariantChecks(result)).toContainEqual({
      label: 'A parent is not younger than their child', valid: false,
    });
  });

  it('can remove a conflicting old relationship while editing a year in one valid draft', () => {
    const connected = { ...graph, parentChild: [{ parentId: parent.id, childId: subject.id }] };
    const draft = createPersonWorkspaceDraft(connected, parent);
    draft.values.birthYear = '1930';
    draft.relationships.childIds = [];

    const result = validatePersonWorkspaceDraft(draft, connected, 2026, parent.id);
    expect(result.valid).toBe(true);
    expect(result.proposedGraph?.parentChild).toEqual([]);
  });

  it('maps the explicit children control to completeness without inventing siblings', () => {
    const draft = createPersonWorkspaceDraft(graph, subject);
    draft.relationships.childrenKnowledge = 'none';
    draft.relationships.childIds = [];
    const result = validatePersonWorkspaceDraft(draft, graph, 2026, subject.id);

    expect(result.valid).toBe(true);
    expect(result.input?.childrenComplete).toBe(true);
    expect(result.proposedGraph?.parentChild).toEqual([]);
  });

  it('keeps discovery prompts non-blocking and includes missing photo and relationship knowledge', () => {
    const draft = createPersonWorkspaceDraft(graph, subject);
    draft.values.funFacts = ['One', 'Two', ''];
    const validation = validatePersonWorkspaceDraft(draft, graph, 2026, subject.id);

    expect(validation.valid).toBe(true);
    expect(discoveryPrompts(draft, [], subject)).toEqual(expect.arrayContaining([
      'One more fun fact', 'Life status', 'A main portrait', 'Photos through the years',
      'Parent information', 'Partner information',
    ]));
  });

  it('creates stable add/edit routes and focus-preserving return routes', () => {
    expect(personWorkspacePath('tree one')).toBe('/organizer/trees/tree%20one/people/new');
    expect(personWorkspacePath('tree one', 'person/two')).toBe('/organizer/trees/tree%20one/people/person%2Ftwo/edit');
    expect(treeOverviewPath('tree one', 'person/two')).toBe('/organizer/trees/tree%20one?person=person%2Ftwo');
  });
});
