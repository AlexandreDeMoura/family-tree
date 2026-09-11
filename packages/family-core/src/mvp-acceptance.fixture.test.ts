import { describe, expect, it } from 'vitest';
import { deriveSiblings, validateFamilyGraph } from './index.js';
import {
  createMvpAcceptanceGraph,
  mvpAcceptanceIds,
  mvpAcceptanceLargeSiblingIds,
} from './mvp-acceptance.fixture.js';

describe('MVP manual acceptance graph fixture', () => {
  it('is valid, immutable by validation, and exercises the risky family structures', () => {
    const graph = createMvpAcceptanceGraph();
    const before = structuredClone(graph);

    expect(validateFamilyGraph(graph, 2026).success).toBe(true);
    expect(graph).toEqual(before);
    expect(new Set(graph.people.map(({ lifeStatus }) => lifeStatus)))
      .toEqual(new Set(['living', 'deceased', 'unknown']));
    expect(graph.people.find(({ id }) => id === mvpAcceptanceIds.marc)?.adopted).toBe(true);
    expect(graph.parentChild.some(({ parentId, childId }) => (
      parentId === mvpAcceptanceIds.anne && childId === mvpAcceptanceIds.mia
    ))).toBe(true);
    expect(graph.parentChild.every(({ childId }) => (
      graph.parentChild.filter((edge) => edge.childId === childId).length <= 2
    ))).toBe(true);
    expect(graph.parentChild.some(({ parentId, childId }) => (
      parentId === mvpAcceptanceIds.isolated || childId === mvpAcceptanceIds.isolated
    ))).toBe(false);
  });

  it('contains a large full-sibling group plus a natural half-sibling branch', () => {
    const siblings = deriveSiblings(createMvpAcceptanceGraph(), mvpAcceptanceIds.anne);
    const fullIds = siblings.filter(({ type }) => type === 'full').map(({ person }) => person.id);
    const halfIds = siblings.filter(({ type }) => type === 'half').map(({ person }) => person.id);

    expect(fullIds).toEqual(mvpAcceptanceLargeSiblingIds.filter((id) => id !== mvpAcceptanceIds.anne));
    expect(halfIds).toEqual([mvpAcceptanceIds.theo]);
  });
});
