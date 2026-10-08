import { DEFAULT_ICON_SOURCES } from './packs/icon-resolvers';

export type IconSourceExclusion = RegExp | readonly RegExp[];

export type ReactIconsSpritePluginOptions = {
  /**
   * Optional directory inside the bundler output where the sprite asset should be emitted.
   */
  outputDir?: string;
  /**
   * Icon import sources to leave as inline React components.
   *
   * Use this when CSS needs to target elements inside an icon SVG. Those
   * selectors cannot cross an SVG <use> reference into the generated sprite.
   */
  exclude?: IconSourceExclusion;
};

const normalizeOutputPathSegment = (value: string): string => {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
};

export const createIconSources = (): readonly RegExp[] => {
  return DEFAULT_ICON_SOURCES;
};

export const createExcludedIconSources = (
  exclude?: IconSourceExclusion,
): readonly RegExp[] => {
  if (!exclude) {
    return [];
  }

  return exclude instanceof RegExp ? [exclude] : exclude;
};

export const createSpriteAssetName = (
  fileName: string,
  outputDir?: string,
): string => {
  const normalizedOutputDir = outputDir
    ? normalizeOutputPathSegment(outputDir)
    : '';
  const normalizedFileName = normalizeOutputPathSegment(fileName);

  return normalizedOutputDir
    ? `${normalizedOutputDir}/${normalizedFileName}`
    : normalizedFileName;
};
