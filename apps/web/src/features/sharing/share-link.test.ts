import { describe, expect, it } from 'vitest';
import { buildPrivateViewerUrl, readPrivateViewerToken } from './share-link';

describe('private viewer URLs', () => {
  it('keeps the bearer token in the URL fragment', () => {
    const token = 'a'.repeat(43);
    expect(buildPrivateViewerUrl('https://family.test', 'tree-id', token))
      .toBe(`https://family.test/view/tree-id#${token}`);
  });

  it('accepts only the generated base64url token shape', () => {
    expect(readPrivateViewerToken(`#${'A_1-'.repeat(10)}abc`)).toBe(`${'A_1-'.repeat(10)}abc`);
    expect(readPrivateViewerToken('#short')).toBeNull();
    expect(readPrivateViewerToken(`#${'a'.repeat(42)}!`)).toBeNull();
  });
});

