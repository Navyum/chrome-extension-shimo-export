---
description: 构建和测试规则
globs: ["webpack.config.js", "package.json"]
---

# 构建规则

- 修改代码后运行 `npm run build` 验证构建是否通过
- 不要修改构建产物（dist/、.build-temp/、build/）
- webpack 输出不压缩，保持可读性
- 新增文件需在 webpack.config.js 的 CopyWebpackPlugin 中配置复制规则
- 三个浏览器的 manifest 需保持功能一致，仅 API 格式差异
