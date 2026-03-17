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

const resolvers: Record<string, ImportResolver> = {
  'lucide-react': (_pack, name) =>
    `lucide-react/dist/esm/icons/${kebabCase(name)}.js`,
  '@tabler/icons-react': (_pack, name) =>
    `@tabler/icons-react/dist/esm/icons/${name}.mjs`,
};

export const resolveIconImport = (pack: string, exportName: string): string => {
  return resolvers[pack]?.(pack, exportName) ?? pack;
};
