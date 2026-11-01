import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, expect, test, vi } from 'vitest';
import { createIconRenderer } from '../src/sprite/render-icon';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, existsSync: vi.fn(actual.existsSync) };
});

const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), 'icon-package-resolution-'),
);
const pack = '@tabler/icons-react';
const reactUrl = pathToFileURL(
  createRequire(import.meta.url).resolve('react'),
).href;
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

const writePackage = (baseDir: string, marker: string) => {
  const root = path.join(baseDir, 'node_modules', pack);
  mkdirSync(path.join(root, 'dist/esm/icons'), { recursive: true });
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: pack,
      version: '2.1.0',
      type: 'module',
    }),
  );
  writeFileSync(
    path.join(root, 'dist/esm/icons/IconCircle.js'),
    `
    import { createElement } from ${JSON.stringify(reactUrl)};
    export function IconCircle() {
      return createElement('svg', { viewBox: '0 0 24 24' },
        createElement('path', { d: 'M0 0h24v24z', 'data-package': ${JSON.stringify(marker)} }));
    }
  `,
  );
};

test('shares ancestor lookups across sibling importer directories', async () => {
  const baseDir = path.join(fixtureRoot, 'siblings');
  writePackage(baseDir, 'root');
  const render = createIconRenderer();
  vi.mocked(existsSync).mockClear();
  for (const name of ['one', 'two', 'three']) {
    const icon = await render(pack, 'IconCircle', {
      baseDir,
      importer: path.join(
        baseDir,
        'features/settings/components',
        name,
        'Icon.tsx',
      ),
    });
    expect(icon.symbolBody).toContain('data-package="root"');
  }
  for (const directory of [
    '',
    'features',
    'features/settings',
    'features/settings/components',
  ]) {
    const manifest = path.join(
      baseDir,
      directory,
      'node_modules',
      pack,
      'package.json',
    );
    expect(
      vi.mocked(existsSync).mock.calls.filter(([file]) => file === manifest),
    ).toHaveLength(1);
  }
});

test('checks nearer packages before using a cached ancestor result', async () => {
  const baseDir = path.join(fixtureRoot, 'shadowed');
  const nestedDir = path.join(baseDir, 'features/isolated');
  writePackage(baseDir, 'root');
  writePackage(nestedDir, 'nested');
  const render = createIconRenderer();
  expect(
    (
      await render(pack, 'IconCircle', {
        baseDir,
        importer: path.join(baseDir, 'features/standard/Icon.tsx'),
      })
    ).symbolBody,
  ).toContain('data-package="root"');
  expect(
    (
      await render(pack, 'IconCircle', {
        baseDir,
        importer: path.join(nestedDir, 'src/Icon.tsx'),
      })
    ).symbolBody,
  ).toContain('data-package="nested"');
});

test('shares missing package lookups across sibling directories', async () => {
  const baseDir = path.join(fixtureRoot, 'missing');
  const missingPack = 'react-icons-sprite-missing-test-package';
  const render = createIconRenderer();
  vi.mocked(existsSync).mockClear();
  for (const name of ['one', 'two']) {
    await expect(
      render(missingPack, 'Icon', {
        baseDir: path.join(baseDir, name),
      }),
    ).rejects.toThrow(/Cannot find (?:package|module)/);
  }
  const manifest = path.join(
    baseDir,
    'node_modules',
    missingPack,
    'package.json',
  );
  expect(
    vi.mocked(existsSync).mock.calls.filter(([file]) => file === manifest),
  ).toHaveLength(1);
});

test('refreshes ancestor lookups for the next sprite build', async () => {
  const baseDir = path.join(fixtureRoot, 'refresh');
  const nestedDir = path.join(baseDir, 'features/isolated');
  writePackage(baseDir, 'root');
  const options = { baseDir, importer: path.join(nestedDir, 'src/Icon.tsx') };
  expect(
    (await createIconRenderer()(pack, 'IconCircle', options)).symbolBody,
  ).toContain('data-package="root"');
  writePackage(nestedDir, 'new-package');
  expect(
    (await createIconRenderer()(pack, 'IconCircle', options)).symbolBody,
  ).toContain('data-package="new-package"');
});
