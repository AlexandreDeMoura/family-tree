import type { FamilyGraph, ParentChild, Partnership, Person } from '@family-tree/family-core';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api.js';

export const PERSON_NODE_WIDTH = 184;
export const PERSON_NODE_HEIGHT = 224;
export const JUNCTION_NODE_SIZE = 12;

const CANVAS_PADDING = 32;
const GENERATION_GAP = 152;

export interface Point {
  x: number;
  y: number;
}

export interface PositionedPersonNode {
  id: string;
  kind: 'person';
  position: Point;
  width: number;
  height: number;
  person: Person;
}

export interface PositionedJunctionNode {
  id: string;
  kind: 'junction';
  junctionKind: 'family' | 'partnership';
  position: Point;
  width: number;
  height: number;
  parentIds: string[];
  childIds: string[];
}

export type PositionedFamilyNode = PositionedPersonNode | PositionedJunctionNode;

export interface PositionedFamilyEdge {
  id: string;
  kind: 'parent' | 'partnership';
  source: string;
  target: string;
}

export interface PositionedFamilyGraph {
  nodes: PositionedFamilyNode[];
  edges: PositionedFamilyEdge[];
  width: number;
  height: number;
}

interface Junction {
  id: string;
  kind: PositionedJunctionNode['junctionKind'];
  parentIds: string[];
  childIds: string[];
}

interface LayoutParts {
  junctions: Junction[];
  visibleEdges: PositionedFamilyEdge[];
  layoutEdges: ElkExtendedEdge[];
}

const elk = new ELK();

/**
 * Produces display-only positions and routing junctions. The returned graph can
 * be handed to React Flow, but neither coordinates nor junctions belong in
 * persistence.
 */
export async function layoutFamilyGraph(graph: FamilyGraph): Promise<PositionedFamilyGraph> {
  if (graph.people.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const generations = assignGenerations(graph);
  const { junctions, visibleEdges, layoutEdges } = buildLayoutParts(graph);
  const personNodes = [...graph.people]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map<ElkNode>((person) => ({
      id: person.id,
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
      layoutOptions: {
        'org.eclipse.elk.partitioning.partition': String((generations.get(person.id) ?? 0) * 2),
      },
    }));
  const junctionNodes = junctions.map<ElkNode>((junction) => ({
    id: junction.id,
    width: JUNCTION_NODE_SIZE,
    height: JUNCTION_NODE_SIZE,
    layoutOptions: {
      'org.eclipse.elk.partitioning.partition': String(junctionPartition(junction, generations)),
    },
  }));

  const result = await elk.layout({
    id: 'family-layout',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': `[top=${CANVAS_PADDING},left=${CANVAS_PADDING},bottom=${CANVAS_PADDING},right=${CANVAS_PADDING}]`,
      'elk.spacing.componentComponent': '96',
      'elk.spacing.nodeNode': '52',
      'elk.layered.spacing.nodeNodeBetweenLayers': '88',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'org.eclipse.elk.partitioning.activate': 'true',
    },
    children: [...personNodes, ...junctionNodes],
    edges: layoutEdges,
  });

  const laidOutById = new Map((result.children ?? []).map((node) => [node.id, node]));
  const minimumX = Math.min(...[...laidOutById.values()].map((node) => requiredCoordinate(node.x, node.id, 'x')));
  const normalizedX = (id: string) => requiredCoordinate(laidOutById.get(id)?.x, id, 'x') - minimumX + CANVAS_PADDING;
  const peopleById = new Map(graph.people.map((person) => [person.id, person]));

  const nodes: PositionedFamilyNode[] = [
    ...graph.people.map<PositionedPersonNode>((person) => ({
      id: person.id,
      kind: 'person',
      position: {
        x: normalizedX(person.id),
        y: personY(generations.get(person.id) ?? 0),
      },
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
      person: peopleById.get(person.id)!,
    })),
    ...junctions.map<PositionedJunctionNode>((junction) => ({
      id: junction.id,
      kind: 'junction',
      junctionKind: junction.kind,
      position: {
        x: normalizedX(junction.id),
        y: junctionY(junction, generations),
      },
      width: JUNCTION_NODE_SIZE,
      height: JUNCTION_NODE_SIZE,
      parentIds: [...junction.parentIds],
      childIds: [...junction.childIds],
    })),
  ];

  return {
    nodes,
    edges: visibleEdges,
    width: extent(nodes, 'x'),
    height: extent(nodes, 'y'),
  };
}

