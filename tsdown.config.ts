import { defineConfig } from 'tsdown';

export default defineConfig({
  target: 'esnext',
  entry: ['src/vite/plugin.ts', 'src/icon.tsx'],
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
  ],
});
