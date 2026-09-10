import { z } from 'zod';
import {
  PHOTO_UPLOAD_MAX_BYTES,
  ageBucketSchema,
  completenessSchema,
  lifeStatusSchema,
} from '@family-tree/family-core';
import { ApiError } from '../lib/api-errors.js';

const name = z.string().trim().min(1);
const nullableYear = z.number().int().nullable();
const funFacts = z.array(z.string().trim().min(1)).max(3);

export const treeParamsSchema = z.strictObject({ treeId: z.uuid() });
export const personParamsSchema = z.strictObject({ treeId: z.uuid(), personId: z.uuid() });
export const photoParamsSchema = z.strictObject({
  treeId: z.uuid(),
  personId: z.uuid(),
  photoId: z.uuid(),
});
export const parentRelationshipParamsSchema = z.strictObject({
  treeId: z.uuid(),
  parentId: z.uuid(),
  childId: z.uuid(),
});
export const partnershipParamsSchema = z.strictObject({
  treeId: z.uuid(),
  person1Id: z.uuid(),
  person2Id: z.uuid(),
});
export const createTreeBodySchema = z.strictObject({ name });
export const parentRelationshipBodySchema = z.strictObject({
  parentId: z.uuid(),
  childId: z.uuid(),
});
export const partnershipBodySchema = z.strictObject({
  person1Id: z.uuid(),
  person2Id: z.uuid(),
});
export const createPhotoUploadBodySchema = z.strictObject({
  contentType: z.literal('image/jpeg'),
  sizeBytes: z.number().int().positive().max(PHOTO_UPLOAD_MAX_BYTES),
});
export const completePhotoUploadBodySchema = z.strictObject({
  ageBucket: ageBucketSchema,
  makeMain: z.boolean().default(false),
});

const personFields = {
  firstName: name,
  lastName: name,
  lifeStatus: lifeStatusSchema,
  birthYear: nullableYear.default(null),
  deathYear: nullableYear.default(null),
  adopted: z.boolean().default(false),
  funFacts: funFacts.default([]),
  parentsComplete: completenessSchema.shape.parentsComplete,
  partnersComplete: completenessSchema.shape.partnersComplete,
  childrenComplete: completenessSchema.shape.childrenComplete,
};

export const createPersonBodySchema = z.strictObject(personFields);
export const editPersonBodySchema = z.strictObject({
  firstName: personFields.firstName.optional(),
  lastName: personFields.lastName.optional(),
  lifeStatus: personFields.lifeStatus.optional(),
  birthYear: nullableYear.optional(),
  deathYear: nullableYear.optional(),
  adopted: z.boolean().optional(),
  funFacts: funFacts.optional(),
  parentsComplete: z.boolean().optional(),
  partnersComplete: z.boolean().optional(),
  childrenComplete: z.boolean().optional(),
}).refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required.' });

export function parseRequest<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ApiError(400, 'invalid_request', 'The request is invalid.', parsed.error.issues.map((issue) => ({
    code: 'invalid_schema',
    message: issue.message,
    path: issue.path,
    personIds: [],
  })));
}
