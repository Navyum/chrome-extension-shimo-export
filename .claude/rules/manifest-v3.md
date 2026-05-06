---
description: Manifest V3 开发约束
globs: ["manifest/**/*.json", "src/background.js"]
---

# Manifest V3 规则

- background 必须是 Service Worker（Chrome/Edge）或 scripts（Firefox）
- 禁止使用 Manifest V2 已废弃的 API（如 chrome.browserAction）
- 网络请求不能使用 blocking webRequest，使用 declarativeNetRequest 替代
- Service Worker 无 DOM 访问，不能使用 window/document 对象
- 持久化数据使用 chrome.storage，不能使用 localStorage
- 外部脚本不能通过 CDN 加载，必须打包到扩展内