function buildLayoutParts(graph: FamilyGraph): LayoutParts {
  const parentIdsByChild = new Map<string, Set<string>>();
  for (const { parentId, childId } of graph.parentChild) {
    const parents = parentIdsByChild.get(childId) ?? new Set<string>();
    parents.add(parentId);
    parentIdsByChild.set(childId, parents);
  }

  const familyByParents = new Map<string, Junction>();
  for (const [childId, parentIds] of parentIdsByChild) {
    const sortedParents = [...parentIds].sort();
    const key = idsKey(sortedParents);
    const junction = familyByParents.get(key) ?? {
      id: junctionId('family', sortedParents),
      kind: 'family' as const,
      parentIds: sortedParents,
      childIds: [],
    };
    junction.childIds.push(childId);
    familyByParents.set(key, junction);
  }

  const partnerships = uniquePartnerships(graph.partnerships);
  const junctions = [...familyByParents.values()].map((junction) => ({
    ...junction,
    childIds: [...junction.childIds].sort(),
  }));
  const familyParentKeys = new Set(junctions.map(({ parentIds }) => idsKey(parentIds)));

  for (const [person1Id, person2Id] of partnerships) {
    if (familyParentKeys.has(idsKey([person1Id, person2Id]))) continue;
    junctions.push({
      id: junctionId('partnership', [person1Id, person2Id]),
      kind: 'partnership',
      parentIds: [person1Id, person2Id],
      childIds: [],
    });
  }
  junctions.sort((left, right) => left.id.localeCompare(right.id));

  const visibleEdges: PositionedFamilyEdge[] = [];
  const layoutEdges: ElkExtendedEdge[] = [];
  for (const junction of junctions) {
    for (const parentId of junction.parentIds) {
      const edge = segmentEdge('parent', parentId, junction.id);
      layoutEdges.push(toElkEdge(edge));
      if (junction.kind === 'family') visibleEdges.push(edge);
    }
    for (const childId of junction.childIds) {
      const edge = segmentEdge('parent', junction.id, childId);
      layoutEdges.push(toElkEdge(edge));
      visibleEdges.push(edge);
    }
  }

  for (const [person1Id, person2Id] of partnerships) {
    visibleEdges.push(segmentEdge('partnership', person1Id, person2Id));
  }

  return { junctions, visibleEdges, layoutEdges };
}

function assignGenerations(graph: FamilyGraph): Map<string, number> {
  const personIds = graph.people.map(({ id }) => id);
  const acceptedPartnerships: [string, string][] = [];

  for (const pair of uniquePartnerships(graph.partnerships)) {
    const candidate = [...acceptedPartnerships, pair];
    if (partnershipGroupsAreAcyclic(personIds, graph.parentChild, candidate)) {
      acceptedPartnerships.push(pair);
    }
  }

  const groups = createGroups(personIds, acceptedPartnerships);
  const membersByGroup = new Map<string, string[]>();
  for (const id of personIds) {
    const root = groups.find(id);
    const members = membersByGroup.get(root) ?? [];
    members.push(id);
    membersByGroup.set(root, members);
  }

  const childGroups = new Map<string, Set<string>>();
  const indegrees = new Map([...membersByGroup.keys()].map((id) => [id, 0]));
  for (const { parentId, childId } of graph.parentChild) {
    const parentGroup = groups.find(parentId);
    const childGroup = groups.find(childId);
    if (parentGroup === childGroup) continue;
    const children = childGroups.get(parentGroup) ?? new Set<string>();
    if (!children.has(childGroup)) {
      children.add(childGroup);
      childGroups.set(parentGroup, children);
      indegrees.set(childGroup, (indegrees.get(childGroup) ?? 0) + 1);
    }
  }

  const generationsByGroup = new Map([...membersByGroup.keys()].map((id) => [id, 0]));
  const queue = [...indegrees]
    .filter(([, indegree]) => indegree === 0)
    .map(([id]) => id)
    .sort();
  for (let index = 0; index < queue.length; index += 1) {
    const parentGroup = queue[index]!;
    for (const childGroup of [...(childGroups.get(parentGroup) ?? [])].sort()) {
      generationsByGroup.set(
        childGroup,
        Math.max(generationsByGroup.get(childGroup) ?? 0, (generationsByGroup.get(parentGroup) ?? 0) + 1),
      );
      const nextIndegree = (indegrees.get(childGroup) ?? 0) - 1;
      indegrees.set(childGroup, nextIndegree);
      if (nextIndegree === 0) queue.push(childGroup);
    }
  }

  return new Map(personIds.map((id) => [id, generationsByGroup.get(groups.find(id)) ?? 0]));
}

