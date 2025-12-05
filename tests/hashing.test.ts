import { describe, it, expect } from 'vitest';
import { reactIconsSprite } from '../src/vite/plugin';
import { PLACEHOLDER } from '../src/core';
import { createHash } from 'node:crypto';
import type {
  PluginContext,
  NormalizedOutputOptions,
  OutputBundle,
} from 'rollup';

type EmitOptions = Parameters<PluginContext['emitFile']>[0];
type EmitOptionsLike = EmitOptions & { name?: string };

type BuildStartFn = (this: PluginContext) => void;

type GenerateBundleFn = (
  this: PluginContext,
  options: NormalizedOutputOptions,
  bundle: OutputBundle,
) => void | Promise<void>;

describe('vite plugin hashing and URL replacement', () => {
  const emptyPluginCtx = {} as PluginContext;
  it('generates hashed file name when fileName is omitted and replaces placeholder URLs', async () => {
    const plugin = reactIconsSprite();

    // simulate buildStart/collector reset
    const buildStart = plugin.buildStart as BuildStartFn | undefined;
    buildStart?.call(emptyPluginCtx);

    const emitted: EmitOptionsLike[] = [];
    const ctx = {
      emitFile(opts: EmitOptionsLike) {
        emitted.push(opts);
        return 'asset1';
      },
      getFileName(_id: string) {
        // Vite would return the final asset path; we mimic it by echoing provided fileName
        return (emitted[0]!.fileName ?? emitted[0]!.name) as string;
      },
    } satisfies Pick<PluginContext, 'emitFile' | 'getFileName'>;

    const chunkCode = `const a = '${PLACEHOLDER}'; const b = "${PLACEHOLDER}";`;
    const bundle: Record<string, { type: 'chunk'; code: string }> = {
      'entry.js': { type: 'chunk', code: chunkCode },
    };

    const generateBundle = plugin.generateBundle as
      | GenerateBundleFn
      | undefined;
    await generateBundle!.call(
      ctx as PluginContext,
      {} as NormalizedOutputOptions,
      bundle as OutputBundle,
    );

    expect(emitted).toHaveLength(1);

    const spriteXml =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs></defs></svg>';
    const expectedHash = createHash('sha256')
      .update(spriteXml)
      .digest('hex')
      .slice(0, 8);
    const expectedName = `react-icons-sprite-${expectedHash}.svg`;

    // Ensure the emitted fileName follows expected pattern and equals expectedName
    expect(emitted[0]!.fileName).toBe(expectedName);

    // Placeholder replaced with absolute URL using the emitted name
    expect(bundle['entry.js'].code).toContain(`'/${expectedName}'`);
    expect(bundle['entry.js'].code).toContain(`"/${expectedName}"`);
  });

  it('uses provided fileName and replaces placeholder URLs accordingly', async () => {
    const plugin = reactIconsSprite({ fileName: 'custom-sprite.svg' });
    const buildStart2 = plugin.buildStart as BuildStartFn | undefined;
    buildStart2?.call(emptyPluginCtx);

    const emitted: EmitOptionsLike[] = [];
    const ctx = {
      emitFile(opts: EmitOptionsLike) {
        emitted.push(opts);
        return 'asset1';
      },
      getFileName(_id: string) {
        return (emitted[0]!.fileName ?? emitted[0]!.name) as string;
      },
    } satisfies Pick<PluginContext, 'emitFile' | 'getFileName'>;

    const bundle: Record<string, { type: 'chunk'; code: string }> = {
      'entry.js': { type: 'chunk', code: `console.log('${PLACEHOLDER}')` },
    };

    const generateBundle2 = plugin.generateBundle as
      | GenerateBundleFn
      | undefined;
    await generateBundle2!.call(
      ctx as PluginContext,
      {} as NormalizedOutputOptions,
      bundle as OutputBundle,
    );

    expect(emitted[0]!.fileName).toBe('custom-sprite.svg');
    expect(bundle['entry.js'].code).toContain("'/custom-sprite.svg'");
  });
});
