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
];

type ImportResolver = (pack: string, exportName: string) => string;

const exactResolvers: Record<string, ImportResolver> = {
  'lucide-react': (pack, name) =>
    `${pack}/dist/esm/icons/${kebabCase(name)}.js`,
  '@radix-ui/react-icons': (pack, name) => `${pack}/${name}`,
  '@tabler/icons-react': (pack, name) => `${pack}/dist/esm/icons/${name}.mjs`,
  '@phosphor-icons/react': (pack, name) => `${pack}/dist/ssr/${name}.es.js`,
  'phosphor-react': (pack, name) => `${pack}/dist/icons/${name}.esm.js`,
  'react-feather': (pack, name) => `${pack}/dist/icons/${kebabCase(name)}`,
  'react-bootstrap-icons': (pack, name) =>
    `${pack}/dist/icons/${kebabCase(name)}`,
  '@carbon/icons-react': (pack, name) => `${pack}/lib/${name}.js`,
};

export const resolveIconImport = (pack: string, exportName: string): string => {
  const exactResolver = exactResolvers[pack];
  if (exactResolver) {
    return exactResolver(pack, exportName);
  }

  if (/^@mui\/icons-material(?:\/.*)?$/.test(pack)) {
    return pack.split('/').length > 2 ? pack : `${pack}/${exportName}`;
  }

  if (/^@heroicons\/react\/(?:\d{2})\/(?:outline|solid)$/.test(pack)) {
    return `${pack}/${exportName}`;
  }

  if (/^@fortawesome\/[\w-]+-svg-icons$/.test(pack)) {
    return `${pack}/${exportName}`;
  }

  return pack;
};
