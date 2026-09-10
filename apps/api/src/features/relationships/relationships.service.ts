import type pg from 'pg';
import {
  validateFamilyGraph,
  validateParentRelationship,
  validatePartnership,
  type FamilyGraph,
  type ParentChild,
  type Partnership,
} from '@family-tree/family-core';
import {
  DomainValidationError,
  RelationshipNotFoundError,
  TreeAccessError,
} from '../../lib/api-errors.js';
import { withTreeTransaction } from '../../lib/database.js';
import { postgresPeopleQueries, type PeopleQueries } from '../people/people.queries.js';
import { postgresTreeQueries, type Queryable, type TreeQueries } from '../trees/trees.queries.js';
import {
  postgresRelationshipQueries,
  type RelationshipQueries,
} from './relationships.queries.js';

export interface RelationshipsService {
  addParent(
    organizerUserId: string,
    treeId: string,
    edge: ParentChild,
  ): Promise<FamilyGraph>;
  removeParent(
    organizerUserId: string,
    treeId: string,
    edge: ParentChild,
  ): Promise<FamilyGraph>;
  addPartnership(
    organizerUserId: string,
    treeId: string,
    edge: Partnership,
  ): Promise<FamilyGraph>;
  removePartnership(
    organizerUserId: string,
    treeId: string,
    edge: Partnership,
  ): Promise<FamilyGraph>;
}

type TreeTransactionRunner = <T>(
  treeId: string,
  work: (database: Queryable) => Promise<T>,
) => Promise<T>;

interface RelationshipsServiceOptions {
  currentYear?: () => number;
  treeQueries?: TreeQueries;
  peopleQueries?: PeopleQueries;
  relationshipQueries?: RelationshipQueries;
  runInTreeTransaction?: TreeTransactionRunner;
}

function canonicalPartnership(edge: Partnership): Partnership {
  return edge.person1Id < edge.person2Id
    ? edge
    : { person1Id: edge.person2Id, person2Id: edge.person1Id };
}

export function createRelationshipsService(
  database: pg.Pool,
  options: RelationshipsServiceOptions = {},
): RelationshipsService {
  const treeQueries = options.treeQueries ?? postgresTreeQueries;
  const peopleQueries = options.peopleQueries ?? postgresPeopleQueries;
  const relationshipQueries = options.relationshipQueries ?? postgresRelationshipQueries;
  const currentYear = options.currentYear ?? (() => new Date().getUTCFullYear());
  const runInTreeTransaction = options.runInTreeTransaction
    ?? (<T>(treeId: string, work: (client: Queryable) => Promise<T>) =>
      withTreeTransaction(database, treeId, work));

  async function mutate(
    organizerUserId: string,
    treeId: string,
    update: (client: Queryable, graph: FamilyGraph) => Promise<void>,
  ) {
    return runInTreeTransaction(treeId, async (client) => {
      const tree = await treeQueries.findOwnedTree(client, treeId, organizerUserId);
      if (!tree) throw new TreeAccessError();
      const graph = await peopleQueries.loadGraph(client, treeId);
      await update(client, graph);
      return peopleQueries.loadGraph(client, treeId);
    });
  }

  return {
    async addParent(organizerUserId, treeId, edge) {
      return mutate(organizerUserId, treeId, async (client, graph) => {
        const validated = validateParentRelationship(graph, edge, currentYear());
        if (!validated.success) throw new DomainValidationError(validated.issues);
        await relationshipQueries.insertParent(client, treeId, edge);
      });
    },

    async removeParent(organizerUserId, treeId, edge) {
      return mutate(organizerUserId, treeId, async (client, graph) => {
        const index = graph.parentChild.findIndex((candidate) =>
          candidate.parentId === edge.parentId && candidate.childId === edge.childId);
        if (index < 0) throw new RelationshipNotFoundError('parent');
        const parentChild = graph.parentChild.filter((_, candidateIndex) => candidateIndex !== index);
        const validated = validateFamilyGraph({ ...graph, parentChild }, currentYear());
        if (!validated.success) throw new DomainValidationError(validated.issues);
        if (!await relationshipQueries.deleteParent(client, treeId, edge)) {
          throw new RelationshipNotFoundError('parent');
        }
      });
    },

    async addPartnership(organizerUserId, treeId, edge) {
      return mutate(organizerUserId, treeId, async (client, graph) => {
        const validated = validatePartnership(graph, edge, currentYear());
        if (!validated.success) throw new DomainValidationError(validated.issues);
        const partnership = validated.data.partnerships[validated.data.partnerships.length - 1];
        await relationshipQueries.insertPartnership(client, treeId, partnership);
      });
    },

    async removePartnership(organizerUserId, treeId, edge) {
      return mutate(organizerUserId, treeId, async (client, graph) => {
        const partnership = canonicalPartnership(edge);
        const index = graph.partnerships.findIndex((candidate) =>
          candidate.person1Id === partnership.person1Id
          && candidate.person2Id === partnership.person2Id);
        if (index < 0) throw new RelationshipNotFoundError('partnership');
        const partnerships = graph.partnerships.filter((_, candidateIndex) => candidateIndex !== index);
        const validated = validateFamilyGraph({ ...graph, partnerships }, currentYear());
        if (!validated.success) throw new DomainValidationError(validated.issues);
        if (!await relationshipQueries.deletePartnership(client, treeId, partnership)) {
          throw new RelationshipNotFoundError('partnership');
        }
      });
    },
  };
}
