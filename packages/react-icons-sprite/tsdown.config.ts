import { defineConfig, type UserConfig } from 'tsdown';

const iconPeerDependencies = [
  '@ant-design/icons',
  '@carbon/icons-react',
  '@fluentui/react-icons',
  '@fortawesome/free-solid-svg-icons',
  '@fortawesome/react-fontawesome',
  '@heroicons/react',
  '@hugeicons/core-free-icons',
  '@hugeicons/react',
  '@mui/icons-material',
  '@phosphor-icons/react',
  '@primer/octicons-react',
  '@radix-ui/react-icons',
  '@remixicon/react',
  '@tabler/icons-react',
  'devicons-react',
  'grommet-icons',
  'lucide-react',
  'phosphor-react',
  'react-bootstrap-icons',
  'react-feather',
  'react-icons',
];

const tsdownConfig: UserConfig = defineConfig({
  target: 'esnext',
  entry: [
    'src/index.ts',
    'src/vite/plugin.ts',
    'src/webpack/plugin.ts',
    'src/webpack/loader.ts',
    'src/icon.tsx',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  copy: [
    { from: '../../README.md', to: '.' },
    { from: '../../LICENSE.md', to: '.' },
  ],
  deps: {
    neverBundle: [
      ...iconPeerDependencies,
      'react',
      'react-dom',
      'react-dom/server',
      'webpack',
      'vite',
    ],
  },
});

export default tsdownConfig;
