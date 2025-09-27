import type { Plugin } from 'vite';
import {
  PLACEHOLDER,
  createCollector,
  transformModule,
  buildSprite,
} from '../core';

export type ReactIconsSpriteVitePluginOptions = {
  /**
   * Append a cache-busting query parameter to the emitted sprite URL.
   * Example: { spriteUrlVersion: "1.2.3" } -> "/assets/react-icons-sprite.svg?v=1.2.3"
   */
  spriteUrlVersion?: string;
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
  const { spriteUrlVersion, fileName } = options;

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

      if (!/from\s+['"]react-icons\//.test(code)) {
        return null;
      }

      try {
        const {
          code: next,
          map,
          anyReplacements,
        } = transformModule(code, id, (pack, exportName) => {
          collector.add(pack, exportName);
        });
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

      const emitFileOptions: Parameters<typeof this.emitFile>[0] = {
        type: 'asset',
        source: spriteXml,
      };

      if (fileName) {
        emitFileOptions.fileName = fileName;
      } else {
        emitFileOptions.name = 'react-icons-sprite.svg';
      }

      const assetId = this.emitFile(emitFileOptions);
      const name = this.getFileName(assetId);

      const finalUrl =
        spriteUrlVersion && spriteUrlVersion.length > 0
          ? `/${name}?v=${encodeURIComponent(spriteUrlVersion)}`
          : `/${name}`;

      for (const [, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && typeof item.code === 'string') {
          if (item.code.includes(PLACEHOLDER)) {
            item.code = item.code.replaceAll(PLACEHOLDER, finalUrl);
          }
        }
      }
    },
  };
};
