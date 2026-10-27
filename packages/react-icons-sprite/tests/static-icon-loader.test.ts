import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type ComponentType, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, expect, test, vi } from 'vitest';
import { renderIcon } from '../src/sprite/render-icon';
import { createStaticIconLoader } from '../src/sprite/static-icon-loader';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

const require = createRequire(import.meta.url);
const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'static-icon-loader-'));
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));
const data = {
  tag: 'svg',
  attr: { viewBox: '0 0 24 24', strokeWidth: 1.5 },
  child: [
    { tag: 'path', attr: { d: 'M0 0h24v24z', fillRule: 'evenodd' }, child: [] },
  ],
};
const reactIconsSource = (
  definition = JSON.stringify(data),
) => `// THIS FILE IS AUTO GENERATED
import { GenIcon } from '../lib/index.mjs';
export function TestIcon (props) {
  return GenIcon(${definition})(props);
};
export function OtherIcon (props) {
  return GenIcon(${JSON.stringify(data)})(props);
};
`;
const reactIconsFixture = (name: string, source = reactIconsSource()) => {
  const root = path.join(fixtureRoot, name);
  mkdirSync(path.join(root, 'pack'), { recursive: true });
  mkdirSync(path.join(root, 'lib'), { recursive: true });
  const library = path.join(
    path.dirname(require.resolve('react-icons/fa')),
    '../lib/index.mjs',
  );
  writeFileSync(
    path.join(root, 'lib/index.mjs'),
    `export { GenIcon } from ${JSON.stringify(pathToFileURL(library).href)};`,
  );
  const file = path.join(root, 'pack/index.mjs');
  writeFileSync(file, source);
  return file;
};
const lucideFixture = (name: string, source: string) => {
  const root = path.join(fixtureRoot, name);
  mkdirSync(path.join(root, 'icons'), { recursive: true });
  const library = path.join(
    path.dirname(require.resolve('lucide-react/package.json')),
    'dist/esm/createLucideIcon.mjs',
  );
  writeFileSync(
    path.join(root, 'createLucideIcon.mjs'),
    `export { default } from ${JSON.stringify(pathToFileURL(library).href)};`,
  );
  const file = path.join(root, 'icons/test.mjs');
  writeFileSync(file, source);
  return file;
};
const lucideSource = `import createLucideIcon from '../createLucideIcon.mjs';
const __iconData = { name: 'test', size: 24, node: [['path', { d: 'M0 0h24v24z', key: 'a' }]] };
__iconData.node;
const TestIcon = createLucideIcon(__iconData);
export { __iconData, TestIcon as default };`;
const markup = (component: unknown) =>
  renderToStaticMarkup(createElement(component as ComponentType));

test('reads generated React Icons data but constructs components with the real factory', async () => {
  const file = reactIconsFixture('generated');
  const loader = createStaticIconLoader();
  const actual = await loader('react-icons/test', file, 'TestIcon', '5.7.0');
  expect(actual).not.toBeNull();
  const original = await import(pathToFileURL(file).href);
  expect(markup(actual)).toBe(markup(original.TestIcon));
});

test('indexes each pack once and refreshes its data for the next sprite build', async () => {
  const file = reactIconsFixture('cache');
  const loader = createStaticIconLoader();
  vi.mocked(readFile).mockClear();
  await Promise.all([
    loader('react-icons/test', file, 'TestIcon', '5.7.0'),
    loader('react-icons/test', file, 'OtherIcon', '5.7.0'),
  ]);
  expect(
    vi.mocked(readFile).mock.calls.filter(([name]) => name === file),
  ).toHaveLength(1);
  writeFileSync(
    file,
    reactIconsSource(
      JSON.stringify({ ...data, attr: { viewBox: '0 0 16 16' } }),
    ),
  );
  expect(
    markup(
      await createStaticIconLoader()(
        'react-icons/test',
        file,
        'TestIcon',
        '5.7.0',
      ),
    ),
  ).toContain('viewBox="0 0 16 16"');
});

