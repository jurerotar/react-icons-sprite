import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, expect, test } from 'vitest';
import { renderIcon } from '../src/sprite/render-icon';

const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'lucide-versions-'));
const reactUrl = pathToFileURL(
  createRequire(import.meta.url).resolve('react'),
).href;
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

test.each(['0.1.2-beta.0', '0.103.0'])(
  'renders older Lucide %s through its CommonJS bundle',
  async (version) => {
    const baseDir = path.join(fixtureRoot, version);
    const packageRoot = path.join(baseDir, 'node_modules/lucide-react');
    mkdirSync(path.join(packageRoot, 'dist/cjs'), { recursive: true });
    writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        name: 'lucide-react',
        version,
        main: 'index.js',
      }),
    );
    writeFileSync(
      path.join(packageRoot, 'dist/cjs/lucide-react.js'),
      `
const { createElement } = require(${JSON.stringify(createRequire(import.meta.url).resolve('react'))});
exports.Maximize2 = () => createElement('svg', { viewBox: '0 0 24 24' }, createElement('path', { d: 'M0 0h24v24z' }));`,
    );
    const rendered = await renderIcon('lucide-react', 'Maximize2', { baseDir });
    expect(rendered.symbolBody).toContain('<path');
  },
);

test.each([
  ['0.104.0', 'js', 'dist/esm/lucide-react.js'],
  ['0.261.0', 'js', 'dist/esm/lucide-react.js'],
  ['0.262.0', 'mjs', 'dist/esm/lucide-react.js'],
  ['0.263.0', 'mjs', 'dist/esm/lucide-react.js'],
  ['0.263.1', 'mjs', 'dist/esm/lucide-react.mjs'],
  ['0.263.2-beta.0', 'js', 'dist/esm/lucide-react.js'],
  ['1.0.0', 'js', 'dist/esm/lucide-react.js'],
  ['1.8.0', 'js', 'dist/esm/lucide-react.js'],
  ['1.9.0', 'mjs', 'dist/esm/lucide-react.mjs'],
  ['1.53.0', 'mjs', 'dist/esm/lucide-react.mjs'],
])(
  'renders direct icons and renamed aliases in Lucide %s',
  async (version, extension, advertisedEntry) => {
    const baseDir = path.join(fixtureRoot, version);
    const packageRoot = path.join(baseDir, 'node_modules/lucide-react');
    const esmDir = path.join(packageRoot, 'dist/esm');
    mkdirSync(path.join(esmDir, 'icons'), { recursive: true });
    writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        name: 'lucide-react',
        version,
        type: 'module',
        module: advertisedEntry,
      }),
    );
    writeFileSync(
      path.join(esmDir, `icons/maximize-2.${extension}`),
      `
import { createElement } from ${JSON.stringify(reactUrl)};
export default function Icon() {
  return createElement('svg', { viewBox: '0 0 24 24' }, createElement('path', { d: 'M0 0h24v24z' }));
}`,
    );
    writeFileSync(
      path.join(esmDir, `lucide-react.${extension}`),
      `
export { default as Maximize2, default as RenamedIcon } from './icons/maximize-2.${extension}';`,
    );

    for (const name of ['Maximize2', 'RenamedIcon']) {
      const rendered = await renderIcon('lucide-react', name, { baseDir });
      expect(rendered.viewBox).toBe('0 0 24 24');
      expect(rendered.symbolBody).toContain('<path');
    }
    await expect(
      renderIcon('lucide-react', 'DoesNotExist', { baseDir }),
    ).rejects.toThrow('Expected a React component export');
  },
);
