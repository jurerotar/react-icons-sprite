import type { CollectedIcon } from '../collector/create-collector';
import { computeIconId } from '../utils/compute-icon-id';
import { renderIcon } from './render-icon';

type BuildSpriteOptions = {
  baseDir?: string;
};

export const buildSprite = async (
  icons: CollectedIcon[],
  options: BuildSpriteOptions = {},
): Promise<string> => {
  if (!icons.length) {
    return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none"></svg>';
  }

  const symbols = await Promise.all(
    icons.map(async ({ pack, exportName }) => {
      const rendered = await renderIcon(pack, exportName, {
        baseDir: options.baseDir,
      });
      const id = computeIconId(pack, exportName);
      const symbolAttributes = rendered.symbolAttributes
        ? ` ${rendered.symbolAttributes}`
        : '';

      return `<symbol id="${id}" viewBox="${rendered.viewBox}"${symbolAttributes}>${rendered.symbolBody}</symbol>`;
    }),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join('')}</svg>`;
};
