import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  validateFamilyGraph,
  validatePersonEdit,
  type Person,
} from '@family-tree/family-core';
import { DomainValidationError, PersonNotFoundError, TreeAccessError } from '../../lib/api-errors.js';
import { withTreeTransaction } from '../../lib/database.js';
import { postgresTreeQueries, type Queryable, type TreeQueries } from '../trees/trees.queries.js';
import { postgresPeopleQueries, type PeopleQueries } from './people.queries.js';

export type PersonFields = Omit<Person, 'id' | 'treeId' | 'mainPhotoId'>;
export type PersonPatch = Partial<PersonFields>;

export interface PeopleService {
  createPerson(organizerUserId: string, treeId: string, input: PersonFields): Promise<Person>;
  editPerson(
    organizerUserId: string,
    treeId: string,
    personId: string,
    patch: PersonPatch,
  ): Promise<Person>;
}

type TreeTransactionRunner = <T>(
  treeId: string,
  work: (database: Queryable) => Promise<T>,
) => Promise<T>;

interface PeopleServiceOptions {
  currentYear?: () => number;
  treeQueries?: TreeQueries;
  peopleQueries?: PeopleQueries;
  runInTreeTransaction?: TreeTransactionRunner;
  createId?: () => string;
}

export function createPeopleService(
  database: pg.Pool,
  options: PeopleServiceOptions = {},
): PeopleService {
  const treeQueries = options.treeQueries ?? postgresTreeQueries;
  const peopleQueries = options.peopleQueries ?? postgresPeopleQueries;
  const currentYear = options.currentYear ?? (() => new Date().getUTCFullYear());
  const createId = options.createId ?? randomUUID;
  const runInTreeTransaction = options.runInTreeTransaction
    ?? (<T>(treeId: string, work: (client: Queryable) => Promise<T>) =>
      withTreeTransaction(database, treeId, work));

  async function assertOwnership(client: Queryable, treeId: string, organizerUserId: string) {
    const tree = await treeQueries.findOwnedTree(client, treeId, organizerUserId);
    if (!tree) throw new TreeAccessError();
  }

  return {
    async createPerson(organizerUserId, treeId, input) {
      return runInTreeTransaction(treeId, async (client) => {
        await assertOwnership(client, treeId, organizerUserId);
        const graph = await peopleQueries.loadGraph(client, treeId);
        const candidate = { ...input, id: createId(), treeId, mainPhotoId: null };
        const validated = validateFamilyGraph({
          ...graph,
          people: [...graph.people, candidate],
        }, currentYear());
        if (!validated.success) throw new DomainValidationError(validated.issues);
        const person = validated.data.people.find(({ id }) => id === candidate.id)!;
        await peopleQueries.insertPerson(client, person);
        return person;
      });
    },

    async editPerson(organizerUserId, treeId, personId, patch) {
      return runInTreeTransaction(treeId, async (client) => {
        await assertOwnership(client, treeId, organizerUserId);
        const graph = await peopleQueries.loadGraph(client, treeId);
        const existing = graph.people.find(({ id }) => id === personId);
        if (!existing) throw new PersonNotFoundError();
        const validated = validatePersonEdit(graph, { ...existing, ...patch }, currentYear());
        if (!validated.success) throw new DomainValidationError(validated.issues);
        const person = validated.data.people.find(({ id }) => id === personId)!;
        await peopleQueries.updatePerson(client, person);
        return person;
      });
    },
  };
}
