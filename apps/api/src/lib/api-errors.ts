import type { DomainIssue } from '@family-tree/family-core';

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly issues?: readonly DomainIssue[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class DomainValidationError extends ApiError {
  constructor(issues: readonly DomainIssue[]) {
    const first = issues[0];
    super(422, first?.code ?? 'invalid_family_graph', first?.message ?? 'The family graph is invalid.', issues);
    this.name = 'DomainValidationError';
  }
}

export class TreeAccessError extends ApiError {
  constructor() {
    // Do not reveal whether a tree exists when it belongs to another organizer.
    super(404, 'tree_not_found', 'Tree not found.');
    this.name = 'TreeAccessError';
  }
}

export class PersonNotFoundError extends ApiError {
  constructor() {
    super(404, 'person_not_found', 'Person not found in this tree.');
    this.name = 'PersonNotFoundError';
  }
}

export class RelationshipNotFoundError extends ApiError {
  constructor(kind: 'parent' | 'partnership') {
    const label = kind === 'parent' ? 'Parent relationship' : 'Partnership';
    const code = kind === 'parent' ? 'parent_relationship_not_found' : 'partnership_not_found';
    super(404, code, `${label} not found in this tree.`);
    this.name = 'RelationshipNotFoundError';
  }
}
