import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, expect, test } from 'vitest';
import { createIconRenderer } from '../src/sprite/render-icon';

const root = mkdtempSync(path.join(tmpdir(), 'icon-preload-'));
const state = { renders: 0, value: 'before', imported: false };
Object.assign(globalThis, { iconPreloadTest: state });
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  Reflect.deleteProperty(globalThis, 'iconPreloadTest');
});
const reactUrl = pathToFileURL(
  createRequire(import.meta.url).resolve('react'),
).href;
const fixture = (name: string, extra = '') => {
  const baseDir = path.join(root, name);
  const pack = path.join(baseDir, 'node_modules/react-icons');
  mkdirSync(path.join(pack, 'test'), { recursive: true });
  mkdirSync(path.join(pack, 'lib'), { recursive: true });
  writeFileSync(
    path.join(pack, 'package.json'),
    JSON.stringify({ name: 'react-icons', version: '5.7.0', type: 'module' }),
  );
  writeFileSync(
    path.join(pack, 'lib/index.mjs'),
    `import { createElement } from ${JSON.stringify(reactUrl)};
    export function GenIcon() { return () => {
      globalThis.iconPreloadTest.renders++;
      return createElement('svg', {}, createElement('path', { 'data-value': globalThis.iconPreloadTest.value }));
    }; }`,
  );
  writeFileSync(
    path.join(pack, 'test/index.mjs'),
    `// THIS FILE IS AUTO GENERATED
import { GenIcon } from '../lib/index.mjs';
export function TestIcon (props) {
  return GenIcon({})(props);
};
${extra}`,
  );
  return { baseDir, importer: path.join(baseDir, 'src/App.tsx') };
};

test('prepares generated components without rendering them before emission', async () => {
  const options = fixture('generated');
  const render = createIconRenderer();
  const before = state.renders;
  await render.preload('react-icons/test', 'TestIcon', options);
  expect(state.renders).toBe(before);
  state.value = 'emission';
  expect(
    (await render('react-icons/test', 'TestIcon', options)).symbolBody,
  ).toContain('data-value="emission"');
  expect(state.renders).toBe(before + 1);
});

test('defers unrecognized module evaluation until rendering', async () => {
  const options = fixture(
    'fallback',
    'globalThis.iconPreloadTest.imported = true;',
  );
  const render = createIconRenderer();
  await render.preload('react-icons/test', 'TestIcon', options);
  expect(state.imported).toBe(false);
  await render('react-icons/test', 'TestIcon', options);
  expect(state.imported).toBe(true);
});

test('reports deferred module errors when rendering', async () => {
  const options = fixture('failure', 'throw new Error("icon module failed");');
  const render = createIconRenderer();
  await render.preload('react-icons/test', 'TestIcon', options);
  await expect(render('react-icons/test', 'TestIcon', options)).rejects.toThrow(
    'icon module failed',
  );
});

test('a fresh renderer refreshes prepared data for the next build', async () => {
  const options = fixture('rebuild');
  await createIconRenderer().preload('react-icons/test', 'TestIcon', options);
  writeFileSync(
    path.join(options.baseDir, 'node_modules/react-icons/test/index.mjs'),
    'throw new Error("changed module");',
  );
  const render = createIconRenderer();
  await render.preload('react-icons/test', 'TestIcon', options);
  await expect(render('react-icons/test', 'TestIcon', options)).rejects.toThrow(
    'changed module',
  );
});
