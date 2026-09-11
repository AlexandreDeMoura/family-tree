import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  createMvpAcceptanceGraph,
  validateFamilyGraph,
} from '../../../packages/family-core/dist/index.js';

for (const name of ['DATABASE_URL', 'ORGANIZER_USER_ID']) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const databaseUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('Manual acceptance fixtures can only be seeded into local PostgreSQL.');
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(process.env.ORGANIZER_USER_ID)) {
  throw new Error('ORGANIZER_USER_ID must be a UUID.');
}

const source = createMvpAcceptanceGraph();
const currentYear = new Date().getUTCFullYear();
const validation = validateFamilyGraph(source, currentYear);
if (!validation.success) {
  throw new Error(`Acceptance fixture is invalid: ${JSON.stringify(validation.issues)}`);
}

const pool = new pg.Pool({ connectionString: databaseUrl.href });
const client = await pool.connect();
let transactionStarted = false;
try {
  const owner = await client.query('SELECT id FROM auth.users WHERE id = $1', [process.env.ORGANIZER_USER_ID]);
  if (owner.rowCount !== 1) {
    throw new Error('ORGANIZER_USER_ID does not identify a local Supabase Auth user.');
  }

  await client.query('BEGIN');
  transactionStarted = true;
  const created = await client.query(
    `INSERT INTO public.trees (organizer_user_id, name)
     VALUES ($1, $2) RETURNING id, name`,
    [process.env.ORGANIZER_USER_ID, `MVP Manual Acceptance ${new Date().toISOString().slice(0, 10)}`],
  );
  const tree = created.rows[0];
  const personIds = new Map(source.people.map(({ id }) => [id, randomUUID()]));

  for (const person of source.people) {
    await client.query(`
      INSERT INTO public.people (
        id, tree_id, first_name, last_name, life_status, birth_year, death_year,
        adopted, fun_facts, parents_complete, partners_complete, children_complete
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      personIds.get(person.id), tree.id, person.firstName, person.lastName,
      person.lifeStatus, person.birthYear, person.deathYear, person.adopted,
      person.funFacts, person.parentsComplete, person.partnersComplete,
      person.childrenComplete,
    ]);
  }

  for (const { parentId, childId } of source.parentChild) {
    await client.query(
      'INSERT INTO public.parent_child (tree_id, parent_id, child_id) VALUES ($1, $2, $3)',
      [tree.id, personIds.get(parentId), personIds.get(childId)],
    );
  }
  for (const { person1Id, person2Id } of source.partnerships) {
    const [firstId, secondId] = [personIds.get(person1Id), personIds.get(person2Id)].sort();
    await client.query(
      'INSERT INTO public.partnerships (tree_id, person1_id, person2_id) VALUES ($1, $2, $3)',
      [tree.id, firstId, secondId],
    );
  }

  await client.query('COMMIT');
  transactionStarted = false;
  console.log(`Created "${tree.name}" with ${source.people.length} people.`);
  console.log(`Organizer URL: http://localhost:5173/organizer/trees/${tree.id}`);
} catch (error) {
  if (transactionStarted) await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
