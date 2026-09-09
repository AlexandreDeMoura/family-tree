import { createPersonSchema } from './schemas.js';

/** Validates a complete person value. For edits, merge first and use validatePersonEdit. */
export function validatePerson(input: unknown, currentYear: number) {
  return createPersonSchema(currentYear).safeParse(input);
}
