import type { Queryable, TreeSummary } from '../trees/trees.queries.js';

export interface ShareLinkStatus {
  active: boolean;
  createdAt: string | null;
}

export interface SharingQueries {
  findStatusForOwner(
    database: Queryable,
    treeId: string,
    organizerUserId: string,
  ): Promise<ShareLinkStatus | null>;
  replaceForOwner(
    database: Queryable,
    treeId: string,
    organizerUserId: string,
    tokenHash: string,
  ): Promise<ShareLinkStatus | null>;
  resolveTree(
    database: Queryable,
    treeId: string,
    tokenHash: string,
  ): Promise<TreeSummary | null>;
}

interface ShareStatusRow {
  active: boolean;
  created_at: Date | null;
}

interface SharedTreeRow {
  id: string;
  name: string;
  created_at: Date;
}

function toStatus(row: ShareStatusRow): ShareLinkStatus {
  return {
    active: row.active,
    createdAt: row.created_at?.toISOString() ?? null,
  };
}

export const postgresSharingQueries: SharingQueries = {
  async findStatusForOwner(database, treeId, organizerUserId) {
    const result = await database.query<ShareStatusRow>(`
      SELECT share.tree_id IS NOT NULL AS active, share.created_at
      FROM public.trees AS tree
      LEFT JOIN public.tree_share_links AS share ON share.tree_id = tree.id
      WHERE tree.id = $1 AND tree.organizer_user_id = $2
    `, [treeId, organizerUserId]);
    return result.rows[0] ? toStatus(result.rows[0]) : null;
  },

  async replaceForOwner(database, treeId, organizerUserId, tokenHash) {
    const result = await database.query<ShareStatusRow>(`
      INSERT INTO public.tree_share_links (tree_id, token_hash)
      SELECT id, $3
      FROM public.trees
      WHERE id = $1 AND organizer_user_id = $2
      ON CONFLICT (tree_id) DO UPDATE
      SET token_hash = EXCLUDED.token_hash, created_at = now()
      RETURNING true AS active, created_at
    `, [treeId, organizerUserId, tokenHash]);
    return result.rows[0] ? toStatus(result.rows[0]) : null;
  },

  async resolveTree(database, treeId, tokenHash) {
    const result = await database.query<SharedTreeRow>(`
      SELECT tree.id, tree.name, tree.created_at
      FROM public.trees AS tree
      JOIN public.tree_share_links AS share ON share.tree_id = tree.id
      WHERE tree.id = $1 AND share.token_hash = $2
    `, [treeId, tokenHash]);
    const row = result.rows[0];
    return row ? { id: row.id, name: row.name, createdAt: row.created_at.toISOString() } : null;
  },
};

