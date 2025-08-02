import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CopyWebpackPlugin = require('copy-webpack-plugin');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

export const rendererConfig: Configuration = {
  target: 'electron-renderer',
  module: {
    rules,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: 'public', to: 'public' }],
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
