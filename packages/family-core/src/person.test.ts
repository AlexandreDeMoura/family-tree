import { describe, expect, it } from 'vitest';
import { ageBucketSchema, completenessSchema, createPersonSchema, lifeStatusSchema, validatePerson } from './index.js';

const input = { id: 'jean', treeId: 'family', firstName: 'Jean', lastName: 'Martin', lifeStatus: 'unknown' };

describe('person schemas', () => {
  it('preserves explicit status, unknown years, and unknown relationship completeness', () => {
    expect(createPersonSchema(2026).parse(input)).toEqual({
      ...input, birthYear: null, deathYear: null, adopted: false, mainPhotoId: null,
      funFacts: [], parentsComplete: false, partnersComplete: false, childrenComplete: false,
    });
    expect(completenessSchema.parse({ childrenComplete: true, partnersComplete: true })).toEqual({
      parentsComplete: false, partnersComplete: true, childrenComplete: true,
    });
  });

  it.each(['living', 'deceased', 'unknown'])('accepts %s without known dates', (lifeStatus) => {
    expect(validatePerson({ ...input, lifeStatus }, 2026).success).toBe(true);
  });

  it.each([
    { birthYear: null, deathYear: 2000 },
    { birthYear: 2000, deathYear: null },
    { birthYear: 2000, deathYear: 2000 },
    { birthYear: 2000, deathYear: 2026 },
    { birthYear: null, deathYear: null },
  ])('accepts valid or unknown deceased dates: %j', (years) => {
    expect(validatePerson({ ...input, lifeStatus: 'deceased', ...years }, 2026).success).toBe(true);
  });

  it.each([
    [{ lifeStatus: 'deceased', birthYear: 2000, deathYear: 1999 }, 'death_before_birth'],
    [{ lifeStatus: 'deceased', deathYear: 2027 }, 'future_death'],
    [{ lifeStatus: 'unknown', deathYear: 2027 }, 'future_death'],
    [{ lifeStatus: 'living', deathYear: 2020 }, 'living_death'],
  ])('rejects inconsistent dates: %j', (fields, code) => {
    const result = validatePerson({ ...input, ...fields }, 2026);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({
      path: ['deathYear'], params: { domainCode: code },
    }));
  });

  it('uses the injected current year on every call', () => {
    const person = { ...input, lifeStatus: 'deceased', deathYear: 2030 };
    expect(validatePerson(person, 2029).success).toBe(false);
    expect(validatePerson(person, 2030).success).toBe(true);
    expect(() => createPersonSchema(Number.NaN)).toThrow(RangeError);
  });

  it('does not infer status from years or adoption', () => {
    const result = createPersonSchema(2026).parse({ ...input, birthYear: 1800, deathYear: 1900, adopted: true });
    expect(result.lifeStatus).toBe('unknown');
    expect(result.adopted).toBe(true);
  });

  it.each([
    { id: '' }, { treeId: '' }, { firstName: '  ' }, { lastName: '' },
    { lifeStatus: undefined }, { lifeStatus: 'alive' },
    { birthYear: 2000.5 }, { deathYear: '2000' }, { birthYear: Infinity },
    { adopted: 'true' }, { childrenComplete: null },
    { funFacts: ['one', 'two', 'three', 'four'] }, { funFacts: [' '] },
    { siblings: ['someone'] }, { x: 123 },
  ])('rejects malformed or rendering-only data: %j', (fields) => {
    expect(validatePerson({ ...input, ...fields }, 2026).success).toBe(false);
  });

  it('trims names and up to three free-text facts', () => {
    expect(createPersonSchema(2026).parse({
      ...input, firstName: ' Jean ', funFacts: [' Owned a bakery ', 'Played accordion', 'Loved hiking'],
    })).toMatchObject({ firstName: 'Jean', funFacts: ['Owned a bakery', 'Played accordion', 'Loved hiking'] });
  });

  it('accepts exactly the explicit life statuses and eleven age buckets', () => {
    expect(lifeStatusSchema.options).toEqual(['living', 'deceased', 'unknown']);
    for (const bucket of ['baby_toddler', 'kid', 'adolescent', '20s', '30s', '40s', '50s', '60s', '70s', '80s', '90s_plus']) {
      expect(ageBucketSchema.parse(bucket)).toBe(bucket);
    }
    expect(ageBucketSchema.safeParse('adult').success).toBe(false);
    expect(ageBucketSchema.safeParse(['kid', '20s']).success).toBe(false);
  });
});
