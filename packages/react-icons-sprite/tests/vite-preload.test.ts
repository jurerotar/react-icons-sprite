import { beforeEach, expect, test, vi } from 'vitest';
import { reactIconsSprite } from '../src/vite/plugin';

const mocks = vi.hoisted(() => ({
  renderers: [] as Array<{ preload: ReturnType<typeof vi.fn> }>,
  buildSprite: vi.fn(async () => '<svg/>'),
}));
vi.mock('../src/sprite/render-icon', () => ({
  createIconRenderer: () => {
    const render = Object.assign(vi.fn(), {
      preload: vi.fn(() => new Promise<void>(() => {})),
    });
    mocks.renderers.push(render);
    return render;
  },
}));
vi.mock('../src/sprite/build-sprite', () => ({
  buildSprite: mocks.buildSprite,
}));
beforeEach(() => {
  mocks.renderers.length = 0;
  mocks.buildSprite.mockClear();
});
const invoke = async (hook: unknown, ...args: unknown[]) => {
  const fn =
    typeof hook === 'function' ? hook : (hook as { handler: unknown }).handler;
  return (fn as (...args: unknown[]) => unknown).apply(
    {
      emitFile: () => 'sprite',
      getFileName: () => 'sprite.svg',
    },
    args,
  );
};
const code = `import { Camera } from 'lucide-react'; export const Icon = () => <Camera/>;`;

test('starts preparation during transform without waiting and shares it with emission', async () => {
  const plugin = reactIconsSprite();
  await invoke(plugin.configResolved, { root: '/project', base: '/' });
  await invoke(plugin.buildStart);
  const render = mocks.renderers.at(-1);
  const result = await invoke(plugin.transform, code, '/project/App.tsx?query');
  expect(result).toHaveProperty('code');
  expect(render?.preload).toHaveBeenCalledWith('lucide-react', 'Camera', {
    baseDir: '/project',
    importer: '/project/App.tsx',
  });
  expect(mocks.buildSprite).not.toHaveBeenCalled();
  await invoke(plugin.generateBundle, {}, {});
  expect(mocks.buildSprite).toHaveBeenLastCalledWith(
    [
      {
        pack: 'lucide-react',
        exportName: 'Camera',
        importer: '/project/App.tsx',
      },
    ],
    { baseDir: '/project', renderIcon: render },
  );

  await invoke(plugin.buildStart);
  expect(mocks.renderers.at(-1)).not.toBe(render);
  await invoke(plugin.generateBundle, {}, {});
  expect(mocks.buildSprite).toHaveBeenLastCalledWith([], {
    baseDir: '/project',
    renderIcon: mocks.renderers.at(-1),
  });
});

test('does not prepare excluded sources or unsupported files', async () => {
  const plugin = reactIconsSprite({ exclude: [/^lucide-react$/] });
  await invoke(plugin.buildStart);
  await invoke(plugin.transform, code, '/project/App.tsx');
  await invoke(plugin.transform, code, '/project/styles.css');
  expect(mocks.renderers.at(-1)?.preload).not.toHaveBeenCalled();
});
