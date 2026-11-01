import { expect, test, vi } from 'vitest';
import { REACT_ICONS_SPRITE_URL_PLACEHOLDER as placeholder } from '../src/index';
import { reactIconsSprite } from '../src/vite/plugin';
import { ReactIconsSpriteWebpackPlugin } from '../src/webpack/plugin';

vi.mock('../src/sprite/build-sprite', () => ({
  buildSprite: async () => '<svg><symbol id="test"/></svg>',
}));

class RawSource {
  private readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  source() {
    return this.value;
  }
}
const invoke = (hook: unknown, context: unknown, ...args: unknown[]) => {
  const fn =
    typeof hook === 'function' ? hook : (hook as { handler: unknown }).handler;
  return (fn as (...args: unknown[]) => unknown).apply(context, args);
};

test.each(['', '/assets/', 'https://cdn.example.com/'])(
  'Vite and Webpack emit matching assets and replace every chunk URL with base %s',
  async (base) => {
    const sprite = { fileName: '', source: '' };
    const vite = reactIconsSprite({ outputDir: '/sprites/' });
    await invoke(vite.configResolved, {}, { root: process.cwd(), base });
    const chunk = { type: 'chunk', code: `${placeholder} ${placeholder}` };
    const css = { type: 'asset', source: placeholder };
    await invoke(
      vite.generateBundle,
      {
        emitFile: (asset: typeof sprite) => {
          Object.assign(sprite, asset);
          return 'sprite';
        },
        getFileName: () => sprite.fileName,
      },
      {},
      { 'main.js': chunk, 'style.css': css },
    );
    expect(sprite.fileName).toMatch(
      /^sprites\/react-icons-sprite-[a-f0-9]{8}\.svg$/,
    );
    expect(sprite.source).toBe('<svg><symbol id="test"/></svg>');
    const expected = `${base}${sprite.fileName} ${base}${sprite.fileName}`;
    expect(chunk.code).toBe(expected);
    expect(css.source).toBe(placeholder);

    let processAssets = async () => {};
    const assets = new Map([
      ['main.js', new RawSource(`${placeholder} ${placeholder}`)],
      ['style.css', new RawSource(placeholder)],
    ]);
    const compilation = {
      hooks: {
        processAssets: {
          tapPromise: (_options: unknown, callback: typeof processAssets) => {
            processAssets = callback;
          },
        },
      },
      outputOptions: { publicPath: base },
      getPath: (value: string) => value,
      emitAsset: (name: string, source: RawSource) => assets.set(name, source),
      getAssets: () => [...assets].map(([name, source]) => ({ name, source })),
      updateAsset: (name: string, source: RawSource) =>
        assets.set(name, source),
    };
    const compiler = {
      options: { mode: 'production' },
      context: process.cwd(),
      webpack: { sources: { RawSource } },
      hooks: {
        thisCompilation: {
          tap: (_name: string, callback: (value: typeof compilation) => void) =>
            callback(compilation),
        },
      },
    };
    new ReactIconsSpriteWebpackPlugin({ outputDir: '/sprites/' }).apply(
      compiler as unknown as Parameters<
        ReactIconsSpriteWebpackPlugin['apply']
      >[0],
    );
    await processAssets();
    expect(assets.get(sprite.fileName)?.source()).toBe(sprite.source);
    expect(assets.get('main.js')?.source()).toBe(expected);
    expect(assets.get('style.css')?.source()).toBe(placeholder);
  },
);
