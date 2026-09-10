import type { DomainIssue, FamilyGraph, Person } from '@family-tree/family-core';

const apiUrl = import.meta.env.VITE_API_URL;

export interface TreeSummary {
  id: string;
  name: string;
  createdAt: string;
}

export interface LoadedTree extends TreeSummary {
  graph: FamilyGraph;
}

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
    issues?: DomainIssue[];
  };
}

export class FamilyApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: DomainIssue[];

  constructor(
    status: number,
    code: string,
    message: string,
    issues: DomainIssue[] = [],
  ) {
    super(message);
    this.name = 'FamilyApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

async function request<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) throw new FamilyApiError(0, 'missing_configuration', 'The API URL is not configured.');

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new FamilyApiError(0, 'network_error', 'The family service could not be reached.');
  }

  const body = await response.json().catch(() => ({})) as ErrorResponse;
  if (!response.ok) {
    throw new FamilyApiError(
      response.status,
      body.error?.code ?? 'request_failed',
      body.error?.message ?? 'The request could not be completed.',
      body.error?.issues ?? [],
    );
  }
  return body as T;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  lifeStatus: Person['lifeStatus'];
  birthYear: number | null;
  deathYear: number | null;
  adopted: boolean;
  funFacts: string[];
  parentsComplete: boolean;
  partnersComplete: boolean;
  childrenComplete: boolean;
}

export const familyApi = {
  async listTrees(accessToken: string) {
    return (await request<{ trees: TreeSummary[] }>(accessToken, '/trees')).trees;
  },

  async createTree(accessToken: string, name: string) {
    return (await request<{ tree: TreeSummary }>(accessToken, '/trees', {
      method: 'POST', body: JSON.stringify({ name }),
    })).tree;
  },

  async loadTree(accessToken: string, treeId: string) {
    return (await request<{ tree: LoadedTree }>(accessToken, `/trees/${treeId}`)).tree;
  },

  async createPerson(accessToken: string, treeId: string, input: PersonInput) {
    return (await request<{ person: Person }>(accessToken, `/trees/${treeId}/people`, {
      method: 'POST', body: JSON.stringify(input),
    })).person;
  },

  async editPerson(accessToken: string, treeId: string, personId: string, input: PersonInput) {
    return (await request<{ person: Person }>(accessToken, `/trees/${treeId}/people/${personId}`, {
      method: 'PATCH', body: JSON.stringify(input),
    })).person;
  },

  async addParent(accessToken: string, treeId: string, parentId: string, childId: string) {
    return (await request<{ graph: FamilyGraph }>(accessToken, `/trees/${treeId}/relationships/parents`, {
      method: 'POST', body: JSON.stringify({ parentId, childId }),
    })).graph;
  },

  async removeParent(accessToken: string, treeId: string, parentId: string, childId: string) {
    return (await request<{ graph: FamilyGraph }>(
      accessToken,
      `/trees/${treeId}/relationships/parents/${parentId}/${childId}`,
      { method: 'DELETE' },
    )).graph;
  },

  async addPartner(accessToken: string, treeId: string, person1Id: string, person2Id: string) {
    return (await request<{ graph: FamilyGraph }>(accessToken, `/trees/${treeId}/relationships/partners`, {
      method: 'POST', body: JSON.stringify({ person1Id, person2Id }),
    })).graph;
  },

  async removePartner(accessToken: string, treeId: string, person1Id: string, person2Id: string) {
    return (await request<{ graph: FamilyGraph }>(
      accessToken,
      `/trees/${treeId}/relationships/partners/${person1Id}/${person2Id}`,
      { method: 'DELETE' },
    )).graph;
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
