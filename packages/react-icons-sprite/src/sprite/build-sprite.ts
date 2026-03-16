import type { CollectedIcon } from '../collector/create-collector';
import { computeIconId } from '../utils/compute-icon-id';
import { renderIcon } from './render-icon';

export const buildSprite = async (icons: CollectedIcon[]): Promise<string> => {
  if (!icons.length) {
    return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none"></svg>';
  }

  const symbols = await Promise.all(
    icons.map(async ({ pack, exportName }) => {
      const rendered = await renderIcon(pack, exportName);
      const id = computeIconId(pack, exportName);

      return `<symbol id="${id}" viewBox="${rendered.viewBox}">${rendered.symbolBody}</symbol>`;
    }),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join('')}</svg>`;
};
