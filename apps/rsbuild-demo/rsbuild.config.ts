import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { ReactIconsSpriteWebpackPlugin } from 'react-icons-sprite/webpack';

export default defineConfig({
  server: {
    port: 3001,
    open: true,
  },
  plugins: [pluginReact()],
  tools: {
    rspack: (config, { env }) => {
      if (env === 'production') {
        config.plugins?.push(new ReactIconsSpriteWebpackPlugin());
        config.module?.rules?.push({
          test: /\.(ts|tsx|js|jsx)$/,
          use: [
            {
              loader: 'react-icons-sprite/webpack/loader',
            },
          ],
        });
      }
    },
  },
  html: {
    template: './public/index.html',
  },
});
