import { describe, it, expect, vi } from 'vitest';
import { ReactIconsSpriteWebpackPlugin } from '../src/webpack/plugin';
import reactIconsSpriteLoader from '../src/webpack/loader';
import type { Compiler, LoaderContext } from 'webpack';

describe('Webpack integration - mode check', () => {
  it('plugin does NOT tap hooks in development mode', () => {
    const compiler = {
      options: { mode: 'development' },
      hooks: {
        thisCompilation: {
          tap: vi.fn(),
        },
      },
    } as unknown as Compiler;

    const plugin = new ReactIconsSpriteWebpackPlugin();
    plugin.apply(compiler);

    expect(compiler.hooks.thisCompilation.tap).not.toHaveBeenCalled();
  });

  it('plugin DOES tap hooks in production mode', () => {
    const compiler = {
      options: { mode: 'production' },
      hooks: {
        thisCompilation: {
          tap: vi.fn(),
        },
      },
    } as unknown as Compiler;

    const plugin = new ReactIconsSpriteWebpackPlugin();
    plugin.apply(compiler);

    expect(compiler.hooks.thisCompilation.tap).toHaveBeenCalledWith(
      'react-icons-sprite-webpack-plugin',
      expect.any(Function),
    );
  });

  it('loader does NOT transform in development mode', async () => {
    const source =
      "import { BiAlarm } from 'react-icons/bi'; export const C = () => <BiAlarm/>;";
    const context = {
      mode: 'development',
      resourcePath: 'test.tsx',
    } as unknown as LoaderContext<any>;

    const result = await reactIconsSpriteLoader.call(
      context,
      source,
      undefined,
    );
    expect(result).toBe(source);
  });

  it('loader DOES transform in production mode', async () => {
    const source =
      "import { BiAlarm } from 'react-icons/bi'; export const C = () => <BiAlarm/>;";
    const context = {
      mode: 'production',
      resourcePath: 'test.tsx',
      emitWarning: vi.fn(),
    } as unknown as LoaderContext<any>;

    const result = await reactIconsSpriteLoader.call(
      context,
      source,
      undefined,
    );
    expect(result).not.toBe(source);
    expect(result).toContain('SpriteIcon');
    expect(result).toContain('iconId="ri-react-icons-bi-BiAlarm"');
  });
});
