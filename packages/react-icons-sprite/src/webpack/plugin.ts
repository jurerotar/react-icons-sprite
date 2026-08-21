import { createHash } from 'node:crypto';
import { buildSprite } from '../sprite/build-sprite';
import { REACT_ICONS_SPRITE_URL_PLACEHOLDER } from '../index';
import { collector } from '../collector';
import {
  createSpriteAssetName,
  type ReactIconsSpritePluginOptions,
} from '../plugin-options';
import type { Compiler, Compilation } from 'webpack';

export type ReactIconsSpriteWebpackPluginOptions =
  ReactIconsSpritePluginOptions;

export class ReactIconsSpriteWebpackPlugin {
  private readonly outputDir?: string;

  constructor(options: ReactIconsSpriteWebpackPluginOptions = {}) {
    this.outputDir = options.outputDir;
  }

  apply(compiler: Compiler): void {
    if (compiler.options.mode === 'development') {
      return;
    }

    const pluginName = 'react-icons-sprite-webpack-plugin';

    compiler.hooks.thisCompilation.tap(
      pluginName,
      (compilation: Compilation) => {
        // Clear from previous builds within the same process
        collector.clear();

        // After modules are processed and before assets are emitted
        const stage = compiler.webpack?.Compilation
          ? compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
          : 4000; // fallback

        compilation.hooks.processAssets.tapPromise(
          { name: pluginName, stage },
          async () => {
            const spriteXml = await buildSprite(collector.toList(), {
              baseDir: compiler.context,
            });

            const generatedHash = createHash('sha256')
              .update(spriteXml)
              .digest('hex')
              .slice(0, 8);

            const name = createSpriteAssetName(
              `react-icons-sprite-${generatedHash}.svg`,
              this.outputDir,
            );

            const RawSource = compiler.webpack?.sources?.RawSource;
            if (!RawSource) {
              throw new Error(
                '[react-icons-sprite] Unable to access webpack RawSource',
              );
            }

            // Emit asset
            compilation.emitAsset(name, new RawSource(spriteXml));

            // Compute public URL
            const outputPublicPath = compilation.outputOptions?.publicPath;
            let base = '';
            if (
              typeof outputPublicPath === 'string' &&
              outputPublicPath !== 'auto'
            ) {
              base = outputPublicPath.endsWith('/')
                ? outputPublicPath
                : `${outputPublicPath}/`;
            } else {
              base = '/';
            }
            const finalUrl = `${base}${name}`;

            // Replace placeholder in all JS chunks
            for (const asset of compilation.getAssets()) {
              const filename: string = asset.name;
              if (!/\.(js|mjs|cjs)$/i.test(filename)) {
                continue;
              }
              const src = asset.source.source();
              if (typeof src !== 'string') {
                continue;
              }
              if (!src.includes(REACT_ICONS_SPRITE_URL_PLACEHOLDER)) {
                continue;
              }

              const next = src.replaceAll(
                REACT_ICONS_SPRITE_URL_PLACEHOLDER,
                finalUrl,
              );
              compilation.updateAsset(filename, new RawSource(next));
            }
          },
        );
      },
    );
  }
}
