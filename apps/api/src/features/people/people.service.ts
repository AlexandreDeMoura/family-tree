import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  validateFamilyGraph,
  validatePersonEdit,
  type FamilyGraph,
  type ParentChild,
  type Partnership,
  type Person,
} from '@family-tree/family-core';
import { DomainValidationError, PersonNotFoundError, TreeAccessError } from '../../lib/api-errors.js';
import { withTreeTransaction } from '../../lib/database.js';
import { postgresTreeQueries, type Queryable, type TreeQueries } from '../trees/trees.queries.js';
import { postgresPeopleQueries, type PeopleQueries } from './people.queries.js';
import {
  postgresRelationshipQueries,
  type RelationshipQueries,
} from '../relationships/relationships.queries.js';

export type PersonFields = Omit<Person, 'id' | 'treeId' | 'mainPhotoId'>;
export type PersonPatch = Partial<PersonFields>;
export interface PersonWorkspaceRelationships {
  parentIds: string[];
  partnerIds: string[];
  childIds: string[];
}

export interface PeopleService {
  createPerson(organizerUserId: string, treeId: string, input: PersonFields): Promise<Person>;
  editPerson(
    organizerUserId: string,
    treeId: string,
    personId: string,
    patch: PersonPatch,
  ): Promise<Person>;
  savePersonWorkspace(
    organizerUserId: string,
    treeId: string,
    input: PersonFields,
    relationships: PersonWorkspaceRelationships,
    personId?: string,
  ): Promise<{ person: Person; graph: FamilyGraph }>;
}

type TreeTransactionRunner = <T>(
  treeId: string,
  work: (database: Queryable) => Promise<T>,
) => Promise<T>;

interface PeopleServiceOptions {
  currentYear?: () => number;
  treeQueries?: TreeQueries;
  peopleQueries?: PeopleQueries;
  relationshipQueries?: RelationshipQueries;
  runInTreeTransaction?: TreeTransactionRunner;
  createId?: () => string;
}

export function createPeopleService(
  database: pg.Pool,
  options: PeopleServiceOptions = {},
): PeopleService {
  const treeQueries = options.treeQueries ?? postgresTreeQueries;
  const peopleQueries = options.peopleQueries ?? postgresPeopleQueries;
  const relationshipQueries = options.relationshipQueries ?? postgresRelationshipQueries;
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

    async savePersonWorkspace(organizerUserId, treeId, input, relationships, personId) {
      return runInTreeTransaction(treeId, async (client) => {
        await assertOwnership(client, treeId, organizerUserId);
        const graph = await peopleQueries.loadGraph(client, treeId);
        const existing = personId ? graph.people.find(({ id }) => id === personId) : undefined;
        if (personId && !existing) throw new PersonNotFoundError();

        const id = existing?.id ?? createId();
        const person: Person = {
          ...input,
          id,
          treeId,
          mainPhotoId: existing?.mainPhotoId ?? null,
        };
        const parentChild: ParentChild[] = [
          ...graph.parentChild.filter((edge) => edge.parentId !== id && edge.childId !== id),
          ...relationships.parentIds.map((parentId) => ({ parentId, childId: id })),
          ...relationships.childIds.map((childId) => ({ parentId: id, childId })),
        ];
        const partnerships: Partnership[] = [
          ...graph.partnerships.filter((edge) => edge.person1Id !== id && edge.person2Id !== id),
          ...relationships.partnerIds.map((partnerId) => id < partnerId
            ? { person1Id: id, person2Id: partnerId }
            : { person1Id: partnerId, person2Id: id }),
        ];
        const proposed = validateFamilyGraph({
          ...graph,
          people: existing
            ? graph.people.map((candidate) => candidate.id === id ? person : candidate)
            : [...graph.people, person],
          parentChild,
          partnerships,
        }, currentYear());
        if (!proposed.success) throw new DomainValidationError(proposed.issues);

        if (existing) await peopleQueries.updatePerson(client, person);
        else await peopleQueries.insertPerson(client, person);

        for (const edge of graph.parentChild.filter((candidate) => candidate.parentId === id || candidate.childId === id)) {
          await relationshipQueries.deleteParent(client, treeId, edge);
        }
        for (const edge of graph.partnerships.filter((candidate) => candidate.person1Id === id || candidate.person2Id === id)) {
          await relationshipQueries.deletePartnership(client, treeId, edge);
        }
        for (const edge of proposed.data.parentChild.filter((candidate) => candidate.parentId === id || candidate.childId === id)) {
          await relationshipQueries.insertParent(client, treeId, edge);
        }
        for (const edge of proposed.data.partnerships.filter((candidate) => candidate.person1Id === id || candidate.person2Id === id)) {
          await relationshipQueries.insertPartnership(client, treeId, edge);
        }
        return { person, graph: proposed.data };
      });
    },
  };
}
