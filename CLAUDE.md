# 石墨文档导出 Chrome 扩展

## 项目概述

Chrome/Firefox/Edge 跨浏览器扩展，用于从石墨文档 (shimo.im) 批量导出文件到本地。支持 md、docx、pdf、jpg、xlsx、pptx、xmind 等格式，保留文件夹层级结构。

## 技术栈

- **Manifest V3** Chrome Extension
- **Webpack 5** 构建（无 Babel，直接使用 modern JS）
- **原生 JavaScript**（无框架）
- 跨浏览器兼容：Chrome、Firefox、Edge

## 项目结构

```
src/
├── background.js    # Service Worker，核心导出逻辑 + 石墨 API 交互
├── browser.js       # 浏览器兼容层（Chrome/Firefox API 差异抹平）
├── popup.html/js/css  # 弹出窗口 UI
├── settings.html/js/css  # 设置页面
├── icons/           # 扩展图标
└── assets/          # 静态资源
manifest/
├── manifest-chrome.json
├── manifest-firefox.json
└── manifest-edge.json
```

## 常用命令

```bash
npm run dev          # 开发模式（watch）
npm run build        # 构建 Chrome 版本
npm run build:all    # 构建所有浏览器版本
npm run pack:all     # 构建 + 打包 zip
npm run clean        # 清理构建产物
```

## 开发规范

- 使用原生 JavaScript，不引入框架
- 代码注释使用中文
- 保持 Manifest V3 规范兼容
- background.js 运行在 Service Worker 环境
- 通过 `browser.js` 兼容层处理 Chrome/Firefox API 差异
- webpack 不压缩输出，保持可读性
- 构建产物输出到 `.build-temp/`，最终分发到 `dist/{chrome,firefox,edge}/`

## 石墨 API

- 文件列表：`/lizard-api/files`
- 团队空间：`/panda-api/file/spaces`
- 导出接口：`/lizard-api/office-gw/files/export`
- 导出进度查询：`/lizard-api/office-gw/files/export/progress`

## 注意事项

- 不要修改 `node_modules/` 或构建产物（`dist/`、`.build-temp/`、`build/`）
- manifest 版本号以 `manifest/manifest-chrome.json` 为准
- Cookie 依赖用户已登录石墨文档
