import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import {
  createCollector,
  transformModule,
  buildSprite,
  DEFAULT_ICON_SOURCES,
} from '../core';
import { REACT_ICONS_SPRITE_URL_PLACEHOLDER } from '../index';

export type ReactIconsSpriteVitePluginOptions = {
  /**
   * If passed, this exact string will be used for the emitted file name.
   * If fileName is omitted, name will be generated as `react-icons-sprite-[hash].svg.
   * This is useful when, for example, multiple sprite sheets are generated during client and server builds.
   */
  fileName?: string;
};

export const reactIconsSprite = (
  options: ReactIconsSpriteVitePluginOptions = {},
): Plugin => {
  const { fileName } = options;

  const collector = createCollector();

  return {
    name: 'vite-plugin-react-icons-sprite',
    enforce: 'pre',
    apply: 'build',

    buildStart() {
      collector.clear();
    },

    transform(code, id) {
      const cleanId = id.split('?', 1)[0];
      if (!/\.(mjs|cjs|js|jsx|ts|tsx)$/.test(cleanId)) {
        return null;
      }

      try {
        const {
          code: next,
          map,
          anyReplacements,
        } = transformModule(
          code,
          id,
          (pack, exportName) => {
            collector.add(pack, exportName);
          },
          DEFAULT_ICON_SOURCES,
        );
        if (!anyReplacements) {
          return null;
        }
        return {
          code: next,
          map,
        };
      } catch (error) {
        console.error(error);
        // If parsing fails, skip transforming this module.
        return null;
      }
    },

    async generateBundle(this, _options, bundle) {
      const spriteXml = await buildSprite(collector.toList());

      const generatedHash = createHash('sha256')
        .update(spriteXml)
        .digest('hex')
        .slice(0, 8);

      const fileNameToEmit = fileName
        ? fileName
        : `react-icons-sprite-${generatedHash}.svg`;

      const emitFileOptions: Parameters<typeof this.emitFile>[0] = {
        type: 'asset',
        source: spriteXml,
        fileName: fileNameToEmit,
      };

      const assetId = this.emitFile(emitFileOptions);
      const name = this.getFileName(assetId);

      const finalUrl = `/${name}`;

      for (const [, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && typeof item.code === 'string') {
          if (item.code.includes(REACT_ICONS_SPRITE_URL_PLACEHOLDER)) {
            item.code = item.code.replaceAll(REACT_ICONS_SPRITE_URL_PLACEHOLDER, finalUrl);
          }
        }
      }
    },
  };
};
