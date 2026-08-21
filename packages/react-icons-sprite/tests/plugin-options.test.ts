import { describe, expect, test } from 'vitest';
import {
  createIconSources,
  createSpriteAssetName,
} from '../src/plugin-options';

describe('plugin options', () => {
  test('uses the built-in icon import sources', () => {
    const sources = createIconSources();

    expect(sources.some((source) => source.test('lucide-react'))).toBe(true);
  });

  test('joins output directory and sprite file name as an asset path', () => {
    expect(createSpriteAssetName('icons.svg', 'assets/sprites')).toBe(
      'assets/sprites/icons.svg',
    );
    expect(createSpriteAssetName('/icons.svg', '/assets/sprites/')).toBe(
      'assets/sprites/icons.svg',
    );
    expect(createSpriteAssetName('nested/icons.svg', 'assets\\sprites')).toBe(
      'assets/sprites/nested/icons.svg',
    );
    expect(createSpriteAssetName('icons.svg')).toBe('icons.svg');
  });
});
