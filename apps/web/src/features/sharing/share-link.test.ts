import { describe, expect, it } from 'vitest';
import {
  buildPrivatePhotoViewerPath,
  buildPrivateViewerPath,
  buildPrivateViewerUrl,
  readPrivateViewerToken,
} from './share-link';

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

  it('preserves the bearer fragment across tree, card, and photo routes', () => {
    const token = 't'.repeat(43);

    expect(buildPrivateViewerPath('tree / one', token))
      .toBe(`/view/tree%20%2F%20one#${token}`);
    expect(buildPrivateViewerPath('tree / one', token, 'person / one'))
      .toBe(`/view/tree%20%2F%20one?person=person%20%2F%20one#${token}`);
    expect(buildPrivatePhotoViewerPath('tree / one', 'person / one', token, '20s', 'photo / one'))
      .toBe(`/view/tree%20%2F%20one/people/person%20%2F%20one/photos?bucket=20s&photo=photo+%2F+one#${token}`);
  });
});
