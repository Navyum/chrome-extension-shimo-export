# shimo-export

> 石墨文档导出 AI Skill — 让 AI Agent 直接与石墨文档 API 交互

[![ClawHub](https://img.shields.io/badge/ClawHub-shimo--export-blue)](https://clawhub.ai)
[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-green)](https://opensource.org/license/mit-0)

## 简介

`shimo-export` 是一个 ClawHub AI Skill，使 AI Agent 能够自动化操作石墨文档 (shimo.im)，包括：

- **自动登录** — 通过浏览器扫码自动获取认证凭证
- **文件浏览** — 列出个人空间和团队空间的所有文件
- **批量导出** — 支持 Markdown、PDF、Word、Excel、PPT、XMind、图片等多种格式
- **智能路由** — 自动识别用户意图并路由到正确的操作模块

## 安装

```bash
npx clawhub@latest install shimo-export
```

## 快速开始

### 1. 登录石墨

```bash
# 自动扫码登录（推荐）
node <skill-path>/auth/scripts/browser-login.cjs

# 或手动设置
export SHIMO_COOKIE="your_shimo_sid_value"
```

### 2. 验证凭证

```bash
node <skill-path>/auth/scripts/preflight-check.cjs
```

### 3. 导出文件

```bash
# 导出单个文件
node <skill-path>/export/scripts/export-helper.cjs <fileGuid> md /tmp

# AI Agent 会自动处理文件扫描和批量导出
```

## 导出格式支持

| 文档类型 | 支持格式 |
|---------|---------|
| 新版文档 (newdoc) | md, jpg, docx, pdf |
| 传统文档 (modoc) | docx, wps, pdf |
| 表格 (mosheet) | xlsx |
| 幻灯片 (presentation) | pptx, pdf |
| 思维导图 (mindmap) | xmind, jpg |

## 模块结构

```
shimo-export/
├── SKILL.md                     # 主入口：路由决策 + 全局配置
├── auth/                        # 认证管理
│   ├── SKILL.md                 # 认证流程文档
│   └── scripts/
│       ├── browser-login.cjs    # 浏览器扫码登录
│       └── preflight-check.cjs  # 凭证预检
├── file-management/             # 文件浏览
│   ├── SKILL.md                 # 文件操作文档
│   └── references/
│       └── api.md               # 文件 API 参考
├── export/                      # 导出下载
│   ├── SKILL.md                 # 导出流程文档
│   ├── references/
│   │   └── api.md               # 导出 API 参考
│   └── scripts/
│       └── export-helper.cjs    # 导出工作流脚本
└── README.md                    # 本文件
```

## 环境要求

- **Node.js** >= 18 (使用了原生 `fetch`)
- **Playwright** (仅扫码登录需要): `npm install playwright && npx playwright install chromium`

## 凭证配置

支持三种方式（按优先级）：

1. **环境变量**: `export SHIMO_COOKIE="..."`
2. **配置文件**: `~/.config/shimo/cookie`
3. **自动登录**: 运行 `browser-login.cjs` 扫码

## 安全说明

- 凭证仅发送到 `shimo.im` 官方 API
- 不记录、不显示、不传输完整 cookie 值到其他目的地
- 配置文件权限建议设为 `600`

## 源项目

基于 [chrome-extension-shimo-export](https://github.com/Navyum/chrome-extension-shimo-export) — 石墨文档导出浏览器扩展。

## License

MIT-0
