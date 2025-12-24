# 石墨文档导出工具 - 多浏览器支持版

一个强大的浏览器扩展程序，用于从石墨文档批量导出文件到本地，支持多种格式导出，完整保留原始文件夹结构。现已支持 Chrome、Firefox 和 Edge 浏览器。

## ✨ 功能特性

### 🚀 核心功能
- ✅ **跨浏览器支持** - 同时支持 Chrome, Firefox, Edge
- ✅ **自动认证** - 自动获取用户登录状态，无需手动复制 Token
- ✅ **批量导出** - 一键导出所有文件，支持递归获取子文件夹
- ✅ **团队空间** - 支持团队空间文档的扫描与导出
- ✅ **多格式支持** - 支持 Markdown、PDF、Word、图片等多种格式
- ✅ **文件夹结构** - 完整保留原始的文件夹层级结构
- ✅ **智能命名** - 自动处理文件名中的特殊字符，支持追加文件时间戳

### 🎛️ 用户体验
- ✅ **实时进度** - 显示导出进度条和详细日志
- ✅ **暂停/继续** - 支持随时暂停和恢复导出任务
- ✅ **失败重试** - 自动记录失败文件，支持单独重试
- ✅ **性能监控** - 查看详细的下载记录、导出 URL 以及耗时指标

## 🛠️ 安装方法

### 1. 从 GitHub Releases 下载（推荐）
1. 访问 [Releases](https://github.com/Navyum/chrome-extension-shimo-export/releases) 页面。
2. 根据您的浏览器下载对应的压缩包：
   - Chrome: `shimo-export-chrome.zip`
   - Firefox: `shimo-export-firefox.zip`
   - Edge: `shimo-export-edge.zip`
3. 解压下载的压缩包。
4. **加载扩展**：
   - **Chrome/Edge**: 进入 `chrome://extensions/`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择解压后的目录。
   - **Firefox**: 进入 `about:debugging#/runtime/this-firefox`，点击“临时载入附加组件”，选择解压目录中的 `manifest.json`。

### 2. 源码编译安装
如果您想基于源码自行构建：
```bash
git clone https://github.com/Navyum/chrome-extension-shimo-export.git
cd chrome-extension-shimo-export
npm install
npm run pack:all
```
构建后的安装包将生成在 `build/` 目录下。

## 📖 使用指南

1. **准备工作**：确保已登录 [石墨文档](https://shimo.im)。
2. **扫描文件**：点击“获取文件信息”，插件会自动扫描您的个人空间和团队空间。
3. **开始导出**：选择导出格式，点击“开始导出”。
4. **性能查看**：在“设置 -> 性能监控”中可以查看每个文件的详细导出参数。

## 🔧 技术架构

### 核心技术
- **Manifest V3** - 统一使用最新的扩展规范
- **Browser API Layer** - 自研 `browser.js` 兼容层，抹平 Chrome (Callback) 与 Firefox (Promise) 的机制差异
- **Webpack** - 模块化构建，优化资源打包
- **GitHub Actions** - 自动化构建与多平台发布流程

### 项目结构
```
├── src/                   # 源代码目录
│   ├── assets/            # 静态资源
│   ├── icons/             # 图标资源
│   ├── browser.js         # 跨浏览器兼容核心逻辑
│   ├── background.js      # 后台 Service Worker / Background Script
│   └── popup/ settings/   # UI 页面及其逻辑
├── manifest/              # 各浏览器特定的配置文件
├── webpack.config.js      # 构建配置
└── build/                 # 自动打包输出目录
```

## 📝 更新日志

### v1.0.5 (2025-12-24)
- ✨ **重大更新**：实现全平台多浏览器支持 (Chrome, Firefox, Edge)
- ✨ **重大更新**：支持团队空间文档导出
- 🏗️ **工程化改造**：引入 Webpack 构建系统，支持 `npm run pack:all` 一键打包
- 🛠️ **兼容性增强**：自研 `browser.js` 抽象层，完美解决 Firefox V3 异步机制与 Chrome 的差异
- 📊 **监控升级**：性能监控页面现在可以查看真实的 Export URL 和 Download URL

## 📄 许可证

本项目仅用于学习交流和个人使用，请勿用于商业用途。如存在侵权行为，请联系删除。

---
**注意**：使用本工具时请遵守石墨文档的使用条款，仅用于合法的个人用途。
