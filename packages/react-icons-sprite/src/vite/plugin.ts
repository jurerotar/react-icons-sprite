import type { Plugin } from 'vite';
import { createCollector } from '../collector/create-collector';
import { REACT_ICONS_SPRITE_URL_PLACEHOLDER } from '../index';
import { DEFAULT_ICON_SOURCES } from '../packs/icon-sources';
import {
  createExcludedIconSources,
  type ReactIconsSpritePluginOptions,
} from '../plugin-options';
import { buildSprite } from '../sprite/build-sprite';
import { createSpriteAsset } from '../sprite/create-sprite-asset';
import { createIconRenderer } from '../sprite/render-icon';
import { transformModule } from '../transform/transform-module';

export type ReactIconsSpriteVitePluginOptions = ReactIconsSpritePluginOptions;

export const reactIconsSprite = (
  options: ReactIconsSpriteVitePluginOptions = {},
): Plugin => {
  const { outputDir } = options;
  const excludedIconSources = createExcludedIconSources(options.exclude);

  const collector = createCollector();
  let root = process.cwd();
  let base = '/';
  let renderIcon = createIconRenderer();

  return {
    name: 'vite-plugin-react-icons-sprite',
    enforce: 'pre',
    apply: 'build',

    buildStart() {
      collector.clear();
      renderIcon = createIconRenderer();
    },

    configResolved(config) {
      root = config.root;
      base = config.base;
    },

    async transform(code, id) {
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
            collector.add(pack, exportName, {
              importer: cleanId,
            });

            void renderIcon.preload(pack, exportName, {
              baseDir: root,
              importer: cleanId,
            });
          },
          DEFAULT_ICON_SOURCES,
          { excludedSources: excludedIconSources },
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
        // Leave the module inline if transformation fails.
        return null;
      }
    },

    async generateBundle(this, _options, bundle) {
      const spriteXml = await buildSprite(collector.toList(), {
        baseDir: root,
        renderIcon,
      });

      const assetId = this.emitFile({
        type: 'asset',
        ...createSpriteAsset(spriteXml, outputDir),
      });
      const name = this.getFileName(assetId);

      const finalUrl = `${base}${name}`;

      for (const item of Object.values(bundle)) {
        if (
          item.type === 'chunk' &&
          item.code.includes(REACT_ICONS_SPRITE_URL_PLACEHOLDER)
        ) {
          item.code = item.code.replaceAll(
            REACT_ICONS_SPRITE_URL_PLACEHOLDER,
            finalUrl,
          );
        }
      }
    },
  };
};
