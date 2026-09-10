import { z } from 'zod';

// Domain IDs are opaque strings; database UUID constraints belong to persistence.
export const personIdSchema = z.string().trim().min(1);
export const lifeStatusSchema = z.enum(['living', 'deceased', 'unknown']);
export const ageBuckets = [
  'baby_toddler', 'kid', 'adolescent', '20s', '30s', '40s',
  '50s', '60s', '70s', '80s', '90s_plus',
] as const;
export const ageBucketSchema = z.enum(ageBuckets);

// An empty relationship list is known absence only when its flag is true.
// A complete nonempty list is still allowed; completeness is not a prohibition.
export const completenessSchema = z.strictObject({
  parentsComplete: z.boolean().default(false),
  partnersComplete: z.boolean().default(false),
  childrenComplete: z.boolean().default(false),
});

const personFieldsSchema = z.strictObject({
  id: personIdSchema,
  treeId: personIdSchema,
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  lifeStatus: lifeStatusSchema,
  birthYear: z.number().int().nullable().default(null),
  deathYear: z.number().int().nullable().default(null),
  adopted: z.boolean().default(false),
  mainPhotoId: personIdSchema.nullable().default(null),
  funFacts: z.array(z.string().trim().min(1)).max(3).default([]),
  ...completenessSchema.shape,
});

/** Inject the year at the application boundary; domain code never reads a clock. */
export function createPersonSchema(currentYear: number) {
  if (!Number.isSafeInteger(currentYear)) {
    throw new RangeError('currentYear must be a safe integer.');
  }

  return personFieldsSchema.superRefine((person, context) => {
    const issue = (code: string, message: string) => context.addIssue({
      code: 'custom', path: ['deathYear'], message, params: { domainCode: code },
    });

    if (person.deathYear === null) return;
    if (person.birthYear !== null && person.deathYear < person.birthYear) {
      issue('death_before_birth', 'Death year must be equal to or later than birth year.');
    }
    if (person.deathYear > currentYear) {
      issue('future_death', `Death year cannot be later than ${currentYear}.`);
    }
    if (person.lifeStatus === 'living') {
      issue('living_death', 'A living person cannot have a death year.');
    }
  });
}

export const parentChildSchema = z.strictObject({
  parentId: personIdSchema,
  childId: personIdSchema,
}).refine((edge) => edge.parentId !== edge.childId, {
  message: 'A person cannot be their own parent.',
  path: ['childId'], params: { domainCode: 'self_parent' },
});

// Partnership is unordered. Normalize copies so reversed pairs compare equally.
export const partnershipSchema = z.strictObject({
  person1Id: personIdSchema,
  person2Id: personIdSchema,
}).refine((edge) => edge.person1Id !== edge.person2Id, {
  message: 'A person cannot be their own partner.',
  path: ['person2Id'], params: { domainCode: 'self_partner' },
}).transform(({ person1Id, person2Id }) => person1Id < person2Id
  ? { person1Id, person2Id }
  : { person1Id: person2Id, person2Id: person1Id });

/** Structural/person validation only; validateFamilyGraph also checks topology. */
export function createFamilyGraphSchema(currentYear: number) {
  return z.strictObject({
    treeId: personIdSchema,
    people: z.array(createPersonSchema(currentYear)),
    parentChild: z.array(parentChildSchema),
    partnerships: z.array(partnershipSchema),
  });
}

export type LifeStatus = z.infer<typeof lifeStatusSchema>;
export type AgeBucket = z.infer<typeof ageBucketSchema>;
export type Completeness = z.infer<typeof completenessSchema>;
export type Person = z.infer<ReturnType<typeof createPersonSchema>>;
export type PersonInput = z.input<ReturnType<typeof createPersonSchema>>;
export type ParentChild = z.infer<typeof parentChildSchema>;
export type Partnership = z.infer<typeof partnershipSchema>;
export type FamilyGraph = z.infer<ReturnType<typeof createFamilyGraphSchema>>;
