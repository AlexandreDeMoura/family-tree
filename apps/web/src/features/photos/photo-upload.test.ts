import { describe, expect, it } from 'vitest';
import { containedDimensions, validatePhotoSource } from './photo-upload';

describe('photo upload preparation', () => {
  it('accepts browser-decodable image types within the source limit', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validatePhotoSource({ type, size: 20 * 1024 * 1024 })).toBeNull();
    }
  });

  it('rejects unsupported, empty, and oversized source files before decoding', () => {
    expect(validatePhotoSource({ type: 'image/gif', size: 100 })).toMatch(/JPEG/);
    expect(validatePhotoSource({ type: 'image/jpeg', size: 0 })).toMatch(/empty/);
    expect(validatePhotoSource({ type: 'image/jpeg', size: 20 * 1024 * 1024 + 1 })).toMatch(/20 MB/);
  });

  it('contains large images while preserving their aspect ratio', () => {
    expect(containedDimensions(4800, 3200)).toEqual({ width: 2400, height: 1600 });
    expect(containedDimensions(800, 1200)).toEqual({ width: 800, height: 1200 });
  });
});
