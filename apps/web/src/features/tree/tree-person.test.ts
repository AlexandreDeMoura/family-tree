import { describe, expect, it } from 'vitest';
import { childBranchLabel, treePersonYears } from './tree-person';

describe('album tree person labels', () => {
  it.each([
    [1918, 1994, '1918–1994'],
    [1918, null, '1918–?'],
    [null, 1994, '?–1994'],
    [null, null, 'Dates unknown'],
  ] as const)('shows explicit remembrance dates for %s / %s', (birthYear, deathYear, expected) => {
    expect(treePersonYears({ lifeStatus: 'deceased', birthYear, deathYear })).toBe(expected);
  });

  it('never infers life status or an age from old or unknown dates', () => {
    expect(treePersonYears({ lifeStatus: 'living', birthYear: 1900, deathYear: null })).toBe('1900');
    expect(treePersonYears({ lifeStatus: 'unknown', birthYear: 1900, deathYear: 1980 })).toBe('1900');
    expect(treePersonYears({ lifeStatus: 'unknown', birthYear: null, deathYear: null })).toBe('Year unknown');
  });

  it('distinguishes unknown children from known absence without adding branches to known children', () => {
    expect(childBranchLabel(false, false)).toBe('Children unknown');
    expect(childBranchLabel(true, false)).toBe('No children');
    expect(childBranchLabel(false, true)).toBeNull();
    expect(childBranchLabel(true, true)).toBeNull();
  });
});
