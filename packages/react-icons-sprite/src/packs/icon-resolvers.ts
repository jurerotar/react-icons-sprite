import { satisfies } from 'semver';
import { kebabCase } from '../utils/kebab-case';

export const DEFAULT_ICON_SOURCES: ReadonlyArray<RegExp> = [
  /^react-icons\/[\w-]+$/,
  /^@fortawesome\/[\w-]+-svg-icons$/,
  /^lucide-react$/,
  /^@heroicons\/react(?:\/.*)?$/,
  /^@tabler\/icons-react$/,
  /^@radix-ui\/react-icons$/,
  /^phosphor-react$/,
  /^@phosphor-icons\/react$/,
  /^react-feather$/,
  /^react-bootstrap-icons$/,
  /^grommet-icons$/,
  /^@remixicon\/react$/,
  /^devicons-react$/,
  /^@mui\/icons-material(?:\/.*)?$/,
  /^@carbon\/icons-react$/,
  /^@ant-design\/icons(?:\/.*)?$/,
  /^@fluentui\/react-icons(?:\/svg\/[\w-]+)?$/,
  /^@primer\/octicons-react$/,
  /^@hugeicons\/core-free-icons(?:\/.*)?$/,
  /^@pillage-first\/graphics$/,
];

type ImportResolver = (pack: string, exportName: string) => string;

type VersionedImportResolver = {
  range: string;
  resolve: ImportResolver;
};

const phosphorIconPathName = (name: string): string =>
  name.endsWith('Icon') ? name.slice(0, -4) : name;

const fluentIconPathName = (name: string): string => {
  const unsizedName = name.replace(
    /(?:12|16|20|24|28|32|48)?(?:Regular|Filled|Light|Resizable|Color)$/,
    '',
  );

  return kebabCase(unsizedName);
};

const lucideIconPathName = (name: string): string =>
  kebabCase(name.replace(/^Lucide/, '').replace(/Icon$/, '')).replace(
    /([a-z])(\d)/g,
    '$1-$2',
  );

