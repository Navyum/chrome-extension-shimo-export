---
name: shimo-export/auth
description: |
  石墨文档认证管理模块 — 提供两种认证方式（浏览器代理登录、手动粘贴 cookie）和凭证生命周期管理。
  当用户需要登录石墨、凭证过期、认证失败、或首次使用时使用此模块。
---

# auth — 认证管理

此模块负责石墨文档 API 的认证凭证管理，包括获取、验证和刷新凭证。

## 首次使用引导

当凭证不存在或失效时，**Agent 应直接运行 `browser-login.cjs` 启动登录流程**，不要让用户手动执行任何命令。

**Agent 判断逻辑**：
1. 检查 `config/env.json` 中是否存在 `shimo_sid`，或尝试调用 API 验证凭证
2. 如果凭证有效，跳过引导，直接执行用户请求
3. 如果凭证无效或不存在，**直接运行** `node <skill-path>/auth/scripts/browser-login.cjs`（Bash timeout 设为 300000ms），并告知用户"正在打开浏览器，请在浏览器中完成石墨登录"
4. 登录成功后继续执行用户原始请求

## 方式 1 — 浏览器代理登录（推荐）

最简单的登录方式，无需安装任何额外工具，无需手动复制粘贴。脚本启动本地反向代理服务器，将石墨登录页代理到 localhost，用户直接在代理页面完成登录，脚本自动从 `Set-Cookie` 响应头拦截 `shimo_sid` 并保存。

```bash
node <skill-path>/auth/scripts/browser-login.cjs
```

**流程说明**：
1. 启动本地反向代理服务器（端口 18927），代理 `shimo.im` 的所有请求
2. 自动打开用户默认浏览器访问 `http://localhost:18927/login`
3. 用户在代理页面上正常登录（扫码/短信/密码均可）
4. 脚本自动拦截登录成功后 `Set-Cookie` 中的 `shimo_sid`
5. 验证凭证有效性（只有验证通过才保存），保存到 `config/env.json`
6. 显示成功页面，自动关闭服务器

**无任何外部依赖**，仅使用 Node.js 内置模块（http、https、fs、path）。

**Agent 处理流程**：
- Agent 直接运行 `node <skill-path>/auth/scripts/browser-login.cjs`（Bash timeout 设为 300000ms）
- 告知用户"正在打开浏览器，请在浏览器中完成石墨登录"
- 脚本自动打开浏览器、代理登录页、拦截凭证、验证并保存
- 完成后继续执行用户原始请求
- **禁止让用户手动运行任何命令**

## 方式 2 — 手动粘贴

不依赖任何工具。适合用户已经从浏览器中获取了 cookie 的情况。

**Agent 处理流程**：
1. 询问用户粘贴 cookie 值
2. 用户可能粘贴以下任一格式：
   - 完整的 `shimo_sid=s%3Axxxxxxxx.xxxxxxxx` 格式
   - 只有值部分 `s%3Axxxxxxxx.xxxxxxxx`
   - 只有 shimo_sid 的值
3. Agent 提取纯值部分（去掉 `shimo_sid=` 前缀，去掉首尾空白）
4. 保存到 `<skill-path>/config/env.json` 的 `shimo_sid` 字段：

```json
{
  "shimo_sid": "<提取的值>"
}
```

5. 运行预检验证：

```bash
node <skill-path>/auth/scripts/preflight-check.cjs
```

**获取 cookie 的指引**（如果用户需要）：
1. 在浏览器中打开 https://shimo.im 并确保已登录
2. 打开 DevTools (F12) → Application → Cookies → `https://shimo.im`
3. 找到 `shimo_sid`，复制其 Value

## 凭证验证

使用预检脚本验证凭证有效性：

```bash
node <skill-path>/auth/scripts/preflight-check.cjs
```

**验证逻辑**：
1. 按优先级加载凭证：环境变量 `SHIMO_COOKIE` → `config/env.json` 的 `shimo_sid` 字段
2. 调用 `GET https://shimo.im/lizard-api/users/me`
3. 成功：输出用户 ID、姓名、邮箱，exit 0
4. 失败：输出诊断信息，exit 1

## 凭证刷新

当 API 返回 **HTTP 401** 时，凭证已过期。Agent 处理流程：

```
1. 检测到 401
2. 通知用户凭证过期，询问登录方式（同首次使用引导）
3. 登录成功后重试之前的操作
```

## 脚本一览

| 脚本 | 用法 | 功能 |
|------|------|------|
| `browser-login.cjs` | `node browser-login.cjs` | 启动本地反向代理引导浏览器登录（推荐） |
| `preflight-check.cjs` | `node preflight-check.cjs` | 验证凭证有效性 |

## 配置文件

所有凭证统一存储在 `<skill-path>/config/env.json`：

```json
{
  "shimo_sid": "cookie值"
}
```

- 浏览器代理登录脚本会自动写入 `shimo_sid` 字段
- 手动粘贴 cookie 时，Agent 只需更新 `shimo_sid` 字段

## 安全说明

- `shimo_sid` 是会话级 cookie，包含完整的用户认证信息
- **不要**在对话或日志中输出完整的 cookie 值
- **不要**将凭证发送到 shimo.im 以外的任何域名
