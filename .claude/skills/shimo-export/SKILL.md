---
name: shimo-export
description: |
  石墨文档导出 AI Skill — 通过 AI Agent 与石墨文档 (shimo.im) API 交互，
  实现自动登录、文件列表浏览、团队空间扫描、批量导出（支持 Markdown、PDF、Word、Excel、PPT、XMind、图片等格式）。
  当用户提到石墨文档、导出文件、下载文档、批量导出、团队空间、文件列表时，使用此 skill。
  即使用户没有明确说"石墨"，只要意图涉及从 shimo.im 导出或浏览文档，也应触发此 skill。

  Shimo Document Export AI Skill — Enables AI agents to interact with shimo.im API
  for automated login, file browsing, team space scanning, and batch export in multiple
  formats (md, pdf, docx, xlsx, pptx, xmind, jpg).
homepage: https://github.com/Navyum/chrome-extension-shimo-export
metadata:
  openclaw:
    emoji: '📄'
    requires: { env: ['SHIMO_COOKIE'] }
    primaryEnv: 'SHIMO_COOKIE'
  security:
    credentials_usage: |
      This skill uses a shimo_sid session cookie for authentication against shimo.im APIs.
      The cookie can be obtained automatically via browser QR code login (Playwright),
      or manually from an active browser session.
      Credentials are ONLY sent to shimo.im as HTTP Cookie headers.
      NEVER log, display, or transmit the full cookie value to any other destination.
    allowed_domains:
      - shimo.im
---

# shimo-export

统一的石墨文档导出 AI Skill。当前支持三个模块：**auth**（认证管理）、**file-management**（文件浏览）、**export**（导出下载）。

## 输出行为规范（最高优先级）

**你是一个安静高效的助手，不是一个解说员。**

- **禁止输出中间过程**：不要说"先验证凭证"、"正在搜索"、"接下来导出"等步骤解说。直接执行，只在最终呈现结果。
- **禁止暴露命令**：用户不应看到任何 curl、bash、node 命令或技术细节。
- **禁止多余寒暄**：不要说"让我帮你…"、"好的，我来…"。直接做事。
- **只输出结果**：执行完所有步骤后，用一句自然语言告知结果。例如：
  - ✅ `已将「思维模式」下载到 abc/思维模式.md`
  - ✅ `找到 3 个匹配文件：…`
  - ❌ ~~`先验证凭证，然后搜索文件。`~~
  - ❌ ~~`正在调用搜索 API…`~~
- **出错时自动处理**：如凭证失效，Agent 应直接运行 `browser-login.cjs` 启动登录流程，告知用户"正在打开浏览器，请完成登录"，而不是让用户手动运行命令。
- **多步操作合并执行**：搜索+导出等复合任务，优先使用 `batch-export.cjs` 一条命令完成。
- **每次执行后总结结果**：脚本输出的 JSON 是给 Agent 解析的，Agent 必须将 JSON 转为用户友好的自然语言总结。格式示例：
  - 搜索：`找到 N 篇匹配文档：` + 表格（名称、类型、路径）
  - 单文件导出：`已将「文档名」导出为 xxx 格式，保存到 path`
  - 批量导出：`共导出 N 篇文档到 path 目录（M 成功，K 失败）` + 成功/失败明细表
  - 列出文件：`根目录下共 N 个项目：` + 表格（名称、类型）
  - 登录：`已登录石墨，用户：xxx`


## Setup

> **安全说明：** 此 skill 仅与 **石墨文档官方 API** (`shimo.im`) 通信。凭证仅作为 HTTP Cookie 发送到 `shimo.im`，不会发送到任何其他域名、文件或日志。

**首次使用或凭证失效时，Agent 应直接运行 `browser-login.cjs` 启动登录流程**，无需让用户手动执行任何命令。

Agent 处理流程：
1. 运行 `node <skill-path>/auth/scripts/browser-login.cjs`（设置 timeout 300000ms）
2. 告知用户"正在打开浏览器，请在浏览器中完成石墨登录"
3. 脚本会自动打开浏览器、代理登录页、拦截凭证、验证并保存
4. 登录成功后继续执行用户原始请求

