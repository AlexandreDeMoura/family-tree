import { useEffect, useMemo, useState } from 'react';
import type { FamilyGraph, Person } from '@family-tree/family-core';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import { projectFocusedFamilyGraph } from '../people/person-card';
import {
  layoutFamilyGraph,
  type PositionedFamilyGraph,
} from './layout-family-graph';

interface FamilyTreeProps {
  graph: FamilyGraph;
  selectedPersonId?: string | null;
  onSelectPerson?: (personId: string) => void;
}

interface PersonNodeData extends Record<string, unknown> {
  person: Person;
  active: boolean;
  prominent: boolean;
}

interface JunctionNodeData extends Record<string, unknown> {
  hidden: boolean;
  prominent: boolean;
}

type PersonFlowNode = Node<PersonNodeData, 'person'>;
type JunctionFlowNode = Node<JunctionNodeData, 'junction'>;
type FamilyFlowNode = PersonFlowNode | JunctionFlowNode;

type LayoutState =
  | { graph: FamilyGraph; status: 'ready'; layout: PositionedFamilyGraph }
  | { graph: FamilyGraph; status: 'error'; message: string };

const nodeTypes: NodeTypes = {
  person: PersonTreeNode,
  junction: JunctionTreeNode,
};

export function FamilyTree({ graph, selectedPersonId, onSelectPerson }: FamilyTreeProps) {
  const [resolvedLayout, setResolvedLayout] = useState<LayoutState | null>(null);
  const focusedGraph = useMemo(
    () => selectedPersonId ? projectFocusedFamilyGraph(graph, selectedPersonId) : null,
    [graph, selectedPersonId],
  );
  const prominentPersonIds = useMemo(
    () => focusedGraph ? new Set(focusedGraph.people.map(({ id }) => id)) : null,
    [focusedGraph],
  );

  useEffect(() => {
    let active = true;
    void layoutFamilyGraph(graph).then(
      (layout) => {
        if (active) setResolvedLayout({ graph, status: 'ready', layout });
      },
      (error: unknown) => {
        if (active) {
          setResolvedLayout({
            graph,
            status: 'error',
            message: error instanceof Error ? error.message : 'The family layout could not be created.',
          });
        }
      },
    );
    return () => { active = false; };
  }, [graph]);

  const layoutState = resolvedLayout?.graph === graph ? resolvedLayout : null;

  if (!layoutState) {
    return <div className="family-tree-state" role="status"><div className="loading-orb" /><span>Arranging generations…</span></div>;
  }
  if (layoutState.status === 'error') {
    return <div className="family-tree-state family-tree-state--error" role="alert">{layoutState.message}</div>;
  }
  if (layoutState.layout.nodes.length === 0) {
    return <div className="family-tree-state">Add someone to begin the family map.</div>;
  }

  return (
    <FamilyTreeCanvas
      layout={layoutState.layout}
      selectedPersonId={selectedPersonId}
      prominentPersonIds={prominentPersonIds}
      onSelectPerson={onSelectPerson}
    />
  );
}

