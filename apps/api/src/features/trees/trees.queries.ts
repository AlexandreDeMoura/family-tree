import type pg from 'pg';

export type Queryable = Pick<pg.Pool, 'query'>;

export interface TreeSummary {
  id: string;
  name: string;
  createdAt: string;
}

export interface TreeQueries {
  createTree(database: Queryable, organizerUserId: string, name: string): Promise<TreeSummary>;
  findOwnedTree(
    database: Queryable,
    treeId: string,
    organizerUserId: string,
  ): Promise<TreeSummary | null>;
}

interface TreeRow {
  id: string;
  name: string;
  created_at: Date;
}

function toTreeSummary(row: TreeRow): TreeSummary {
  return { id: row.id, name: row.name, createdAt: row.created_at.toISOString() };
}

export const postgresTreeQueries: TreeQueries = {
  async createTree(database, organizerUserId, name) {
    const result = await database.query<TreeRow>(`
      INSERT INTO public.trees (organizer_user_id, name)
      VALUES ($1, $2)
      RETURNING id, name, created_at
    `, [organizerUserId, name]);
    return toTreeSummary(result.rows[0]);
  },

  async findOwnedTree(database, treeId, organizerUserId) {
    const result = await database.query<TreeRow>(`
      SELECT id, name, created_at
      FROM public.trees
      WHERE id = $1 AND organizer_user_id = $2
    `, [treeId, organizerUserId]);
    return result.rows[0] ? toTreeSummary(result.rows[0]) : null;
  },
};
