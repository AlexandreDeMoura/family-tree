import { describe, expect, it } from 'vitest';
import {
  createPersonSchema, deriveChildren, deriveImmediateFamily, deriveParents, derivePartners,
  deriveSiblings, getSiblingType, validateFamilyGraph, type FamilyGraph,
} from './index.js';

function family(): FamilyGraph {
  return {
    treeId: 'family',
    people: ['p1', 'p2', 'p3', 'child', 'full', 'half', 'one-known', 'isolated', 'unknown'].map((id) =>
      createPersonSchema(2026).parse({ id, treeId: 'family', firstName: id, lastName: 'Martin', lifeStatus: 'unknown', adopted: id === 'full' })),
    parentChild: [
      { parentId: 'p1', childId: 'child' }, { parentId: 'p2', childId: 'child' },
      { parentId: 'p2', childId: 'full' }, { parentId: 'p1', childId: 'full' },
      { parentId: 'p1', childId: 'half' }, { parentId: 'p3', childId: 'half' },
      { parentId: 'p1', childId: 'one-known' },
    ],
    partnerships: [{ person1Id: 'p1', person2Id: 'p2' }, { person1Id: 'p3', person2Id: 'p1' }],
  };
}

describe('immediate family projections', () => {
  it('derives parents, children, and multiple partners from their respective edges', () => {
    const graph = family();
    expect(validateFamilyGraph(graph, 2026).success).toBe(true);
    expect(deriveParents(graph, 'child').map(({ id }) => id)).toEqual(['p1', 'p2']);
    expect(deriveChildren(graph, 'p1').map(({ id }) => id)).toEqual(['child', 'full', 'half', 'one-known']);
    expect(derivePartners(graph, 'p1').map(({ id }) => id)).toEqual(['p2', 'p3']);
    expect(derivePartners(graph, 'p3').map(({ id }) => id)).toEqual(['p1']);
  });

  it('derives full and half siblings from shared known parents, including adopted people', () => {
    const graph = family();
    expect(deriveSiblings(graph, 'child').map(({ person, type }) => [person.id, type])).toEqual([
      ['full', 'full'], ['half', 'half'], ['one-known', 'half'],
    ]);
    expect(getSiblingType(graph, 'child', 'full')).toBe('full');
    expect(getSiblingType(graph, 'full', 'child')).toBe('full');
    expect(getSiblingType(graph, 'child', 'half')).toBe('half');
    expect(getSiblingType(graph, 'child', 'child')).toBeNull();
    expect(getSiblingType(graph, 'child', 'isolated')).toBeNull();
  });

  it('calls two people sharing their sole known parent half siblings', () => {
    const graph = family();
    graph.parentChild.push({ parentId: 'p1', childId: 'unknown' });
    expect(getSiblingType(graph, 'one-known', 'unknown')).toBe('half');
    graph.people.forEach((person) => { person.parentsComplete = true; });
    expect(getSiblingType(graph, 'one-known', 'unknown')).toBe('half');
    expect(deriveSiblings(graph, 'one-known').every(({ type }) => type === 'half')).toBe(true);
  });

  it('does not invent parents or siblings for people with no known parents', () => {
    const graph = family();
    expect(getSiblingType(graph, 'isolated', 'unknown')).toBeNull();
    expect(deriveImmediateFamily(graph, 'isolated')).toEqual({ parents: [], children: [], partners: [], siblings: [] });
    expect(deriveImmediateFamily(graph, 'missing')).toEqual({ parents: [], children: [], partners: [], siblings: [] });
  });

  it('does not infer partnerships from shared children or parenthood from partnerships', () => {
    const graph = family();
    graph.partnerships = [];
    expect(derivePartners(graph, 'p1')).toEqual([]);
    graph.partnerships = [{ person1Id: 'p1', person2Id: 'isolated' }];
    expect(deriveChildren(graph, 'isolated')).toEqual([]);
    expect(deriveParents(graph, 'child').map(({ id }) => id)).toEqual(['p1', 'p2']);
  });

  it('preserves known absence flags and source data when projecting family', () => {
    const graph = family();
    graph.people.find(({ id }) => id === 'isolated')!.childrenComplete = true;
    const before = structuredClone(graph);
    deriveImmediateFamily(graph, 'child');
    deriveImmediateFamily(graph, 'isolated');
    expect(graph).toEqual(before);
    expect(graph.people.find(({ id }) => id === 'isolated')!.childrenComplete).toBe(true);
    expect(graph.people.find(({ id }) => id === 'unknown')!.childrenComplete).toBe(false);
  });
});
