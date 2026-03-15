import HtmlWebpackPlugin from 'html-webpack-plugin';
import { ReactIconsSpriteWebpackPlugin } from 'react-icons-sprite/webpack';

export default {
  entry: './src/index.tsx',
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                  },
                },
              },
            },
          },
          {
            loader: 'react-icons-sprite/webpack/loader',
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new ReactIconsSpriteWebpackPlugin(),
  ],
  devServer: {
    port: 3000,
    open: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
        runtimeErrors: true,
      },
    },
  },
};
