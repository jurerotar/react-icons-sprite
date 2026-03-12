import { describe, it, expect, vi } from 'vitest';
import { reactIconsSprite } from '../src/vite/plugin';
import { REACT_ICONS_SPRITE_URL_PLACEHOLDER } from '../src';
import type {
  PluginContext,
  TransformPluginContext,
  NormalizedOutputOptions,
  OutputBundle,
  TransformResult,
} from 'rollup';

type EmitOptions = Parameters<PluginContext['emitFile']>[0];
type EmitOptionsLike = EmitOptions & { name?: string };
type BuildStartFn = (this: PluginContext) => void;
type TransformFn = (
  this: TransformPluginContext,
  code: string,
  id: string,
) => TransformResult;
type GenerateBundleFn = (
  this: PluginContext,
  options: NormalizedOutputOptions,
  bundle: OutputBundle,
) => void | Promise<void>;

describe('Vite plugin - transform filter and error handling', () => {
  it('skips non-code extensions in transform', () => {
    const plugin = reactIconsSprite();
    const transform = plugin.transform as TransformFn | undefined;
    const emptyTransformCtx = {} as TransformPluginContext;
    const res = transform?.call(
      emptyTransformCtx,
      `@import 'x.css';`,
      'styles.css',
    );
    expect(res).toBeNull();
  });

  it('returns null when there is react-icons import but no JSX usage', () => {
    const plugin = reactIconsSprite();
    const transform = plugin.transform as TransformFn | undefined;
    const emptyTransformCtx = {} as TransformPluginContext;
    const src = `import { BiAlarm } from 'react-icons/bi';\nexport const C = () => <div/>;`;
    const res = transform?.call(emptyTransformCtx, src, 'no-usage.tsx');
    expect(res).toBeNull();
  });

  it('returns null and logs error for malformed code even if import pattern matches', () => {
    const plugin = reactIconsSprite();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const bad = `import { BiAlarm from 'react-icons/bi';\nexport const C = () => <BiAlarm/>;`;
    const transform = plugin.transform as TransformFn | undefined;
    const emptyTransformCtx = {} as TransformPluginContext;
    const res = transform?.call(emptyTransformCtx, bad, 'bad.tsx');
    expect(res).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('Vite plugin - generateBundle multi-chunk and collector lifecycle', () => {
  const emptyPluginCtx = {} as PluginContext;
  it('replaces placeholders across multiple chunks and leaves others untouched', async () => {
    const plugin = reactIconsSprite();
    const buildStart = plugin.buildStart as BuildStartFn | undefined;
    buildStart?.call(emptyPluginCtx);

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
      'a.js': {
        type: 'chunk',
        code: `const s = '${REACT_ICONS_SPRITE_URL_PLACEHOLDER}';`,
      },
      'b.js': {
        type: 'chunk',
        code: `console.log("${REACT_ICONS_SPRITE_URL_PLACEHOLDER}")`,
      },
      'c.js': { type: 'chunk', code: `console.log('no placeholder')` },
    };

    const generateBundle = plugin.generateBundle as
      | GenerateBundleFn
      | undefined;
    await generateBundle!.call(
      ctx as PluginContext,
      {} as NormalizedOutputOptions,
      bundle as OutputBundle,
    );

    // a.js and b.js should have replacements, c.js should remain unchanged
    const name = emitted[0]!.fileName as string;
    expect(bundle['a.js'].code).toContain(`'/${name}'`);
    expect(bundle['b.js'].code).toContain(`"/${name}"`);
    expect(bundle['c.js'].code).toBe(`console.log('no placeholder')`);
  });

  it('clears collector between builds via buildStart (no stale icons)', async () => {
    const plugin = reactIconsSprite();

    // First build: collect an icon via transform
    const buildStart1 = plugin.buildStart as BuildStartFn | undefined;
    buildStart1?.call(emptyPluginCtx);
    const src = `import { BiAlarm } from 'react-icons/bi'; export const C = () => <BiAlarm/>;`;
    const transform = plugin.transform as TransformFn | undefined;
    const emptyTransformCtx2 = {} as TransformPluginContext;
    transform?.call(emptyTransformCtx2, src, 'x.tsx');

    const emitted1: EmitOptionsLike[] = [];
    const ctx1 = {
      emitFile(opts: EmitOptionsLike) {
        emitted1.push(opts);
        return 'asset1';
      },
      getFileName(_id: string) {
        return (emitted1[0]!.fileName ?? emitted1[0]!.name) as string;
      },
    } satisfies Pick<PluginContext, 'emitFile' | 'getFileName'>;
    const bundle1: Record<string, { type: 'chunk'; code: string }> = {
      'e.js': {
        type: 'chunk',
        code: `const u='${REACT_ICONS_SPRITE_URL_PLACEHOLDER}'`,
      },
    };
    const generateBundle1 = plugin.generateBundle as
      | GenerateBundleFn
      | undefined;
    await generateBundle1!.call(
      ctx1 as PluginContext,
      {} as NormalizedOutputOptions,
      bundle1 as OutputBundle,
    );
    expect(emitted1).toHaveLength(1);

    // Second build: clear collector; without new transforms, sprite should be empty
    const buildStart2 = plugin.buildStart as BuildStartFn | undefined;
    buildStart2?.call(emptyPluginCtx);
    const emitted2: EmitOptionsLike[] = [];
    const ctx2 = {
      emitFile(opts: EmitOptionsLike) {
        emitted2.push(opts);
        return 'asset2';
      },
      getFileName(_id: string) {
        return (emitted2[0]!.fileName ?? emitted2[0]!.name) as string;
      },
    } satisfies Pick<PluginContext, 'emitFile' | 'getFileName'>;
    const bundle2: Record<string, { type: 'chunk'; code: string }> = {
      'e.js': {
        type: 'chunk',
        code: `const u='${REACT_ICONS_SPRITE_URL_PLACEHOLDER}'`,
      },
    };
    const generateBundle2 = plugin.generateBundle as
      | GenerateBundleFn
      | undefined;
    await generateBundle2!.call(
      ctx2 as PluginContext,
      {} as NormalizedOutputOptions,
      bundle2 as OutputBundle,
    );
    expect(emitted2).toHaveLength(1);

    // File names should differ between builds unless sprite XML coincidentally equal
    // But importantly, second build is based on empty sprite and still replaces placeholders
    expect(bundle2['e.js'].code).toContain(`'/${emitted2[0]!.fileName}'`);
  });
});
