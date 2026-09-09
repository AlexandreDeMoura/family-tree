import pg from 'pg';

/** Server-only SQL client; callers own the pool lifecycle. */
export function createDatabasePool(connectionString: string) {
  return new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000 });
}

export class TreeNotFoundError extends Error {
  readonly code = 'tree_not_found';

  constructor() {
    super('Tree not found.');
    this.name = 'TreeNotFoundError';
  }
}

/**
 * All graph writes (including person edits/deletes) must use this boundary.
 * Authorize the organizer and validate the current graph inside the callback,
 * using only this client. Never read a graph snapshot before obtaining the lock.
 * READ COMMITTED gives waiting writers a fresh snapshot after the lock is won.
 */
export async function withTreeTransaction<T>(
  pool: pg.Pool,
  treeId: string,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const tree = await client.query('SELECT id FROM public.trees WHERE id = $1 FOR UPDATE', [treeId]);
    if (tree.rowCount !== 1) throw new TreeNotFoundError();
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // A broken connection must not return to the pool; preserve the cause.
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
