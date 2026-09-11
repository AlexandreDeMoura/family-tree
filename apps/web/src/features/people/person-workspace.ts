import {
  ageBucketLabels,
  ageBuckets,
  validateFamilyGraph,
  type DomainIssue,
  type FamilyGraph,
  type Person,
} from '@family-tree/family-core';
import type { PersonInput, PhotoView } from '../../lib/api';
import {
  emptyPersonForm,
  personToForm,
  validatePersonForm,
  type PersonFormValidation,
  type PersonFormValues,
} from './person-form';

export type ChildrenKnowledge = 'known' | 'none' | 'unknown';

export interface PersonRelationshipDraft {
  parentIds: string[];
  partnerIds: string[];
  childIds: string[];
  childrenKnowledge: ChildrenKnowledge;
}

export interface PersonWorkspaceDraft {
  values: PersonFormValues;
  relationships: PersonRelationshipDraft;
}

export interface PersonWorkspaceValidation {
  input?: PersonInput;
  proposedGraph?: FamilyGraph;
  form: PersonFormValidation;
  issues: DomainIssue[];
  valid: boolean;
}

export interface InvariantCheck {
  label: string;
  valid: boolean;
}

const draftPersonId = '__new_person_workspace_draft__';

export function createPersonWorkspaceDraft(graph: FamilyGraph, person?: Person): PersonWorkspaceDraft {
  if (!person) {
    return {
      values: emptyPersonForm(),
      relationships: { parentIds: [], partnerIds: [], childIds: [], childrenKnowledge: 'unknown' },
    };
  }
  const parentIds = graph.parentChild
    .filter(({ childId }) => childId === person.id)
    .map(({ parentId }) => parentId);
  const childIds = graph.parentChild
    .filter(({ parentId }) => parentId === person.id)
    .map(({ childId }) => childId);
  const partnerIds = graph.partnerships.flatMap(({ person1Id, person2Id }) => {
    if (person1Id === person.id) return [person2Id];
    if (person2Id === person.id) return [person1Id];
    return [];
  });
  return {
    values: personToForm(person),
    relationships: {
      parentIds,
      partnerIds,
      childIds,
      childrenKnowledge: person.childrenComplete ? (childIds.length ? 'known' : 'none') : 'unknown',
    },
  };
}

export function validatePersonWorkspaceDraft(
  draft: PersonWorkspaceDraft,
  graph: FamilyGraph,
  currentYear: number,
  personId?: string,
): PersonWorkspaceValidation {
  const id = personId ?? draftPersonId;
  const graphWithoutOwnRelationships = {
    ...graph,
    parentChild: graph.parentChild.filter(({ parentId, childId }) => parentId !== id && childId !== id),
    partnerships: graph.partnerships.filter(({ person1Id, person2Id }) => person1Id !== id && person2Id !== id),
  };
  const form = validatePersonForm(draft.values, graphWithoutOwnRelationships, currentYear, personId);
  if (!form.input) return { form, issues: [], valid: false };

  const existing = personId ? graph.people.find((person) => person.id === personId) : undefined;
  const person: Person = {
    ...form.input,
    id,
    treeId: graph.treeId,
    mainPhotoId: existing?.mainPhotoId ?? null,
    childrenComplete: draft.relationships.childrenKnowledge !== 'unknown',
  };
  const parentChild = [
    ...graph.parentChild.filter(({ parentId, childId }) => parentId !== id && childId !== id),
    ...draft.relationships.parentIds.map((parentId) => ({ parentId, childId: id })),
    ...draft.relationships.childIds.map((childId) => ({ parentId: id, childId })),
  ];
  const partnerships = [
    ...graph.partnerships.filter(({ person1Id, person2Id }) => person1Id !== id && person2Id !== id),
    ...draft.relationships.partnerIds.map((partnerId) => id < partnerId
      ? { person1Id: id, person2Id: partnerId }
      : { person1Id: partnerId, person2Id: id }),
  ];
  const proposedGraph: FamilyGraph = {
    ...graph,
    people: existing
      ? graph.people.map((candidate) => candidate.id === id ? person : candidate)
      : [...graph.people, person],
    parentChild,
    partnerships,
  };
  const result = validateFamilyGraph(proposedGraph, currentYear);
  const issues = result.success ? [] : result.issues;
  const hasFormError = Boolean(form.formError || Object.values(form.fieldErrors).some(Boolean));
  return {
    input: { ...form.input, childrenComplete: person.childrenComplete },
    proposedGraph: result.success ? result.data : proposedGraph,
    form,
    issues,
    valid: result.success && !hasFormError,
  };
}

