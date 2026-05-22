import { defineConfig, type UserConfig } from 'tsdown';

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
  deps: {
    neverBundle: ['react', 'react-dom/server', 'webpack', 'vite'],
  },
});

export default tsdownConfig;
