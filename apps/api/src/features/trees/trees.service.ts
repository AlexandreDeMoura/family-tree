import type pg from 'pg';
import type { FamilyGraph } from '@family-tree/family-core';
import { TreeAccessError } from '../../lib/api-errors.js';
import { postgresPeopleQueries, type PeopleQueries } from '../people/people.queries.js';
import { postgresTreeQueries, type TreeQueries, type TreeSummary } from './trees.queries.js';

export interface LoadedTree extends TreeSummary {
  graph: FamilyGraph;
}

export interface TreesService {
  createTree(organizerUserId: string, input: { name: string }): Promise<TreeSummary>;
  listTrees(organizerUserId: string): Promise<TreeSummary[]>;
  loadTree(organizerUserId: string, treeId: string): Promise<LoadedTree>;
}

export function createTreesService(
  database: pg.Pool,
  treeQueries: TreeQueries = postgresTreeQueries,
  peopleQueries: PeopleQueries = postgresPeopleQueries,
): TreesService {
  return {
    async createTree(organizerUserId, input) {
      return treeQueries.createTree(database, organizerUserId, input.name);
    },

    async listTrees(organizerUserId) {
      return treeQueries.listOwnedTrees(database, organizerUserId);
    },

    async loadTree(organizerUserId, treeId) {
      const tree = await treeQueries.findOwnedTree(database, treeId, organizerUserId);
      if (!tree) throw new TreeAccessError();
      return { ...tree, graph: await peopleQueries.loadGraph(database, treeId) };
    },
  };
}