test('bounds concurrent reads and drains queued work after a read fails', async () => {
  const releases: Array<(fail?: boolean) => void> = [];
  for (let i = 0; i < 70; i++) {
    vi.mocked(readFile).mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          releases.push((fail) =>
            fail
              ? reject(new Error('read failed'))
              : resolve('unrecognized source'),
          );
        }),
    );
  }
  const loader = createStaticIconLoader();
  const pending = Array.from({ length: 70 }, (_, i) =>
    loader('lucide-react', `/queue/icon-${i}.mjs`, 'default', '1.53.0'),
  );
  try {
    expect(releases).toHaveLength(32);
    releases.shift()?.(true);
    await vi.waitFor(() => expect(releases).toHaveLength(32));
    while (releases.length) {
      for (const release of releases.splice(0)) {
        release();
      }
      await Promise.resolve();
    }
    expect(await Promise.all(pending)).toEqual(Array(70).fill(null));
  } finally {
    vi.mocked(readFile).mockRestore();
  }
});

test.each([
  [
    'additional module code',
    `${reactIconsSource()}globalThis.staticIconSideEffect = true;`,
  ],
  ['dynamic data', reactIconsSource('{...makeIcon()}')],
  [
    'prototype properties',
    reactIconsSource('{"__proto__":{},"tag":"svg","attr":{},"child":[]}'),
  ],
  [
    'changed generator',
    reactIconsSource().replace('GenIcon(', 'OtherFactory('),
  ],
])(
  'leaves %s in React Icons to the ordinary import path',
  async (name, source) => {
    const file = reactIconsFixture(name, source);
    expect(
      await createStaticIconLoader()(
        'react-icons/test',
        file,
        'TestIcon',
        '5.7.0',
      ),
    ).toBeNull();
  },
);

test.each(['4.12.0', '6.0.0', undefined])(
  'leaves unrecognized React Icons version %s to imports',
  async (version) => {
    const file = reactIconsFixture(`version-${version}`);
    expect(
      await createStaticIconLoader()(
        'react-icons/test',
        file,
        'TestIcon',
        version,
      ),
    ).toBeNull();
  },
);

test.each([
  ['object data', lucideSource],
  [
    'literal arguments',
    `import createLucideIcon from '../createLucideIcon.mjs';
    const TestIcon = createLucideIcon('Test', [['path', { d: 'M0 0h24v24z', key: 'a' }]]);
    export { TestIcon as default };`,
  ],
  [
    'array data',
    `import createLucideIcon from '../createLucideIcon.mjs';
    const __iconNode = [['path', { d: 'M0 0h24v24z', key: 'a' }]];
    const TestIcon = createLucideIcon('Test', __iconNode);
    export { __iconNode, TestIcon as default };`,
  ],
])('loads pure Lucide %s through its real factory', async (name, source) => {
  const file = lucideFixture(name, source);
  const actual = await createStaticIconLoader()(
    'lucide-react',
    file,
    'default',
    '1.53.0',
  );
  expect(actual).not.toBeNull();
  const original = await import(pathToFileURL(file).href);
  expect(markup(actual)).toBe(markup(original.default));
});

test.each([
  [
    'module side effects',
    `${lucideSource}\nglobalThis.staticIconSideEffect = true;`,
  ],
  ['computed data', lucideSource.replace('size: 24', 'size: calculateSize()')],
  ['getters', lucideSource.replace('size: 24', 'get size() { return 24; }')],
  ['spread data', lucideSource.replace('size: 24', '...otherData')],
  ['additional imports', `import './side-effects.mjs';\n${lucideSource}`],
])('leaves Lucide %s to ordinary module evaluation', async (name, source) => {
  const file = lucideFixture(name, source);
  expect(
    await createStaticIconLoader()('lucide-react', file, 'default', '1.53.0'),
  ).toBeNull();
});

test('does not turn an exported Lucide data object into a component', async () => {
  const file = lucideFixture('data-export', lucideSource);
  expect(
    await createStaticIconLoader()(
      'lucide-react',
      file,
      '__iconData',
      '1.53.0',
    ),
  ).toBeNull();
});

test.each([
  ['react-icons/fa', 'FaCamera'],
  ['react-icons/md', 'MdBuild'],
  ['react-icons/fi', 'FiCpu'],
  ['react-icons/lu', 'LuWheat'],
  ['lucide-react', 'Settings2'],
  ['lucide-react', 'Fingerprint'],
])('preserves the SVG from installed %s/%s', async (pack, name) => {
  const original = require(pack)[name];
  const expected = /<svg\b[^>]*>([\s\S]*?)<\/svg>/.exec(markup(original))?.[1];
  expect(
    (await renderIcon(pack, name, { baseDir: process.cwd() })).symbolBody,
  ).toBe(expected);
});