function partnershipGroupsAreAcyclic(
  personIds: string[],
  parentChild: ParentChild[],
  partnerships: [string, string][],
) {
  const groups = createGroups(personIds, partnerships);
  const children = new Map<string, Set<string>>();
  const indegrees = new Map<string, number>();
  for (const id of personIds) indegrees.set(groups.find(id), 0);

  for (const edge of parentChild) {
    const parentGroup = groups.find(edge.parentId);
    const childGroup = groups.find(edge.childId);
    if (parentGroup === childGroup) return false;
    const groupChildren = children.get(parentGroup) ?? new Set<string>();
    if (!groupChildren.has(childGroup)) {
      groupChildren.add(childGroup);
      children.set(parentGroup, groupChildren);
      indegrees.set(childGroup, (indegrees.get(childGroup) ?? 0) + 1);
    }
  }

  const queue = [...indegrees].filter(([, indegree]) => indegree === 0).map(([id]) => id);
  let visited = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const group = queue[index]!;
    visited += 1;
    for (const child of children.get(group) ?? []) {
      const nextIndegree = (indegrees.get(child) ?? 0) - 1;
      indegrees.set(child, nextIndegree);
      if (nextIndegree === 0) queue.push(child);
    }
  }
  return visited === indegrees.size;
}

function createGroups(personIds: string[], partnerships: [string, string][]) {
  const parent = new Map(personIds.map((id) => [id, id]));
  const find = (id: string): string => {
    const current = parent.get(id);
    if (!current || current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    if (leftRoot < rightRoot) parent.set(rightRoot, leftRoot);
    else parent.set(leftRoot, rightRoot);
  };
  for (const [left, right] of partnerships) union(left, right);
  return { find };
}

function uniquePartnerships(partnerships: Partnership[]): [string, string][] {
  const pairs = new Map<string, [string, string]>();
  for (const partnership of partnerships) {
    const pair: [string, string] = partnership.person1Id < partnership.person2Id
      ? [partnership.person1Id, partnership.person2Id]
      : [partnership.person2Id, partnership.person1Id];
    pairs.set(idsKey(pair), pair);
  }
  return [...pairs.values()].sort((left, right) => idsKey(left).localeCompare(idsKey(right)));
}

function junctionPartition(junction: Junction, generations: Map<string, number>) {
  const parentGeneration = Math.max(...junction.parentIds.map((id) => generations.get(id) ?? 0));
  return parentGeneration * 2 + 1;
}

function personY(generation: number) {
  return CANVAS_PADDING + generation * (PERSON_NODE_HEIGHT + GENERATION_GAP);
}

function junctionY(junction: Junction, generations: Map<string, number>) {
  const parentBottom = Math.max(
    ...junction.parentIds.map((id) => personY(generations.get(id) ?? 0) + PERSON_NODE_HEIGHT),
  );
  if (junction.childIds.length === 0) return parentBottom + 48;
  const childTop = Math.min(...junction.childIds.map((id) => personY(generations.get(id) ?? 0)));
  return parentBottom + Math.max(24, (childTop - parentBottom - JUNCTION_NODE_SIZE) / 2);
}

function segmentEdge(kind: PositionedFamilyEdge['kind'], source: string, target: string): PositionedFamilyEdge {
  return {
    id: `edge:${kind}:${encodeURIComponent(source)}:${encodeURIComponent(target)}`,
    kind,
    source,
    target,
  };
}

function toElkEdge(edge: PositionedFamilyEdge): ElkExtendedEdge {
  return { id: `layout:${edge.id}`, sources: [edge.source], targets: [edge.target] };
}

function junctionId(kind: Junction['kind'], ids: string[]) {
  return `junction:${kind}:${ids.map((id) => encodeURIComponent(id)).join('|')}`;
}

function idsKey(ids: string[]) {
  return JSON.stringify([...ids].sort());
}

function requiredCoordinate(value: number | undefined, id: string, axis: 'x' | 'y') {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`ELK did not return a finite ${axis} coordinate for ${id}.`);
  }
  return value;
}

function extent(nodes: PositionedFamilyNode[], axis: 'x' | 'y') {
  const size = axis === 'x' ? 'width' : 'height';
  return Math.max(...nodes.map((node) => node.position[axis] + node[size])) + CANVAS_PADDING;
}
