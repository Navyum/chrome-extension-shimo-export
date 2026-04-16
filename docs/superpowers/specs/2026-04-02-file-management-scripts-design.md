# file-management 脚本化设计

## 目标

将 file-management 模块的 curl 模板改为独立的 Node.js 原子脚本，让 AI agent 直接调用脚本而非拼接 bash 命令。

## 新增脚本

### search.cjs

- 用法：`node search.cjs <keyword> [--size N] [--type fileType] [--full-text]`
- 功能：调用 `POST /lizard-api/search_v2/files` 搜索文件
- 输出（stdout）：JSON 数组 `[{guid, name, type, path, updatedAt, createdAt, user}]`
- `path` 由 ancestors 拼接而成
- `--full-text` 时 searchFields 为空（全文搜索），默认仅搜文件名

### list-files.cjs

- 用法：`node list-files.cjs [folder-guid]`
- 功能：调用 `GET /lizard-api/files[?folder=guid]` 列出文件
- 无参数时列出个人空间根目录
- 输出（stdout）：JSON 数组 `[{guid, name, type, createdAt, updatedAt}]`

### list-spaces.cjs

- 用法：`node list-spaces.cjs`
- 功能：获取所有团队空间（普通 + 置顶，分页合并去重）
- 输出（stdout）：JSON 数组 `[{guid, name, membersCount}]`

## 共同规范

- 风格与 export-helper.cjs / preflight-check.cjs 一致
- 自包含：每个脚本独立加载 cookie，无共享模块
- JSON 结果到 stdout，状态信息到 stderr
- 退出码：0 成功，1 失败
- 失败时 stdout 输出 `{"error": "message"}`
- 5 个必需 headers 硬编码

## SKILL.md 改动

- file-management/SKILL.md：主要调用方式改为脚本，curl 模板保留在 references/api.md
- 根 SKILL.md：去掉 `shimo_api()` / `shimo_search()` 辅助函数模板，改为指向脚本
