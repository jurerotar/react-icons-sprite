import { createHash } from 'node:crypto';
import { PLACEHOLDER, buildSprite } from '../core';
import { collector } from '../collector';
import type { Compiler, Compilation, WebpackPluginInstance } from 'webpack';

export type ReactIconsSpriteWebpackPluginOptions = {
  /**
   * If passed, this exact string will be used for the emitted file name.
   * If fileName is omitted, name will be generated as `react-icons-sprite-[hash].svg`.
   * This is useful when, for example, multiple sprite sheets are generated during client and server builds.
   */
  fileName?: string;
};

export class ReactIconsSpriteWebpackPlugin implements WebpackPluginInstance {
  private readonly fileName?: string;

  constructor(options: ReactIconsSpriteWebpackPluginOptions = {}) {
    this.fileName = options.fileName;
  }

  apply(compiler: Compiler): void {
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
            const spriteXml = await buildSprite(collector.toList());

            const generatedHash = createHash('sha256')
              .update(spriteXml)
              .digest('hex')
              .slice(0, 8);

            const name =
              this.fileName ?? `react-icons-sprite-${generatedHash}.svg`;

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
              if (!src.includes(PLACEHOLDER)) {
                continue;
              }

              const next = src.replaceAll(PLACEHOLDER, finalUrl);
              compilation.updateAsset(filename, new RawSource(next));
            }
          },
        );
      },
    );
  }
}
