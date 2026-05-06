---
description: 代码风格和编码规范
globs: ["src/**/*.js"]
---

# 代码风格规则

- 使用原生 JavaScript，禁止引入 React/Vue 等框架
- 使用 const/let，禁止 var
- 异步操作使用 async/await，避免回调地狱
- 注释使用中文
- 函数命名使用 camelCase
- 常量命名使用 UPPER_SNAKE_CASE
- Chrome Extension API 通过 browser.js 兼容层调用，不直接使用 chrome.* 或 browser.*
