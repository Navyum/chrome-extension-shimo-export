---
description: 石墨文档 API 交互规则
globs: ["src/background.js"]
---

# 石墨 API 规则

- 所有 API 请求依赖用户 Cookie 认证，不存储用户密码
- 导出是异步流程：发起导出 → 轮询进度 → 下载文件
- API 请求需处理限流（429）和认证失效（401）
- 文件类型与导出格式有对应关系，参考 EXPORT_SUPPORT_MATRIX
- 批量导出需控制并发数，避免触发石墨限流
