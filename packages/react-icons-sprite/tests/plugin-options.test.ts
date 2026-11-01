import { describe, expect, test } from 'vitest';
import {
  createExcludedIconSources,
  createSpriteAssetName,
} from '../src/plugin-options';

describe('plugin options', () => {
  test('normalizes one or many excluded icon sources', () => {
    const source = /^@pillage-first\/graphics$/;

    expect(createExcludedIconSources(source)).toEqual([source]);
    expect(createExcludedIconSources([source])).toEqual([source]);
    expect(createExcludedIconSources()).toEqual([]);
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
