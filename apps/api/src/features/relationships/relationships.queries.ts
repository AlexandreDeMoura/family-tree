import type { ParentChild, Partnership } from '@family-tree/family-core';
import type { Queryable } from '../trees/trees.queries.js';

export interface RelationshipQueries {
  insertParent(database: Queryable, treeId: string, edge: ParentChild): Promise<void>;
  deleteParent(database: Queryable, treeId: string, edge: ParentChild): Promise<boolean>;
  insertPartnership(database: Queryable, treeId: string, edge: Partnership): Promise<void>;
  deletePartnership(database: Queryable, treeId: string, edge: Partnership): Promise<boolean>;
}

export const postgresRelationshipQueries: RelationshipQueries = {
  async insertParent(database, treeId, edge) {
    await database.query(`
      INSERT INTO public.parent_child (tree_id, parent_id, child_id)
      VALUES ($1, $2, $3)
    `, [treeId, edge.parentId, edge.childId]);
  },

  async deleteParent(database, treeId, edge) {
    const result = await database.query(`
      DELETE FROM public.parent_child
      WHERE tree_id = $1 AND parent_id = $2 AND child_id = $3
      RETURNING parent_id
    `, [treeId, edge.parentId, edge.childId]);
    return result.rowCount === 1;
  },

  async insertPartnership(database, treeId, edge) {
    await database.query(`
      INSERT INTO public.partnerships (tree_id, person1_id, person2_id)
      VALUES ($1, $2, $3)
    `, [treeId, edge.person1Id, edge.person2Id]);
  },

  async deletePartnership(database, treeId, edge) {
    const result = await database.query(`
      DELETE FROM public.partnerships
      WHERE tree_id = $1 AND person1_id = $2 AND person2_id = $3
      RETURNING person1_id
    `, [treeId, edge.person1Id, edge.person2Id]);
    return result.rowCount === 1;
  },
};
