import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type ComponentType, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, expect, test, vi } from 'vitest';
import {
  createIconRenderer,
  extractSymbolAttributes,
  renderIcon,
} from '../src/sprite/render-icon';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
    statSync: vi.fn(actual.statSync),
  };
});

const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'lucide-aliases-'));
const require = createRequire(import.meta.url);
const reactUrl = pathToFileURL(require.resolve('react')).href;
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

const fixture = (name: string, entry: string) => {
  const baseDir = path.join(fixtureRoot, name);
  const esmDir = path.join(baseDir, 'node_modules/lucide-react/dist/esm');
  mkdirSync(path.join(esmDir, 'icons'), { recursive: true });
  writeFileSync(
    path.join(esmDir, '../../package.json'),
    JSON.stringify({ name: 'lucide-react', version: '1.53.0', type: 'module' }),
  );
  const entryFile = path.join(esmDir, 'lucide-react.mjs');
  writeFileSync(entryFile, entry);
  const writeIcon = (filename: string, marker: string, named = false) => {
    const target = path.join(esmDir, 'icons', filename);
    writeFileSync(
      target,
      `import { createElement } from ${JSON.stringify(reactUrl)};
       export ${named ? '' : 'default '}function Canonical() {
         return createElement('svg', { viewBox: '0 0 16 16' },
           createElement('path', { d: 'M0 0h16v16z', 'data-fixture': ${JSON.stringify(marker)} }));
       }`,
    );
    return target;
  };
  return { baseDir, entryFile, writeIcon };
};

test.each(['Fingerprint', 'AArrowDown', 'Grid2x2', 'XCircle', 'UsbCPort'])(
  'renders the same SVG as the installed Lucide %s export',
  async (name) => {
    const library = require('lucide-react') as Record<string, ComponentType>;
    const markup = renderToStaticMarkup(createElement(library[name]));
    const icon = await renderIcon('lucide-react', name, {
      baseDir: process.cwd(),
    });
    expect(icon).toEqual({
      viewBox: '0 0 24 24',
      symbolBody: /<svg\b[^>]*>([\s\S]*?)<\/svg>/.exec(markup)?.[1],
      symbolAttributes: extractSymbolAttributes(markup),
    });
  },
);

test('loads only the alias target and reads reexports once per renderer', async () => {
  const { baseDir, entryFile, writeIcon } = fixture(
    'direct-aliases',
    `
    // export { default as Alias } from './icons/false-comment.mjs';
    const text = "export { default as Alias } from './icons/false-string.mjs';";
    export { default as Alias, default as OtherAlias } from './icons/canonical.mjs';
    export { default as Unused } from './icons/missing.mjs';
  `,
  );
  writeIcon('canonical.mjs', 'target');
  const render = createIconRenderer();
  vi.mocked(readFileSync).mockClear();
  const icons = await Promise.all(
    ['Alias', 'OtherAlias'].map((name) =>
      render('lucide-react', name, { baseDir }),
    ),
  );
  for (const icon of icons) {
    expect(icon.symbolBody).toContain('data-fixture="target"');
  }
  expect(
    vi.mocked(readFileSync).mock.calls.filter(([file]) => file === entryFile),
  ).toHaveLength(1);
});

test('probes an already resolved direct icon only once', async () => {
  const { baseDir, writeIcon } = fixture('direct-file', '');
  const target = writeIcon('canonical.mjs', 'direct');
  vi.mocked(statSync).mockClear();
  expect(
    (await renderIcon('lucide-react', 'Canonical', { baseDir })).symbolBody,
  ).toContain('data-fixture="direct"');
  expect(
    vi.mocked(statSync).mock.calls.filter(([file]) => file === target),
  ).toHaveLength(1);
});

test('keeps the entry module fallback for named reexports', async () => {
  const { baseDir, writeIcon } = fixture(
    'named-reexport',
    "export { Canonical as Alias } from './icons/canonical.mjs';",
  );
  writeIcon('canonical.mjs', 'named', true);
  expect(
    (await renderIcon('lucide-react', 'Alias', { baseDir })).symbolBody,
  ).toContain('data-fixture="named"');
});

test('refreshes alias mappings between sprite builds', async () => {
  const { baseDir, entryFile, writeIcon } = fixture(
    'refresh',
    "export { default as Alias } from './icons/first.mjs';",
  );
  writeIcon('first.mjs', 'first');
  writeIcon('second.mjs', 'second');
  const render = createIconRenderer();
  expect(
    (await render('lucide-react', 'Alias', { baseDir })).symbolBody,
  ).toContain('data-fixture="first"');
  writeFileSync(
    entryFile,
    "export { default as Alias } from './icons/second.mjs';",
  );
  expect(
    (await createIconRenderer()('lucide-react', 'Alias', { baseDir }))
      .symbolBody,
  ).toContain('data-fixture="second"');
});
