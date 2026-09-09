import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabasePool, TreeNotFoundError, withTreeTransaction } from './database.js';

// Never reset the user's database. Create/drop only this randomly named database
// on the local Supabase cluster; reuse its real anon/authenticated/service roles.
const databaseName = `family_test_${randomUUID().replaceAll('-', '')}`;
let admin: pg.Pool | undefined;
let pool: pg.Pool;
let created = false;
const organizer = randomUUID();

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for database tests.');
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Database tests require a local Supabase PostgreSQL connection.');
  }
  if (url.searchParams.has('host') || url.searchParams.has('hostaddr')) {
    throw new Error('Database URL host overrides are not allowed in tests.');
  }
  admin = createDatabasePool(url.href);
  await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
  created = true;
  url.pathname = `/${databaseName}`;
  pool = createDatabasePool(url.href);
  // The only Auth dependency of application migrations is auth.users(id).
  // This fixture avoids copying the user's accounts or other local data.
  await pool.query(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `);
  const directory = new URL('../../../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    await pool.query(await readFile(new URL(file, directory), 'utf8'));
  }
  await pool.query('INSERT INTO auth.users (id) VALUES ($1)', [organizer]);
});

afterAll(async () => {
  try {
    if (pool) await pool.end();
    if (created) await admin!.query(`DROP DATABASE ${databaseName}`);
  } finally {
    await admin?.end();
  }
});

async function tree() {
  const result = await pool.query<{ id: string }>(
    'INSERT INTO public.trees (organizer_user_id, name) VALUES ($1, $2) RETURNING id',
    [organizer, 'Test family'],
  );
  return result.rows[0].id;
}

async function person(treeId: string) {
  const result = await pool.query<{ id: string }>(`
    INSERT INTO public.people (tree_id, first_name, last_name, life_status)
    VALUES ($1, 'Test', 'Person', 'unknown') RETURNING id`, [treeId]);
  return result.rows[0].id;
}

async function photo(treeId: string, personId: string, ageBucket = '20s') {
  const id = randomUUID();
  await pool.query(`INSERT INTO public.photos (id, tree_id, person_id, age_bucket, storage_path)
    VALUES ($1, $2, $3, $4, $5)`,
  [id, treeId, personId, ageBucket, `trees/${treeId}/people/${personId}/${id}.jpg`]);
  return id;
}

describe('family schema on a fresh local database', () => {
  it('requires an existing organizer and prevents deleting an owner with trees', async () => {
    await expect(pool.query("INSERT INTO public.trees (organizer_user_id, name) VALUES ($1, 'Family')",
      [randomUUID()])).rejects.toMatchObject({ code: '23503' });
    await expect(pool.query("INSERT INTO public.trees (name) VALUES ('Family')"))
      .rejects.toMatchObject({ code: '23502' });
    await tree();
    await expect(pool.query('DELETE FROM auth.users WHERE id = $1', [organizer]))
      .rejects.toMatchObject({ code: '23503' });
  });

  it('preserves unknown/default fields, explicit completeness, adoption, and nullable years', async () => {
    const treeId = await tree();
    const id = await person(treeId);
    const result = await pool.query('SELECT * FROM public.people WHERE id = $1', [id]);
    expect(result.rows[0]).toMatchObject({
      life_status: 'unknown', birth_year: null, death_year: null, adopted: false,
      main_photo_id: null, fun_facts: [], parents_complete: false,
      partners_complete: false, children_complete: false,
    });
    await pool.query(`UPDATE public.people SET adopted = true, children_complete = true,
      fun_facts = ARRAY['One', 'Two', 'Three'], birth_year = 1900, death_year = 1900 WHERE id = $1`, [id]);
    const updated = await pool.query('SELECT * FROM public.people WHERE id = $1', [id]);
    expect(updated.rows[0]).toMatchObject({ adopted: true, children_complete: true, death_year: 1900 });
  });

  it.each([
    ["life_status = 'invalid'", '23514'],
    ["life_status = null", '23502'],
    ["first_name = E' \t\n'", '23514'],
    ["last_name = ''", '23514'],
    ['birth_year = 2000, death_year = 1999', '23514'],
    ["life_status = 'living', death_year = 2000", '23514'],
    ["death_year = extract(year from current_timestamp at time zone 'UTC')::int + 1", '23514'],
    ["fun_facts = ARRAY['a', 'b', 'c', 'd']", '23514'],
    ["fun_facts = ARRAY['a', null]", '23514'],
    ["fun_facts = ARRAY['a', E' \t']", '23514'],
    ["fun_facts = ARRAY[['a', 'b']]", '23514'],
    ["fun_facts = '[0:0]={a}'::text[]", '23514'],
    ['fun_facts = null', '23502'],
  ])('rejects malformed person update: %s', async (assignment, code) => {
    const id = await person(await tree());
    await expect(pool.query(`UPDATE public.people SET ${assignment} WHERE id = $1`, [id]))
      .rejects.toMatchObject({ code });
  });

  it('rejects invalid person inserts too', async () => {
    await expect(pool.query(`INSERT INTO public.people
      (tree_id, first_name, last_name, life_status, death_year)
      VALUES ($1, 'Test', 'Person', 'living', 2000)`, [await tree()]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(`INSERT INTO public.people
      (tree_id, first_name, last_name, life_status, death_year)
      VALUES ($1, 'Test', 'Person', 'deceased', 2147483647)`, [await tree()]))
      .rejects.toMatchObject({ code: '23514', constraint: 'people_future_death' });
  });

  it('rejects cross-tree edges, duplicate edges, self-links, and reversed partnerships', async () => {
    const treeId = await tree();
    const [a, b, c] = (await Promise.all([person(treeId), person(treeId), person(treeId)])).sort();
    const outsider = await person(await tree());
    await pool.query('INSERT INTO public.parent_child VALUES ($1, $2, $3)', [treeId, a, b]);
    await expect(pool.query('INSERT INTO public.parent_child VALUES ($1, $2, $3)', [treeId, a, b]))
      .rejects.toMatchObject({ code: '23505' });
    await expect(pool.query('INSERT INTO public.parent_child VALUES ($1, $2, $2)', [treeId, a]))
      .rejects.toMatchObject({ code: '23514' });
    for (const pair of [[a, outsider], [outsider, b], [a, randomUUID()]]) {
      await expect(pool.query('INSERT INTO public.parent_child VALUES ($1, $2, $3)', [treeId, ...pair]))
        .rejects.toMatchObject({ code: '23503' });
    }
    await pool.query('INSERT INTO public.partnerships VALUES ($1, $2, $3), ($1, $2, $4)', [treeId, a, b, c]);
    await expect(pool.query('INSERT INTO public.partnerships VALUES ($1, $2, $3)', [treeId, a, b]))
      .rejects.toMatchObject({ code: '23505' });
    await expect(pool.query('INSERT INTO public.partnerships VALUES ($1, $2, $3)', [treeId, b, a]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO public.partnerships VALUES ($1, $2, $2)', [treeId, a]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('INSERT INTO public.partnerships VALUES ($1, $2, $3)', [treeId, ...[a, outsider].sort()]))
      .rejects.toMatchObject({ code: '23503' });
    await expect(pool.query('UPDATE public.people SET tree_id = $1 WHERE id = $2', [await tree(), a]))
      .rejects.toMatchObject({ code: '23503' });
  });

  it('enforces photo paths, bucket values, person/tree ownership, and main-photo ownership', async () => {
    const treeId = await tree();
    const a = await person(treeId);
    const b = await person(treeId);
    const otherTree = await tree();
    const outsider = await person(otherTree);
    await expect(photo(treeId, outsider)).rejects.toMatchObject({ code: '23503' });
    await expect(photo(treeId, a, 'invalid')).rejects.toMatchObject({ code: '23514' });
    const ownPhoto = await photo(treeId, a);
    const otherPhoto = await photo(treeId, b);
    const outsidePhoto = await photo(otherTree, outsider);
    for (const id of [otherPhoto, outsidePhoto, randomUUID()]) {
      await expect(pool.query('UPDATE public.people SET main_photo_id = $1 WHERE id = $2', [id, a]))
        .rejects.toMatchObject({ code: '23503' });
    }
    await pool.query('UPDATE public.people SET main_photo_id = $1 WHERE id = $2', [ownPhoto, a]);
    await expect(pool.query("UPDATE public.photos SET storage_path = 'https://example.com/signed.jpg' WHERE id = $1", [ownPhoto]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('UPDATE public.photos SET age_bucket = null WHERE id = $1', [ownPhoto]))
      .rejects.toMatchObject({ code: '23502' });
    for (const bucket of ['baby_toddler', 'kid', 'adolescent', '20s', '30s', '40s', '50s', '60s', '70s', '80s', '90s_plus']) {
      await photo(treeId, a, bucket);
    }
  });

  it('clears deleted portraits and cascades person/tree metadata and relationships', async () => {
    const treeId = await tree();
    const [a, b] = (await Promise.all([person(treeId), person(treeId)])).sort();
    const portrait = await photo(treeId, a);
    await pool.query('UPDATE public.people SET main_photo_id = $1 WHERE id = $2', [portrait, a]);
    await pool.query('DELETE FROM public.photos WHERE id = $1', [portrait]);
    expect((await pool.query('SELECT main_photo_id, tree_id FROM public.people WHERE id = $1', [a])).rows[0])
      .toEqual({ main_photo_id: null, tree_id: treeId });
    const nextPortrait = await photo(treeId, a);
    await pool.query('UPDATE public.people SET main_photo_id = $1 WHERE id = $2', [nextPortrait, a]);
    await pool.query('INSERT INTO public.parent_child VALUES ($1, $2, $3)', [treeId, a, b]);
    await pool.query('INSERT INTO public.partnerships VALUES ($1, $2, $3)', [treeId, a, b]);
    await pool.query('DELETE FROM public.people WHERE id = $1', [a]);
    for (const table of ['photos', 'parent_child', 'partnerships']) {
      expect((await pool.query(`SELECT * FROM public.${table} WHERE tree_id = $1`, [treeId])).rows).toEqual([]);
    }
    const remainingPortrait = await photo(treeId, b);
    await pool.query('UPDATE public.people SET main_photo_id = $1 WHERE id = $2', [remainingPortrait, b]);
    await pool.query('DELETE FROM public.trees WHERE id = $1', [treeId]);
    for (const table of ['people', 'photos', 'parent_child', 'partnerships']) {
      expect((await pool.query(`SELECT * FROM public.${table} WHERE tree_id = $1`, [treeId])).rows).toEqual([]);
    }
  });
});

describe('private access boundaries', () => {
  const tables = ['trees', 'people', 'parent_child', 'partnerships', 'photos'];

  it.each(['anon', 'authenticated'])('denies direct %s reads and writes on every family table', async (role) => {
    const client = await pool.connect();
    try {
      await client.query(`SET ROLE ${role}`);
      for (const table of tables) {
        for (const query of [
          `SELECT * FROM public.${table}`,
          `INSERT INTO public.${table} DEFAULT VALUES`,
          `UPDATE public.${table} SET ${table === 'trees' ? 'name = name' : 'tree_id = tree_id'}`,
          `DELETE FROM public.${table}`,
          `TRUNCATE public.${table} CASCADE`,
        ]) {
          await expect(client.query(query)).rejects.toMatchObject({ code: '42501' });
        }
      }
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  });

  it('keeps RLS default-deny even if browser privileges are accidentally granted', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const table of tables) await client.query(`GRANT SELECT, INSERT ON public.${table} TO anon, authenticated`);
      for (const role of ['anon', 'authenticated']) {
        await client.query(`SET LOCAL ROLE ${role}`);
        for (const table of tables) {
          expect((await client.query(`SELECT * FROM public.${table}`)).rows).toEqual([]);
        }
        await client.query('SAVEPOINT denied_write');
        await expect(client.query("INSERT INTO public.trees (organizer_user_id, name) VALUES ($1, 'Denied')", [organizer]))
          .rejects.toMatchObject({ code: '42501' });
        await client.query('ROLLBACK TO SAVEPOINT denied_write');
        await client.query('RESET ROLE');
      }
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('allows the trusted server role while exposing no share secrets or public policies', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE service_role');
      await client.query("INSERT INTO public.trees (organizer_user_id, name) VALUES ($1, 'Server')", [organizer]);
      expect((await client.query('SELECT * FROM public.trees')).rowCount).toBeGreaterThan(0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trees'");
    expect(columns.rows.map((row) => row.column_name).sort()).toEqual(['created_at', 'id', 'name', 'organizer_user_id']);
    expect((await pool.query("SELECT * FROM pg_policies WHERE schemaname = 'public'")).rows).toEqual([]);
  });
});

describe('tree transactions', () => {
  it('commits results and rolls back callback/SQL failures before reusing the pool', async () => {
    const treeId = await tree();
    expect(await withTreeTransaction(pool, treeId, async (client) => {
      await client.query("UPDATE public.trees SET name = 'Committed' WHERE id = $1", [treeId]);
      return 'result';
    })).toBe('result');
    const failure = new Error('Invalid graph');
    await expect(withTreeTransaction(pool, treeId, async (client) => {
      await client.query("UPDATE public.trees SET name = 'Rollback' WHERE id = $1", [treeId]);
      throw failure;
    })).rejects.toBe(failure);
    await expect(withTreeTransaction(pool, treeId, async (client) => {
      await client.query("UPDATE public.trees SET name = '' WHERE id = $1", [treeId]);
    })).rejects.toMatchObject({ code: '23514' });
    expect((await pool.query('SELECT name FROM public.trees WHERE id = $1', [treeId])).rows[0].name).toBe('Committed');
    let called = false;
    await expect(withTreeTransaction(pool, randomUUID(), async () => { called = true; }))
      .rejects.toBeInstanceOf(TreeNotFoundError);
    expect(called).toBe(false);
  });

  it('blocks the same tree before invoking work, reads fresh state, and leaves other trees independent', async () => {
    const treeId = await tree();
    const otherTree = await tree();
    const holder = await pool.connect();
    let waiting: Promise<string> | undefined;
    let entered = false;
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM public.trees WHERE id = $1 FOR UPDATE', [treeId]);
      await holder.query("UPDATE public.trees SET name = 'After lock' WHERE id = $1", [treeId]);
      waiting = withTreeTransaction(pool, treeId, async (client) => {
        entered = true;
        return (await client.query('SELECT name FROM public.trees WHERE id = $1', [treeId])).rows[0].name as string;
      });
      // Observe the actual PostgreSQL lock wait instead of assuming timing.
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await pool.query(`SELECT 1 FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query = 'SELECT id FROM public.trees WHERE id = $1 FOR UPDATE'`);
        if (result.rowCount) { blocked = true; break; }
        await delay(20);
      }
      expect(blocked).toBe(true);
      expect(entered).toBe(false);
      await withTreeTransaction(pool, otherTree, async (client) => {
        await client.query("UPDATE public.trees SET name = 'Independent' WHERE id = $1", [otherTree]);
      });
      await holder.query('COMMIT');
      expect(await waiting).toBe('After lock');
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
      await waiting;
    }
  });
});
