import { DEFAULT_ICON_SOURCES } from './packs/icon-resolvers';

export type ReactIconsSpritePluginOptions = {
  /**
   * Optional directory inside the bundler output where the sprite asset should be emitted.
   */
  outputDir?: string;
};

const normalizeOutputPathSegment = (value: string): string => {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
};

export const createIconSources = (): readonly RegExp[] => {
  return DEFAULT_ICON_SOURCES;
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
