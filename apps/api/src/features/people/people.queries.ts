import type { FamilyGraph, Person } from '@family-tree/family-core';
import type { Queryable } from '../trees/trees.queries.js';

export interface PeopleQueries {
  loadGraph(database: Queryable, treeId: string): Promise<FamilyGraph>;
  insertPerson(database: Queryable, person: Person): Promise<void>;
  updatePerson(database: Queryable, person: Person): Promise<void>;
}

interface PersonRow {
  id: string;
  tree_id: string;
  first_name: string;
  last_name: string;
  life_status: Person['lifeStatus'];
  birth_year: number | null;
  death_year: number | null;
  adopted: boolean;
  main_photo_id: string | null;
  fun_facts: string[];
  parents_complete: boolean;
  partners_complete: boolean;
  children_complete: boolean;
}

function toPerson(row: PersonRow): Person {
  return {
    id: row.id,
    treeId: row.tree_id,
    firstName: row.first_name,
    lastName: row.last_name,
    lifeStatus: row.life_status,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    adopted: row.adopted,
    mainPhotoId: row.main_photo_id,
    funFacts: row.fun_facts,
    parentsComplete: row.parents_complete,
    partnersComplete: row.partners_complete,
    childrenComplete: row.children_complete,
  };
}

const personColumns = `id, tree_id, first_name, last_name, life_status,
  birth_year, death_year, adopted, main_photo_id, fun_facts,
  parents_complete, partners_complete, children_complete`;

export const postgresPeopleQueries: PeopleQueries = {
  async loadGraph(database, treeId) {
    const people = await database.query<PersonRow>(
      `SELECT ${personColumns} FROM public.people WHERE tree_id = $1 ORDER BY created_at, id`,
      [treeId],
    );
    const parentChild = await database.query<{ parent_id: string; child_id: string }>(`
      SELECT parent_id, child_id FROM public.parent_child
      WHERE tree_id = $1 ORDER BY parent_id, child_id
    `, [treeId]);
    const partnerships = await database.query<{ person1_id: string; person2_id: string }>(`
      SELECT person1_id, person2_id FROM public.partnerships
      WHERE tree_id = $1 ORDER BY person1_id, person2_id
    `, [treeId]);

    return {
      treeId,
      people: people.rows.map(toPerson),
      parentChild: parentChild.rows.map((edge) => ({
        parentId: edge.parent_id,
        childId: edge.child_id,
      })),
      partnerships: partnerships.rows.map((edge) => ({
        person1Id: edge.person1_id,
        person2Id: edge.person2_id,
      })),
    };
  },

  async insertPerson(database, person) {
    await database.query(`
      INSERT INTO public.people (
        id, tree_id, first_name, last_name, life_status, birth_year, death_year,
        adopted, main_photo_id, fun_facts, parents_complete, partners_complete,
        children_complete
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      person.id, person.treeId, person.firstName, person.lastName, person.lifeStatus,
      person.birthYear, person.deathYear, person.adopted, person.mainPhotoId,
      person.funFacts, person.parentsComplete, person.partnersComplete,
      person.childrenComplete,
    ]);
  },

  async updatePerson(database, person) {
    await database.query(`
      UPDATE public.people SET
        first_name = $3, last_name = $4, life_status = $5, birth_year = $6,
        death_year = $7, adopted = $8, fun_facts = $9, parents_complete = $10,
        partners_complete = $11, children_complete = $12
      WHERE tree_id = $1 AND id = $2
    `, [
      person.treeId, person.id, person.firstName, person.lastName, person.lifeStatus,
      person.birthYear, person.deathYear, person.adopted, person.funFacts,
      person.parentsComplete, person.partnersComplete, person.childrenComplete,
    ]);
  },
};
