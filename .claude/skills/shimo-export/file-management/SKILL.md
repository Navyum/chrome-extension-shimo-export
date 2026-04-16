---
name: shimo-export/file-management
description: |
  石墨文档文件管理模块 — 搜索文件、列出个人文件、浏览文件夹、获取团队空间、全量递归扫描文件树。
  当用户需要搜索文件、查找文档、查看文件列表、浏览目录结构、或为导出做准备时使用此模块。
---

# file-management — 文件浏览与扫描

此模块负责石墨文档的文件发现和浏览操作，包括个人空间和团队空间的文件列表获取。

## 前置条件

使用此模块前，必须确保凭证已配置且有效。参考根 `SKILL.md` 的凭证预检部分。

## 脚本一览

所有脚本位于 `<skill-path>/file-management/scripts/` 目录下，输出 JSON 到 stdout，状态信息到 stderr。

| 脚本 | 用法 | 功能 |
|------|------|------|
| `search.cjs` | `node search.cjs <keyword> [--size N] [--type TYPE] [--full-text]` | 按关键词搜索文件 |
| `list-files.cjs` | `node list-files.cjs [folder-guid]` | 列出根目录或指定文件夹内容 |
| `list-spaces.cjs` | `node list-spaces.cjs` | 获取所有团队空间（自动分页合并去重） |

> **搜索优先原则**：当用户要查找特定文件时，优先使用 `search.cjs`，比递归扫描快得多。

## 0. 搜索文件（推荐）

```bash
node <skill-path>/file-management/scripts/search.cjs "关键词"
```

**选项：**

| 选项 | 说明 |
|------|------|
| `--size N` | 返回结果数量，默认 15 |
| `--type TYPE` | 按文件类型筛选：`newdoc`, `modoc`, `mosheet`, `presentation`, `mindmap` |
| `--full-text` | 全文搜索（默认仅搜索文件名） |

**输出示例：**
```json
[
  {
    "guid": "g8J8GJjVkcKVyrqP",
    "name": "思维模式",
    "type": "newdoc",
    "path": "4. 读书笔记",
    "createdAt": "2021-04-15T01:53:25Z",
    "updatedAt": "2021-08-23T11:59:41Z",
    "user": "Navy"
  }
]
```

**示例：**
```bash
# 搜索文件名包含 redis 的文档
node <skill-path>/file-management/scripts/search.cjs "redis"

# 搜索表格类型文件
node <skill-path>/file-management/scripts/search.cjs "销售" --type mosheet

# 全文搜索，返回 30 条
node <skill-path>/file-management/scripts/search.cjs "API设计" --full-text --size 30
```

## 1. 列出文件

```bash
# 列出个人空间根目录
node <skill-path>/file-management/scripts/list-files.cjs

# 列出指定文件夹内容
node <skill-path>/file-management/scripts/list-files.cjs <folder-guid>
```

**输出示例：**
```json
[
  {
    "guid": "abc123",
    "name": "项目文档",
    "type": "folder",
    "createdAt": "2024-01-15T08:30:00Z",
    "updatedAt": "2024-06-20T14:22:00Z"
  }
]
```

**判断文件夹**：当 `type === "folder"` 时，该项是文件夹，可用其 `guid` 递归获取子内容。

## 2. 获取团队空间

```bash
node <skill-path>/file-management/scripts/list-spaces.cjs
```

脚本自动处理分页和合并去重（普通空间 + 置顶空间）。

**输出示例：**
```json
[
  {
    "guid": "space_001",
    "name": "产品团队",
    "membersCount": 15
  }
]
```

获取团队空间内的文件，使用空间 `guid` 作为 folder 参数：
```bash
node <skill-path>/file-management/scripts/list-files.cjs <space-guid>
```

## 3. 全量递归扫描

组合以上脚本实现完整文件树扫描：

```
1. 用 list-files.cjs 获取根目录
2. 用 list-spaces.cjs 获取所有团队空间
3. 对每个 type === "folder" 的项，用 list-files.cjs <guid> 递归
4. 对每个团队空间，用 list-files.cjs <space-guid> 获取内容并递归
5. 汇总为 flat 数组
```

**输出格式**（由 agent 组装）：
```json
{
  "id": "file_guid",
  "title": "文件名",
  "type": "newdoc",
  "folderPath": "团队空间/产品团队/子文件夹",
  "createdAt": "2024-01-15T08:30:00Z",
  "updatedAt": "2024-06-20T14:22:00Z"
}
```

## 错误处理

所有脚本在失败时输出 `{"error": "message"}` 到 stdout 并以 exit code 1 退出。

| 错误场景 | 脚本行为 | Agent 建议处理 |
|---------|---------|--------------|
| 凭证缺失/过期 | `{"error": "凭证已过期..."}` | 触发 auth 模块重新登录 |
| 文件夹不存在 | `{"error": "文件夹不存在: xxx"}` | 跳过该文件夹 |
| 网络错误 | `{"error": "..."}` | 重试一次，仍失败则跳过 |

> **注意**：递归扫描时，单个文件夹的错误不应中断整个扫描流程。记录失败的文件夹并继续处理其他内容。

## API 参考

如需直接使用 HTTP API（如 curl），请参考 `references/api.md`，其中包含所有端点的请求/响应格式和参数说明。
