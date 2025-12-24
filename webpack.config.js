const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  entry: {
    background: './background.js',
    popup: './popup.js',
    settings: './settings.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  // 不需要 babel，Chrome 扩展支持现代 JavaScript
  plugins: [
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'popup.html', to: 'popup.html' },
        { from: 'popup.css', to: 'popup.css' },
        { from: 'settings.html', to: 'settings.html' },
        { from: 'settings.css', to: 'settings.css' },
        { from: 'icons', to: 'icons' },
        { from: 'assets', to: 'assets' }
      ]
    })
  ],
  resolve: {
    extensions: ['.js']
  },
  optimization: {
    minimize: false // Chrome 扩展不需要压缩，保持可读性
  }
};

