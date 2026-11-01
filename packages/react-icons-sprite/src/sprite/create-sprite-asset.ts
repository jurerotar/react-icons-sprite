import { createHash } from 'node:crypto';
import { createSpriteAssetName } from '../plugin-options';

export const createSpriteAsset = (source: string, outputDir?: string) => {
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 8);
  return {
    fileName: createSpriteAssetName(
      `react-icons-sprite-${hash}.svg`,
      outputDir,
    ),
    source,
  };
};
