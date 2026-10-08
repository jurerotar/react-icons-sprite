import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, expect, test } from 'vitest';
import { renderIcon } from '../src/sprite/render-icon';

const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'icon-versions-'));
const reactPath = createRequire(import.meta.url).resolve('react');
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

const writePackage = (
  baseDir: string,
  pack: string,
  version: string,
  filename: string,
  name: string,
  commonJS = false,
) => {
  const root = path.join(baseDir, 'node_modules', pack);
  mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: pack,
      version,
      type: commonJS ? 'commonjs' : 'module',
    }),
  );
  const body = `function Icon() {
    return createElement('svg', { viewBox: '0 0 24 24' },
      createElement('path', { d: 'M0 0h24v24z', 'data-version': '${version}' }));
  }`;
  writeFileSync(
    path.join(root, filename),
    commonJS
      ? `const { createElement } = require(${JSON.stringify(reactPath)});
      ${body}
      module.exports = Object.fromEntries([[${JSON.stringify(name)}, Icon]]);`
      : `import { createElement } from ${JSON.stringify(pathToFileURL(reactPath).href)};
      ${body}
      export { Icon as ${name} };`,
  );
};

test.each([
  ['2.0.314', 'lib-cjs/atoms/svg/add.js'],
  ['2.0.336', 'lib-cjs/atoms/svg/add.cjs'],
])(
  'reads Fluent %s from the importing project for SVG subpaths',
  async (version, filename) => {
    const baseDir = path.join(fixtureRoot, version);
    const importerDir = path.join(baseDir, 'nested');
    const parentVersion = version === '2.0.314' ? '2.0.336' : '2.0.314';
    writePackage(
      baseDir,
      '@fluentui/react-icons',
      parentVersion,
      `lib-cjs/atoms/svg/add.${parentVersion === '2.0.336' ? 'cjs' : 'js'}`,
      'Add24Regular',
      true,
    );
    writePackage(
      importerDir,
      '@fluentui/react-icons',
      version,
      filename,
      'Add24Regular',
      true,
    );
    const icon = await renderIcon(
      '@fluentui/react-icons/svg/add',
      'Add24Regular',
      {
        baseDir,
        importer: path.join(importerDir, 'entry.tsx'),
      },
    );
    expect(icon.symbolBody).toContain(`data-version="${version}"`);
  },
);

test('renders a default Hugeicons subpath through an older named-export bundle', async () => {
  const baseDir = path.join(fixtureRoot, 'hugeicons');
  writePackage(
    baseDir,
    '@hugeicons/core-free-icons',
    '1.0.4',
    'dist/esm/index.js',
    'GlobalSearchIcon',
  );
  writeFileSync(
    path.join(
      baseDir,
      'node_modules/@hugeicons/core-free-icons/dist/esm/index.js',
    ),
    `export const GlobalSearchIcon = [['path', { d: 'M0 0h24v24z', 'data-version': '1.0.4' }]];`,
  );
  const icon = await renderIcon(
    '@hugeicons/core-free-icons/GlobalSearchIcon',
    'default',
    { baseDir },
  );
  expect(icon.symbolBody).toContain('data-version="1.0.4"');
});

test('keeps an explicit import path independent of built-in version rules', async () => {
  const baseDir = path.join(fixtureRoot, 'override');
  writePackage(
    baseDir,
    '@tabler/icons-react',
    '2.0.0',
    'custom.mjs',
    'IconAlertCircle',
  );
  const icon = await renderIcon('@tabler/icons-react', 'IconAlertCircle', {
    baseDir,
    importPath: '@tabler/icons-react/custom.mjs',
  });
  expect(icon.symbolBody).toContain('<path');
});

test.each([
  ['custom-icons', '1.0.0', false],
  ['@mui/icons-material', '9.0.1', false],
  ['@ant-design/icons', '6.3.4', true],
])(
  'preserves the real default export of %s subpaths',
  async (pack, version, commonJS) => {
    const baseDir = path.join(fixtureRoot, 'default', pack);
    const filename =
      pack === '@ant-design/icons' ? 'lib/icons/Alarm.js' : 'Alarm.js';
    writePackage(baseDir, pack, version, filename, 'default', commonJS);
    const modulePath = path.join(baseDir, 'node_modules', pack, filename);
    const source = commonJS
      ? `module.exports.Alarm = () => { throw new Error('Named export selected'); };`
      : `export function Alarm() { throw new Error('Named export selected'); }`;
    writeFileSync(modulePath, `${readFileSync(modulePath, 'utf8')}\n${source}`);
    const icon = await renderIcon(`${pack}/Alarm`, 'default', { baseDir });
    expect(icon.symbolBody).toContain(`data-version="${version}"`);
  },
);

test('uses baseDir when the importer has no icon package installed', async () => {
  const baseDir = path.join(fixtureRoot, 'base-dir');
  writePackage(
    baseDir,
    '@tabler/icons-react',
    '2.1.0',
    'dist/esm/icons/IconAlertCircle.js',
    'IconAlertCircle',
  );
  const icon = await renderIcon('@tabler/icons-react', 'IconAlertCircle', {
    baseDir,
    importer: path.join(fixtureRoot, 'other-project/entry.tsx'),
  });
  expect(icon.symbolBody).toContain('data-version="2.1.0"');
});

test('resolves files from the same package root used to read the version', async () => {
  const baseDir = path.join(fixtureRoot, 'package-root');
  const pack = '@fluentui/react-icons';
  const filename = 'lib-cjs/atoms/svg/add.cjs';
  writePackage(baseDir, pack, '2.0.336', filename, 'Add24Regular', true);
  writePackage(
    path.join(baseDir, 'node_modules', pack),
    pack,
    '2.0.337',
    filename,
    'Add24Regular',
    true,
  );
  const icon = await renderIcon(pack, 'Add24Regular', { baseDir });
  expect(icon.symbolBody).toContain('data-version="2.0.336"');
});

test.each(['exact', 'wildcard'])(
  'honors %s package export targets when resolving versioned icons',
  async (kind) => {
    const baseDir = path.join(fixtureRoot, 'exports', kind);
    const pack = '@hugeicons/core-free-icons';
    const filename = `dist/esm/icons/${kind === 'exact' ? 'CanonicalIcon' : 'AliasIcon'}.js`;
    writePackage(baseDir, pack, '4.3.5', filename, 'default');
    const root = path.join(baseDir, 'node_modules', pack);
    const manifestPath = path.join(root, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.exports = {
      [kind === 'exact' ? './AliasIcon' : './*']: {
        import: kind === 'exact' ? `./${filename}` : './dist/esm/icons/*.js',
        require: './missing.cjs',
      },
    };
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const icon = await renderIcon(pack, 'AliasIcon', { baseDir });
    expect(icon.symbolBody).toContain('data-version="4.3.5"');
  },
);