> 浏览器代理登录无需安装任何额外工具，仅依赖 Node.js 内置模块。如果用户选择手动粘贴 shimo_sid，参见 `auth/SKILL.md`。

## 凭证预检

每次操作前，先确认凭证可用：

```bash
node <skill-path>/auth/scripts/preflight-check.cjs
```

脚本会自动从环境变量 `SHIMO_COOKIE` 或 `config/env.json` 加载凭证并验证。如果凭证无效，停止操作并提示用户按 Setup 步骤配置。

## 脚本调用方式

所有操作通过独立的 Node.js 脚本执行，每个脚本自包含（自动加载凭证、构造请求头），输出 JSON 到 stdout。

### 文件管理脚本

| 脚本 | 用法 | 功能 |
|------|------|------|
| `search.cjs` | `node <skill-path>/file-management/scripts/search.cjs <keyword> [--size N] [--type TYPE] [--full-text]` | 搜索文件 |
| `list-files.cjs` | `node <skill-path>/file-management/scripts/list-files.cjs [folder-guid]` | 列出文件/文件夹 |
| `list-spaces.cjs` | `node <skill-path>/file-management/scripts/list-spaces.cjs` | 获取团队空间 |

### 导出脚本

| 脚本 | 用法 | 功能 |
|------|------|------|
| `batch-export.cjs` | `node <skill-path>/export/scripts/batch-export.cjs --keyword <关键词> --output <目录> [--format md]` | **一键批量导出**（搜索+导出） |
| `batch-export.cjs` | `node <skill-path>/export/scripts/batch-export.cjs --folder <guid> --output <目录>` | 导出文件夹下所有文件 |
| `batch-export.cjs` | `node <skill-path>/export/scripts/batch-export.cjs --all --output <目录>` | 导出根目录所有文件 |
| `export-helper.cjs` | `node <skill-path>/export/scripts/export-helper.cjs <fileGuid> <format> [outputDir] [--name "名称"]` | 导出单个文件 |

### 认证脚本

| 脚本 | 用法 | 功能 |
|------|------|------|
| `browser-login.cjs` | `node <skill-path>/auth/scripts/browser-login.cjs` | 启动本地反向代理引导浏览器登录（推荐） |
| `preflight-check.cjs` | `node <skill-path>/auth/scripts/preflight-check.cjs` | 验证凭证有效性 |

> **API 参考**：如需直接使用 HTTP API（如 curl），请参考各模块的 `references/api.md`。所有请求必须携带 5 个 headers（Referer、Accept、X-Requested-With、Cookie、User-Agent），缺一不可。

## 导出支持矩阵

| 文档类型 | API type 值 | 支持格式 | 默认格式 |
|---------|------------|---------|---------|
| 新版文档 | `newdoc` | md, jpg, docx, pdf | md |
| 传统文档 | `modoc` | docx, wps, pdf | docx |
| 表格 | `mosheet` | xlsx | xlsx |
| 幻灯片 | `presentation` | pptx, pdf | pptx |
| 思维导图 | `mindmap` | xmind, jpg | xmind |
| 表单/白板/画板 | `table`, `board`, `form` | **不支持导出** | — |

**类型映射规则**（API 返回的 type 可能有变体）：
- `ppt` / `pptx` → `presentation`
- `sheet` → `mosheet`
- 包含 `doc` → `newdoc`（兜底）
- 包含 `mind` → `mindmap`（兜底）

## 用户引导（Agent 必读）

当用户意图不够明确时，Agent 应主动引导用户补充信息。以下是常见场景和引导方式：

### 批量导出引导

当用户说"导出文档"、"下载文件"等模糊意图时，Agent 应询问：

1. **导出范围** — "请问要导出哪些文档？可以告诉我：
   - 关键词（如 redis、设计文档）
   - 文件夹名称
   - 或者「全部导出」"

2. **导出目录** — 如果用户未指定目录，默认使用 `./download`，并告知用户