function FamilyTreeCanvas({
  layout,
  selectedPersonId,
  prominentPersonIds,
  onSelectPerson,
}: {
  layout: PositionedFamilyGraph;
  selectedPersonId?: string | null;
  prominentPersonIds: Set<string> | null;
  onSelectPerson?: (personId: string) => void;
}) {
  const [flow, setFlow] = useState<ReactFlowInstance<FamilyFlowNode, Edge> | null>(null);
  const { nodes, edges } = useMemo(
    () => toReactFlowGraph(layout, selectedPersonId, prominentPersonIds),
    [layout, prominentPersonIds, selectedPersonId],
  );

  useEffect(() => {
    if (!flow) return;
    const visiblePeople = nodes
      .filter((node) => node.type === 'person' && (!prominentPersonIds || prominentPersonIds.has(node.id)))
      .map(({ id }) => ({ id }));
    void flow.fitView({
      nodes: visiblePeople,
      padding: selectedPersonId ? 0.35 : 0.18,
      maxZoom: selectedPersonId ? 1.05 : 1,
      duration: 350,
    });
  }, [flow, nodes, prominentPersonIds, selectedPersonId]);

  return (
    <div className="family-tree-canvas" aria-label="Interactive family tree">
      <ReactFlow<FamilyFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        minZoom={0.15}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        onlyRenderVisibleElements
        onInit={setFlow}
        onNodeClick={(_, node) => {
          if (node.type === 'person') onSelectPerson?.(node.id);
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#c7d0c8" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => node.type === 'person' ? '#56796c' : '#c9954e'}
          nodeStrokeWidth={2}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function toReactFlowGraph(
  layout: PositionedFamilyGraph,
  selectedPersonId?: string | null,
  prominentPersonIds?: Set<string> | null,
) {
  const positionedById = new Map(layout.nodes.map((node) => [node.id, node]));
  const prominentJunctionIds = new Set(layout.nodes.flatMap((node) => {
    if (node.kind !== 'junction' || !prominentPersonIds) return [];
    const hasProminentParent = node.parentIds.some((id) => prominentPersonIds.has(id));
    const hasProminentChild = node.childIds.some((id) => prominentPersonIds.has(id));
    return hasProminentParent && hasProminentChild ? [node.id] : [];
  }));
  const nodes = layout.nodes.map<FamilyFlowNode>((node) => {
    if (node.kind === 'person') {
      const active = node.id === selectedPersonId;
      const prominent = !prominentPersonIds || prominentPersonIds.has(node.id);
      return {
        id: node.id,
        type: 'person',
        position: node.position,
        width: node.width,
        height: node.height,
        draggable: false,
        selectable: true,
        selected: active,
        className: prominent ? 'family-flow-node family-flow-node--prominent' : 'family-flow-node family-flow-node--distant',
        ariaLabel: `${node.person.firstName} ${node.person.lastName}, ${birthYearLabel(node.person)}`,
        data: { person: node.person, active, prominent },
      };
    }
    const prominent = !prominentPersonIds || prominentJunctionIds.has(node.id);
    return {
      id: node.id,
      type: 'junction',
      position: node.position,
      width: node.width,
      height: node.height,
      draggable: false,
      selectable: false,
      focusable: false,
      hidden: node.junctionKind === 'partnership',
      className: prominent ? 'family-flow-node family-flow-node--prominent' : 'family-flow-node family-flow-node--distant',
      data: { hidden: node.junctionKind === 'partnership', prominent },
    };
  });

  const edges = layout.edges.map<Edge>((edge) => {
    const prominent = !prominentPersonIds || (
      edge.kind === 'partnership'
        ? prominentPersonIds.has(edge.source) && prominentPersonIds.has(edge.target)
        : edgeIsProminent(edge.source, edge.target, prominentPersonIds, prominentJunctionIds)
    );
    const focusClassName = prominent ? 'is-prominent' : 'is-distant';
    if (edge.kind === 'partnership') {
      const source = positionedById.get(edge.source);
      const target = positionedById.get(edge.target);
      const sourceIsLeft = (source?.position.x ?? 0) <= (target?.position.x ?? 0);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: sourceIsLeft ? 'partner-source-right' : 'partner-source-left',
        targetHandle: sourceIsLeft ? 'partner-target-left' : 'partner-target-right',
        type: 'straight',
        selectable: false,
        className: `family-edge family-edge--partnership ${focusClassName}`,
      };
    }

    const source = positionedById.get(edge.source);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: source?.kind === 'junction' ? 'junction-source' : 'family-source',
      targetHandle: source?.kind === 'junction' ? 'family-target' : 'junction-target',
      type: 'smoothstep',
      pathOptions: { borderRadius: 12 },
      selectable: false,
      className: `family-edge family-edge--parent ${focusClassName}`,
    };
  });

  return { nodes, edges };
}

function PersonTreeNode({ data }: NodeProps<PersonFlowNode>) {
  const { person, active } = data;
  const incomplete = isIncomplete(person);
  return (
    <article className={active ? 'tree-person is-active' : 'tree-person'}>
      <Handle className="tree-handle" id="family-target" type="target" position={Position.Top} />
      <Handle className="tree-handle" id="family-source" type="source" position={Position.Bottom} />
      <Handle className="tree-handle" id="partner-source-left" type="source" position={Position.Left} />
      <Handle className="tree-handle" id="partner-target-left" type="target" position={Position.Left} />
      <Handle className="tree-handle" id="partner-source-right" type="source" position={Position.Right} />
      <Handle className="tree-handle" id="partner-target-right" type="target" position={Position.Right} />

      <div className="tree-person__portrait" aria-hidden="true">
        <span>{initials(person)}</span>
      </div>
      <div className="tree-person__identity">
        <strong>{person.firstName}</strong>
        <span>{person.lastName}</span>
        <small>{birthYearLabel(person)}</small>
      </div>
      {(person.adopted || person.lifeStatus === 'deceased' || incomplete) && (
        <div className="tree-person__badges" aria-label="Person details">
          {person.lifeStatus === 'deceased' && <span className="tree-badge tree-badge--memory" title="Remembered family member">✦ Remembered</span>}
          {person.adopted && <span className="tree-badge">Adopted</span>}
          {incomplete && <span className="tree-badge tree-badge--discovery" title="Some information is still unknown">◌ Discover</span>}
        </div>
      )}
    </article>
  );
}

function edgeIsProminent(
  source: string,
  target: string,
  prominentPersonIds: Set<string>,
  prominentJunctionIds: Set<string>,
) {
  const sourceProminent = prominentPersonIds.has(source) || prominentJunctionIds.has(source);
  const targetProminent = prominentPersonIds.has(target) || prominentJunctionIds.has(target);
  return sourceProminent && targetProminent;
}

function JunctionTreeNode({ data }: NodeProps<JunctionFlowNode>) {
  if (data.hidden) return null;
  return (
    <div className="tree-junction" aria-hidden="true">
      <Handle className="tree-handle" id="junction-target" type="target" position={Position.Top} />
      <Handle className="tree-handle" id="junction-source" type="source" position={Position.Bottom} />
    </div>
  );
}

function initials(person: Person) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

function birthYearLabel(person: Person) {
  return person.birthYear === null ? 'Birth year unknown' : `Born ${person.birthYear}`;
}

function isIncomplete(person: Person) {
  return person.birthYear === null
    || person.lifeStatus === 'unknown'
    || !person.parentsComplete
    || !person.partnersComplete
    || !person.childrenComplete;
}
