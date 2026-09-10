import { describe, expect, it } from 'vitest';
import type { FamilyGraph, Person } from '@family-tree/family-core';
import { layoutFamilyGraph, type PositionedFamilyGraph } from './layout-family-graph';

describe('layoutFamilyGraph', () => {
  it('lays out realistic generations, multiple partners, and half-sibling branches without changing the source graph', async () => {
    const graph = familyGraph(
      [
        person('grand-a', 1938), person('grand-b', 1941),
        person('parent-a', 1965), person('parent-b', 1968), person('parent-c', 1970),
        person('child-a', 1990), person('child-b', 1993), person('half-child', 1998),
        person('grandchild', 2018), person('isolated', null),
      ],
      [
        ['grand-a', 'parent-a'], ['grand-b', 'parent-a'],
        ['parent-a', 'child-a'], ['parent-b', 'child-a'],
        ['parent-a', 'child-b'], ['parent-b', 'child-b'],
        ['parent-a', 'half-child'], ['parent-c', 'half-child'],
        ['child-a', 'grandchild'],
      ],
      [
        ['grand-a', 'grand-b'],
        ['parent-a', 'parent-b'],
        ['parent-a', 'parent-c'],
      ],
    );
    const snapshot = structuredClone(graph);

    const layout = await layoutFamilyGraph(graph);

    expect(graph).toEqual(snapshot);
    expectPersonCoverage(layout, graph);
    expectFiniteLayout(layout);
    for (const { parentId, childId } of graph.parentChild) {
      expect(personNode(layout, parentId).position.y).toBeLessThan(personNode(layout, childId).position.y);
    }
    for (const { person1Id, person2Id } of graph.partnerships) {
      expect(personNode(layout, person1Id).position.y).toBe(personNode(layout, person2Id).position.y);
    }

    const families = layout.nodes.filter((node) => node.kind === 'junction' && node.junctionKind === 'family');
    expect(families).toEqual(expect.arrayContaining([
      expect.objectContaining({ parentIds: ['parent-a', 'parent-b'], childIds: ['child-a', 'child-b'] }),
      expect.objectContaining({ parentIds: ['parent-a', 'parent-c'], childIds: ['half-child'] }),
      expect.objectContaining({ parentIds: ['child-a'], childIds: ['grandchild'] }),
    ]));
  });

  it('keeps a large sibling group on one generation and routes it through one temporary family junction', async () => {
    const siblings = Array.from({ length: 12 }, (_, index) => person(`child-${String(index).padStart(2, '0')}`, 1990 + index));
    const graph = familyGraph(
      [person('parent-a', 1960), person('parent-b', 1962), ...siblings],
      siblings.flatMap(({ id }) => [['parent-a', id], ['parent-b', id]] as [string, string][]),
      [['parent-a', 'parent-b']],
    );

    const layout = await layoutFamilyGraph(graph);

    expectPersonCoverage(layout, graph);
    expectFiniteLayout(layout);
    expect(new Set(siblings.map(({ id }) => personNode(layout, id).position.y)).size).toBe(1);
    const siblingJunctions = layout.nodes.filter((node) => (
      node.kind === 'junction'
      && node.parentIds.join(',') === 'parent-a,parent-b'
      && node.childIds.length > 0
    ));
    expect(siblingJunctions).toHaveLength(1);
    expect(siblingJunctions[0]).toMatchObject({ childIds: siblings.map(({ id }) => id) });
  });

  it('covers disconnected people and one-known-parent families without inventing person nodes', async () => {
    const graph = familyGraph(
      [person('known-parent', 1974), person('child', 2004), person('disconnected', null)],
      [['known-parent', 'child']],
      [],
    );

    const layout = await layoutFamilyGraph(graph);

    expectPersonCoverage(layout, graph);
    expectFiniteLayout(layout);
    const personIds = layout.nodes.filter((node) => node.kind === 'person').map(({ id }) => id).sort();
    expect(personIds).toEqual(['child', 'disconnected', 'known-parent']);
    expect(layout.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'junction',
        junctionKind: 'family',
        parentIds: ['known-parent'],
        childIds: ['child'],
      }),
    ]));
  });

  it('uses a display-only junction to group partners who have no children', async () => {
    const graph = familyGraph(
      [person('one', 1980), person('two', 1981), person('unrelated', 1985)],
      [],
      [['one', 'two']],
    );

    const layout = await layoutFamilyGraph(graph);

    expect(personNode(layout, 'one').position.y).toBe(personNode(layout, 'two').position.y);
    expect(layout.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'junction',
        junctionKind: 'partnership',
        parentIds: ['one', 'two'],
        childIds: [],
      }),
    ]));
    expect(layout.edges).toContainEqual(expect.objectContaining({
      kind: 'partnership', source: 'one', target: 'two',
    }));
    expect(graph).toEqual(familyGraph(
      [person('one', 1980), person('two', 1981), person('unrelated', 1985)],
      [],
      [['one', 'two']],
    ));
  });
});

function familyGraph(
  people: Person[],
  parentChild: [string, string][],
  partnerships: [string, string][],
): FamilyGraph {
  return {
    treeId: 'tree',
    people,
    parentChild: parentChild.map(([parentId, childId]) => ({ parentId, childId })),
    partnerships: partnerships.map(([person1Id, person2Id]) => (
      person1Id < person2Id ? { person1Id, person2Id } : { person1Id: person2Id, person2Id: person1Id }
    )),
  };
}

function person(id: string, birthYear: number | null): Person {
  return {
    id,
    treeId: 'tree',
    firstName: `First ${id}`,
    lastName: 'Family',
    lifeStatus: 'living',
    birthYear,
    deathYear: null,
    adopted: false,
    mainPhotoId: null,
    funFacts: [],
    parentsComplete: false,
    partnersComplete: false,
    childrenComplete: false,
  };
}

function personNode(layout: PositionedFamilyGraph, id: string) {
  const node = layout.nodes.find((candidate) => candidate.kind === 'person' && candidate.id === id);
  if (!node || node.kind !== 'person') throw new Error(`Missing person node ${id}`);
  return node;
}

function expectPersonCoverage(layout: PositionedFamilyGraph, graph: FamilyGraph) {
  const expected = graph.people.map(({ id }) => id).sort();
  const actual = layout.nodes.filter((node) => node.kind === 'person').map(({ id }) => id).sort();
  expect(actual).toEqual(expected);
}

function expectFiniteLayout(layout: PositionedFamilyGraph) {
  expect(Number.isFinite(layout.width)).toBe(true);
  expect(Number.isFinite(layout.height)).toBe(true);
  expect(layout.width).toBeGreaterThan(0);
  expect(layout.height).toBeGreaterThan(0);
  for (const node of layout.nodes) {
    expect(Number.isFinite(node.position.x)).toBe(true);
    expect(Number.isFinite(node.position.y)).toBe(true);
    expect(Number.isFinite(node.width)).toBe(true);
    expect(Number.isFinite(node.height)).toBe(true);
  }
}
