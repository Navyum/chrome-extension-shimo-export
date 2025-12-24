const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.js',
    popup: './src/popup.js',
    settings: './src/settings.js'
    // browser.js 不作为入口点，而是作为原始文件被复制，供 importScripts 使用
  },
  output: {
    path: path.resolve(__dirname, '.build-temp'),
    filename: '[name].js',
    clean: true
  },
  // 不需要 babel，Chrome 扩展支持 modern JavaScript
  plugins: [
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/popup.html', to: 'popup.html' },
        { from: 'src/popup.css', to: 'popup.css' },
        { from: 'src/settings.html', to: 'settings.html' },
        { from: 'src/settings.css', to: 'settings.css' },
        { from: 'src/browser.js', to: 'browser.js' },
        { from: 'src/icons', to: 'icons', noErrorOnMissing: true },
        { from: 'src/assets', to: 'assets', noErrorOnMissing: true }
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