3. **导出格式** — 如果用户未指定格式，按文档类型自动选择默认格式（文档→md，表格→xlsx，幻灯片→pptx）

### Agent 执行策略

| 用户说的 | Agent 行为 |
|---------|-----------|
| "导出 redis 相关文档" | 直接运行 `batch-export.cjs --keyword redis --output ./download` |
| "下载所有文档到 ~/Desktop/shimo" | 运行 `batch-export.cjs --all --output ~/Desktop/shimo` |
| "把 xxx 文件夹的文件导出为 PDF" | 先搜索文件夹获取 guid，再运行 `batch-export.cjs --folder <guid> --output ./download --format pdf` |
| "导出文档" （模糊） | 询问导出范围和目录 |
| "查找 xxx 文档" | 用 `search.cjs` 搜索，展示结果，等待用户指示是否导出 |

### 关键原则

- **优先使用 `batch-export.cjs`**：搜索+导出的复合任务，一条命令完成
- **默认目录 `./download`**：用户未指定时使用此目录
- **自动选择格式**：不同文档类型自动匹配最佳格式，无需用户指定
- **导出前无需确认**：除非文件数量超过 20 个，否则直接执行
- **Bash timeout 设为 600000ms**：批量导出可能耗时较长

## 模块决策表

| 用户意图 | 模块 | 读取 |
|---------|------|------|
| 登录、扫码、认证、cookie 过期、重新登录 | auth | `auth/SKILL.md` |
| **搜索文件、查找文档**、列出文件、浏览文件夹、查看团队空间、扫描所有文件 | file-management | `file-management/SKILL.md` |
| 导出文件、下载文档、批量导出、转换格式、查看导出进度 | export | `export/SKILL.md` |

> **搜索优先原则**：当用户要查找特定文件时，优先使用搜索 API（`POST /lizard-api/search_v2/files`），比递归扫描快得多。只有在需要获取完整文件树时才使用递归扫描。

### ⚠️ 易混淆场景

| 用户说的 | 实际意图 | 正确路由 |
|---------|---------|---------|
| "帮我导出石墨文档" | 需要知道范围 | 询问关键词/文件夹，然后 `batch-export.cjs` 一键完成 |
| "下载我所有的文件" | 批量导出 | `batch-export.cjs --all --output ./download` |
| "登录失败" / "token 过期" | 凭证问题 | **auth** — 重新扫码登录 |
| "导出为 PDF" | 单文件导出（需要知道文件 ID） | 先问用户哪个文件，或用 **file-management** 查找 → **export** |
| "查看我有哪些文件" | 仅浏览，不导出 | **file-management** |
| "把表格导出为 markdown" | 格式不支持（mosheet 只支持 xlsx） | 告知用户不支持，建议 xlsx |

**核心判断规则**：

- 目标是**认证/登录**相关 → auth 模块
- 目标是**浏览/查找/列出**文件 → file-management 模块
- 目标是**导出/下载/转换**文件 → export 模块
- 批量导出等复合任务：按意图顺序依次执行（通常 auth → file-management → export）

> **多模块任务**：当用户意图涉及多个模块时，按意图顺序依次读取对应的模块文档并逐步执行。先完成前一个模块的操作，再进入下一个模块。

## 注意事项

- **速率限制**：每次导出请求之间必须间隔 **3-5 秒**（`3000 + Math.random() * 2000` ms）。不遵守会触发 HTTP 429。
- **导出轮询**：使用指数退避策略：`min(1000 * 2^attempt, 16000) + random(0, 1000)` ms，最多 5 次轮询。
- **文件名清洗**：文件名中的 `\/<>:"|?*` 字符需替换为 `_`，首尾的 `.` 需去除。
- **Cookie 有效期**：`shimo_sid` 是会话 cookie，有效期有限。任何 API 调用返回 401 时，提示用户使用方式 A 重新扫码登录。
- **下载 URL 是 302 重定向**：`downloadUrl` 返回的是重定向链接，curl 必须使用 `-L` 参数，Node.js fetch 需 `redirect: 'follow'`。链接是临时的，必须立即下载，不可缓存。
