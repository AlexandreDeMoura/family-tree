import {
  validateFamilyGraph,
  validatePersonEdit,
  type FamilyGraph,
  type LifeStatus,
  type Person,
} from '@family-tree/family-core';
import type { PersonInput } from '../../lib/api';

export interface PersonFormValues {
  firstName: string;
  lastName: string;
  lifeStatus: LifeStatus;
  birthYear: string;
  deathYear: string;
  adopted: boolean;
  funFacts: [string, string, string];
  parentsComplete: boolean;
  partnersComplete: boolean;
  childrenComplete: boolean;
}

export interface PersonFormValidation {
  input?: PersonInput;
  fieldErrors: Partial<Record<keyof PersonFormValues, string>>;
  formError?: string;
}

export function emptyPersonForm(): PersonFormValues {
  return {
    firstName: '',
    lastName: '',
    lifeStatus: 'unknown',
    birthYear: '',
    deathYear: '',
    adopted: false,
    funFacts: ['', '', ''],
    parentsComplete: false,
    partnersComplete: false,
    childrenComplete: false,
  };
}

export function personToForm(person: Person): PersonFormValues {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    lifeStatus: person.lifeStatus,
    birthYear: person.birthYear?.toString() ?? '',
    deathYear: person.deathYear?.toString() ?? '',
    adopted: person.adopted,
    funFacts: [person.funFacts[0] ?? '', person.funFacts[1] ?? '', person.funFacts[2] ?? ''],
    parentsComplete: person.parentsComplete,
    partnersComplete: person.partnersComplete,
    childrenComplete: person.childrenComplete,
  };
}

function year(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return { error: `${label} must be a whole year.` };
  return { value: parsed };
}

export function validatePersonForm(
  values: PersonFormValues,
  graph: FamilyGraph,
  currentYear: number,
  personId?: string,
): PersonFormValidation {
  const fieldErrors: PersonFormValidation['fieldErrors'] = {};
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  if (!firstName) fieldErrors.firstName = 'Enter a first name.';
  if (!lastName) fieldErrors.lastName = 'Enter a last name.';

  const birthYear = year(values.birthYear, 'Birth year');
  const deathYear = year(values.deathYear, 'Death year');
  if (birthYear.error) fieldErrors.birthYear = birthYear.error;
  if (deathYear.error) fieldErrors.deathYear = deathYear.error;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const input: PersonInput = {
    firstName,
    lastName,
    lifeStatus: values.lifeStatus,
    birthYear: birthYear.value ?? null,
    deathYear: deathYear.value ?? null,
    adopted: values.adopted,
    funFacts: values.funFacts.map((fact) => fact.trim()).filter(Boolean),
    parentsComplete: values.parentsComplete,
    partnersComplete: values.partnersComplete,
    childrenComplete: values.childrenComplete,
  };
  const candidate = {
    ...input,
    id: personId ?? '__new_person_draft__',
    treeId: graph.treeId,
    mainPhotoId: null,
  };
  const result = personId
    ? validatePersonEdit(graph, candidate, currentYear)
    : validateFamilyGraph({ ...graph, people: [...graph.people, candidate] }, currentYear);
  if (result.success) return { input, fieldErrors };

  for (const issue of result.issues) {
    if (issue.code === 'death_before_birth' || issue.code === 'future_death' || issue.code === 'living_death') {
      fieldErrors.deathYear ??= issue.message;
    }
  }
  const formIssue = result.issues.find((issue) =>
    issue.code !== 'death_before_birth'
    && issue.code !== 'future_death'
    && issue.code !== 'living_death');
  return { input, fieldErrors, formError: formIssue?.message };
}
