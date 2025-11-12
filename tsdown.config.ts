import { defineConfig, type UserConfig } from 'tsdown';

const tsdownConfig: UserConfig = defineConfig({
  target: 'esnext',
  entry: [
    'src/vite/plugin.ts',
    'src/webpack/plugin.ts',
    'src/webpack/loader.ts',
    'src/icon.tsx',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  external: [
    'react',
    'react-dom/server',
    '@babel/generator',
    '@babel/parser',
    '@babel/traverse',
    '@babel/types',
    'webpack',
  ],
});

export default tsdownConfig;