export function factConflict(
  validation: PersonWorkspaceValidation,
  graph: FamilyGraph,
): { title: string; detail: string } | null {
  const issue = validation.issues[0];
  if (issue) {
    const people = new Map((validation.proposedGraph?.people ?? graph.people).map((person) => [person.id, person]));
    const named = (id: string) => people.get(id);
    if (issue.code === 'parent_younger_than_child') {
      const [parentId, childId] = issue.personIds;
      const parent = named(parentId);
      const child = named(childId);
      if (parent && child) return {
        title: `${fullName(parent)} can’t be ${fullName(child)}’s parent`,
        detail: `${fullName(parent)}’s birth year (${parent.birthYear}) is later than ${fullName(child)}’s (${child.birthYear}). A parent can’t be younger than their child. Change one of the two years, or choose a different person — saving stays blocked until then.`,
      };
    }
    if (issue.code === 'too_many_parents') {
      const [childId, ...parentIds] = issue.personIds;
      const child = named(childId);
      const parents = parentIds.map(named).filter((person): person is Person => Boolean(person));
      return {
        title: `${child ? fullName(child) : 'This person'} can have at most two parents`,
        detail: `${parents.map(fullName).join(', ') || 'The selected people'} would create a third parent. Remove one parent selection before saving.`,
      };
    }
    if (issue.code === 'ancestry_cycle') {
      const cycle = issue.personIds.map((id) => named(id)).filter((person): person is Person => Boolean(person));
      return {
        title: 'These parent choices create an ancestry loop',
        detail: `${cycle.map(fullName).join(' → ') || 'The selected people'} would make someone their own ancestor. Change a parent or child selection before saving.`,
      };
    }
    return { title: 'These facts conflict', detail: `${issue.message} Change the conflicting value or relationship before saving.` };
  }
  const fieldError = validation.form.fieldErrors.birthYear ?? validation.form.fieldErrors.deathYear;
  if (fieldError) return { title: 'Check this person’s facts', detail: fieldError };
  if (validation.form.formError) return { title: 'These facts conflict', detail: validation.form.formError };
  return null;
}

export function invariantChecks(validation: PersonWorkspaceValidation): InvariantCheck[] {
  const codes = new Set(validation.issues.map(({ code }) => code));
  const fieldMessages = Object.values(validation.form.fieldErrors).filter(Boolean).join(' ');
  return [
    { label: 'Death year is not before birth year', valid: !codes.has('death_before_birth') && !fieldMessages.includes('Death year must be equal') },
    { label: 'A parent is not younger than their child', valid: !codes.has('parent_younger_than_child') },
    { label: 'Death year is not in the future', valid: !codes.has('future_death') && !fieldMessages.includes('Death year cannot') },
    { label: 'A living person has no death year', valid: !codes.has('living_death') && !fieldMessages.includes('living person') },
    { label: 'No ancestry loops in the family graph', valid: !codes.has('ancestry_cycle') },
    { label: 'No person has more than two parents', valid: !codes.has('too_many_parents') },
  ];
}

export function discoveryPrompts(
  draft: PersonWorkspaceDraft,
  photos: PhotoView[],
  person?: Person,
): string[] {
  const prompts: string[] = [];
  const facts = draft.values.funFacts.filter((fact) => fact.trim()).length;
  if (facts < 3) prompts.push(facts === 2 ? 'One more fun fact' : `${3 - facts} more fun facts`);
  if (!draft.values.birthYear.trim()) prompts.push('Birth year');
  if (draft.values.lifeStatus === 'unknown') prompts.push('Life status');
  if (!person?.mainPhotoId) prompts.push('A main portrait');
  if (!photos.length) {
    prompts.push('Photos through the years');
  } else {
    const present = new Set(photos.map(({ ageBucket }) => ageBucket));
    const missing = ageBuckets.filter((bucket) => !present.has(bucket));
    if (missing.length) {
      const labels = missing.slice(0, 2).map((bucket) => ageBucketLabels[bucket]);
      prompts.push(`Photos from ${labels.join(' and ')}${missing.length > 2 ? `, plus ${missing.length - 2} more stages` : ''}`);
    }
  }
  if (!draft.values.parentsComplete) prompts.push(draft.relationships.parentIds.length ? 'Whether another parent is known' : 'Parent information');
  if (!draft.values.partnersComplete) prompts.push(draft.relationships.partnerIds.length ? 'Whether there are more partners' : 'Partner information');
  if (draft.relationships.childrenKnowledge === 'unknown') prompts.push(draft.relationships.childIds.length ? 'Whether there are more children' : 'Children');
  return prompts;
}

export function personWorkspacePath(treeId: string, personId?: string) {
  return personId
    ? `/organizer/trees/${encodeURIComponent(treeId)}/people/${encodeURIComponent(personId)}/edit`
    : `/organizer/trees/${encodeURIComponent(treeId)}/people/new`;
}

export function treeOverviewPath(treeId: string, focusPersonId?: string) {
  const base = `/organizer/trees/${encodeURIComponent(treeId)}`;
  return focusPersonId ? `${base}?person=${encodeURIComponent(focusPersonId)}` : base;
}

function fullName(person: Person) {
  return `${person.firstName} ${person.lastName}`;
}
