import { describe, expect, it } from 'vitest';
import {
  createMvpAcceptanceGraph,
  mvpAcceptanceIds,
  type FamilyGraph,
  type Person,
} from '@family-tree/family-core';
import { projectFocusedFamilyGraph, projectPersonCard } from './person-card';

describe('person card projections', () => {
  it('projects the shared MVP fixture across full, half, multi-partner, and incomplete branches', () => {
    const graph = createMvpAcceptanceGraph();
    const card = projectPersonCard(graph, mvpAcceptanceIds.anne);
    const focused = projectFocusedFamilyGraph(graph, mvpAcceptanceIds.anne);

    expect(card?.siblings.people.filter(({ type }) => type === 'full')).toHaveLength(9);
    expect(card?.siblings.people.filter(({ type }) => type === 'half').map(({ person }) => person.id))
      .toEqual([mvpAcceptanceIds.theo]);
    expect(card?.children.people.map(({ id }) => id)).toEqual([mvpAcceptanceIds.jules, mvpAcceptanceIds.mia]);
    expect(focused?.people.some(({ id }) => id === mvpAcceptanceIds.isolated)).toBe(false);
    expect(graph.people.find(({ id }) => id === mvpAcceptanceIds.marc)).toMatchObject({
      adopted: true,
      lifeStatus: 'unknown',
    });
  });

  it('projects clickable immediate family and derived full and half siblings', () => {
    const graph = familyGraph();

    const card = projectPersonCard(graph, 'focus');

    expect(card?.parents.people.map(({ id }) => id)).toEqual(['parent-a', 'parent-b']);
    expect(card?.siblings.people.map(({ person, type }) => [person.id, type])).toEqual([
      ['full-sibling', 'full'],
      ['half-sibling', 'half'],
    ]);
    expect(card?.partners.people.map(({ id }) => id)).toEqual(['partner']);
    expect(card?.children.people.map(({ id }) => id)).toEqual(['child']);
  });

  it('distinguishes known absence, unknown lists, and partially known lists', () => {
    const graph = familyGraph();
    const focus = graph.people.find(({ id }) => id === 'focus')!;
    focus.parentsComplete = true;
    focus.partnersComplete = false;
    focus.childrenComplete = true;
    graph.people.find(({ id }) => id === 'parent-a')!.childrenComplete = true;
    graph.people.find(({ id }) => id === 'parent-b')!.childrenComplete = false;

    expect(projectPersonCard(graph, 'focus')).toMatchObject({
      parents: { knowledge: 'complete' },
      siblings: { knowledge: 'partial' },
      partners: { knowledge: 'partial' },
      children: { knowledge: 'complete' },
    });

    const isolated = projectPersonCard(graph, 'isolated');
    expect(isolated).toMatchObject({
      parents: { people: [], knowledge: 'none' },
      siblings: { people: [], knowledge: 'none' },
      partners: { people: [], knowledge: 'unknown' },
      children: { people: [], knowledge: 'none' },
    });
  });

  it('builds a focus subgraph without dropping the broader graph or changing source data', () => {
    const graph = familyGraph();
    const before = structuredClone(graph);

    const focused = projectFocusedFamilyGraph(graph, 'focus');

    expect(focused?.people.map(({ id }) => id)).toEqual([
      'parent-a', 'parent-b', 'focus', 'full-sibling', 'half-sibling', 'partner', 'child',
    ]);
    expect(focused?.people.some(({ id }) => id === 'isolated')).toBe(false);
    expect(focused?.parentChild).toHaveLength(6);
    expect(focused?.partnerships).toEqual([{ person1Id: 'focus', person2Id: 'partner' }]);
    expect(graph).toEqual(before);
  });

  it('returns null for a person outside the graph', () => {
    expect(projectPersonCard(familyGraph(), 'missing')).toBeNull();
    expect(projectFocusedFamilyGraph(familyGraph(), 'missing')).toBeNull();
  });
});

function familyGraph(): FamilyGraph {
  return {
    treeId: 'tree',
    people: [
      person('parent-a'), person('parent-b'), person('other-parent'), person('focus'),
      person('full-sibling'), person('half-sibling'), person('partner'), person('child'),
      person('isolated', { parentsComplete: true, childrenComplete: true }),
    ],
    parentChild: [
      { parentId: 'parent-a', childId: 'focus' },
      { parentId: 'parent-b', childId: 'focus' },
      { parentId: 'parent-a', childId: 'full-sibling' },
      { parentId: 'parent-b', childId: 'full-sibling' },
      { parentId: 'parent-a', childId: 'half-sibling' },
      { parentId: 'other-parent', childId: 'half-sibling' },
      { parentId: 'focus', childId: 'child' },
    ],
    partnerships: [
      { person1Id: 'focus', person2Id: 'partner' },
      { person1Id: 'other-parent', person2Id: 'parent-a' },
    ],
  };
}

function person(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    treeId: 'tree',
    firstName: id,
    lastName: 'Family',
    lifeStatus: 'unknown',
    birthYear: null,
    deathYear: null,
    adopted: false,
    mainPhotoId: null,
    funFacts: [],
    parentsComplete: false,
    partnersComplete: false,
    childrenComplete: false,
    ...overrides,
  };
}