// First matching range wins; put exceptions and newer layouts first.
const exactResolvers: Record<string, ReadonlyArray<VersionedImportResolver>> = {
  'lucide-react': [
    {
      // 0.262.0?0.263.1 shipped .mjs even when their metadata said .js.
      range: '>=1.9.0 || >=0.262.0 <=0.263.1',
      resolve: (pack, name) =>
        `${pack}/dist/esm/icons/${lucideIconPathName(name)}.mjs`,
    },
    {
      range: '>=0.104.0',
      resolve: (pack, name) =>
        `${pack}/dist/esm/icons/${lucideIconPathName(name)}.js`,
    },
    {
      // Older ESM modules have extensionless imports that Node cannot load.
      range: '>=0.0.0',
      resolve: (pack) => `${pack}/dist/cjs/lucide-react.js`,
    },
  ],
  '@radix-ui/react-icons': [
    { range: '>=2.0.0-0', resolve: (pack, name) => `${pack}/dist/${name}.js` },
    { range: '>=1.0.0', resolve: (pack) => `${pack}/dist/react-icons.esm.js` },
  ],
  '@tabler/icons-react': [
    {
      range: '>=3.0.0-beta.2',
      resolve: (pack, name) => `${pack}/dist/esm/icons/${name}.mjs`,
    },
    {
      range: '>=2.1.0',
      resolve: (pack, name) => `${pack}/dist/esm/icons/${name}.js`,
    },
    {
      range: '>=2.0.0-0',
      resolve: (pack, name) =>
        `${pack}/dist/esm/icons/${kebabCase(name.replace(/^Icon/, ''))}.js`,
    },
  ],
  '@phosphor-icons/react': [
    {
      // This prerelease's ESM runtime imports files absent from its archive.
      range: '2.1.8-rc.0',
      resolve: (pack) => `${pack}/dist/index.cjs.js`,
    },
    {
      range: '>=2.1.8-rc.0',
      resolve: (pack, name) =>
        `${pack}/dist/ssr/${phosphorIconPathName(name)}.es.js`,
    },
    {
      range: '2.0.12',
      resolve: (pack, name) =>
        `${pack}/dist/csr/${phosphorIconPathName(name)}.mjs`,
    },
    {
      range: '>=2.1.3 || >=2.0.11 <2.1.0',
      resolve: (pack, name) =>
        `${pack}/dist/ssr/${phosphorIconPathName(name)}.mjs`,
    },
    {
      range: '>=2.1.0',
      resolve: (pack, name) =>
        `${pack}/dist/icons/${phosphorIconPathName(name)}.mjs`,
    },
    {
      range: '>=2.0.3',
      resolve: (pack, name) =>
        `${pack}/dist/icons/${phosphorIconPathName(name)}.es.js`,
    },
  ],
  'phosphor-react': [
    {
      range: '>=1.0.1',
      resolve: (pack, name) => `${pack}/dist/icons/${name}.esm.js`,
    },
    { range: '>=0.1.0', resolve: (pack) => `${pack}/dist/index.js` },
  ],
  'react-bootstrap-icons': [
    {
      range: '>=1.0.0-0',
      resolve: (pack, name) => `${pack}/dist/icons/${kebabCase(name)}.js`,
    },
  ],
  'react-feather': [
    {
      range: '>=1.0.2 <1.0.9 || >=1.1.0',
      resolve: (pack, name) => `${pack}/dist/icons/${kebabCase(name)}.js`,
    },
  ],
  'grommet-icons': [
    { range: '>=0.1.0', resolve: (pack, name) => `${pack}/icons/${name}.js` },
  ],
  'devicons-react': [
    {
      range:
        '1.2.3-canary-0.0.1 || 1.2.3-canary-0.0.2 || >=1.2.3-canary-0.0.5 <1.2.3 || >=1.2.4',
      resolve: (pack, name) => `${pack}/lib/icons/${name}.js`,
    },
    {
      range: '>=1.1.2 <1.1.5 || >=1.1.7 <1.2.4',
      resolve: (pack, name) => `${pack}/icons/${name}.js`,
    },
    { range: '1.0.7 || >=1.0.9 <1.1.2', resolve: (pack) => `${pack}/index.js` },
    {
      range: '>=0.1.0 <1.0.7 || 1.0.8',
      resolve: (pack) => `${pack}/dist/index.js`,
    },
  ],
  '@carbon/icons-react': [
    { range: '>=11.0.0', resolve: (pack, name) => `${pack}/lib/${name}.js` },
    { range: '>=10.4.0', resolve: (pack) => `${pack}/lib/index.js` },
  ],
  '@ant-design/icons': [
    {
      range: '>=4.0.0',
      resolve: (pack, name) =>
        `@ant-design/icons/lib/icons/${name === 'default' ? pack.split('/').at(-1) : name}.js`,
    },
  ],
  '@fluentui/react-icons': [
    {
      range: '>=2.0.336',
      resolve: (pack, name) =>
        `@fluentui/react-icons/lib-cjs/atoms/svg/${pack.split('/svg/')[1] ?? fluentIconPathName(name)}.cjs`,
    },
    {
      range: '>=2.0.314',
      resolve: (pack, name) =>
        `@fluentui/react-icons/lib-cjs/atoms/svg/${pack.split('/svg/')[1] ?? fluentIconPathName(name)}.js`,
    },
    {
      range: '>=2.0.0',
      resolve: () => '@fluentui/react-icons/lib-cjs/index.js',
    },
    {
      range: '>=1.1.110',
      resolve: (pack, name) => `${pack}/lib/esm/components/${name}.js`,
    },
    {
      range: '>=0.1.1 <1.0.0',
      resolve: (pack, name) => `${pack}/lib-commonjs/components/${name}.js`,
    },
  ],
  '@primer/octicons-react': [
    {
      range: '>=19.30.0',
      resolve: (pack, name) => `${pack}/dist/icons/${name}.mjs`,
    },
    {
      range: '>=10.0.0',
      resolve: (pack) => `${pack}/dist/index.umd.js`,
    },
  ],
  '@hugeicons/core-free-icons': [
    {
      range: '>=1.2.0',
      resolve: (pack, name) =>
        pack === '@hugeicons/core-free-icons' ? `${pack}/${name}` : pack,
    },
    {
      range: '>=1.0.4',
      resolve: () => '@hugeicons/core-free-icons/dist/esm/index.js',
    },
    {
      range: '>=1.0.0',
      resolve: (pack, name) =>
        `@hugeicons/core-free-icons/dist/${name === 'default' ? pack.split('/').at(-1) : name}.mjs`,
    },
  ],
  '@mui/icons-material': [
    {
      range: '>=5.0.0-0',
      resolve: (pack, name) =>
        pack === '@mui/icons-material' ? `${pack}/${name}` : pack,
    },
  ],
  '@heroicons/react': [
    {
      range: '>=2.0.0-0',
      resolve: (pack, name) =>
        /^@heroicons\/react\/\d{2}\/(?:outline|solid)$/.test(pack)
          ? `${pack}/${name}`
          : pack,
    },
    {
      range: '>=0.1.0',
      resolve: (pack, name) =>
        /^@heroicons\/react\/(?:outline|solid)$/.test(pack)
          ? `${pack}/${name}.js`
          : pack,
    },
  ],
  '@remixicon/react': [
    {
      range: '>=0.0.3 <4.1.0 || >=4.1.1',
      resolve: (pack) => `${pack}/index.js`,
    },
    { range: '0.0.2', resolve: (pack, name) => `${pack}/cjs/${name}.cjs` },
  ],
  '@pillage-first/graphics': [
    { range: '>=0.0.10', resolve: (pack) => `${pack}/dist/index.mjs` },
    { range: '>=0.0.0', resolve: (pack) => `${pack}/dist/index.js` },
  ],
  'react-icons': [
    { range: '>=5.0.0', resolve: (pack) => pack },
    // Older ESM entries import extensionless internal modules.
    { range: '>=3.0.0', resolve: (pack) => `${pack}/index.js` },
  ],
};

const fontAwesomeResolvers: ReadonlyArray<VersionedImportResolver> = [
  { range: '>=5.1.0-0', resolve: (pack, name) => `${pack}/${name}.js` },
];

const resolversFor = (
  pack: string,
): ReadonlyArray<VersionedImportResolver> | undefined => {
  const packageName = pack
    .split('/')
    .slice(0, pack.startsWith('@') ? 2 : 1)
    .join('/');
  return /^@fortawesome\/[\w-]+-svg-icons$/.test(packageName)
    ? fontAwesomeResolvers
    : Object.hasOwn(exactResolvers, packageName)
      ? exactResolvers[packageName]
      : undefined;
};

export const hasVersionedIconResolver = (pack: string): boolean =>
  resolversFor(pack) !== undefined;

export const resolveIconImport = (
  pack: string,
  exportName: string,
  version?: string,
): string => {
  if (!version) {
    return pack;
  }

  const resolver = resolversFor(pack)?.find(({ range }) =>
    satisfies(version, range, { includePrerelease: true }),
  );

  return resolver?.resolve(pack, exportName) ?? pack;
};
