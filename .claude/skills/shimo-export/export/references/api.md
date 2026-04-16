# 导出 API 参考

## 通用说明

**Base URL**: `https://shimo.im`

**必需请求头**（与文件管理模块相同）：

| 请求头 | 值 |
|-------|---|
| `Referer` | `https://shimo.im/desktop` |
| `Accept` | `application/nd.shimo.v2+json, text/plain, */*` |
| `X-Requested-With` | `SOS 2.0` |
| `Cookie` | `shimo_sid={value}` |
| `User-Agent` | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36` |

---

## 1. GET /lizard-api/office-gw/files/export

发起文件导出任务，返回任务 ID 用于后续轮询。

**请求**：
```
GET https://shimo.im/lizard-api/office-gw/files/export?fileGuid={fileGuid}&type={format}
```

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fileGuid` | string | 是 | 目标文件的唯一标识 (guid) |
| `type` | string | 是 | 导出格式 |

**type 可选值**：

| 值 | 说明 | 适用文档类型 |
|---|------|------------|
| `md` | Markdown | newdoc |
| `pdf` | PDF | newdoc, modoc, presentation |
| `docx` | Word 文档 | newdoc, modoc |
| `wps` | WPS 文档 | modoc |
| `jpg` | 图片 | newdoc, mindmap |
| `xlsx` | Excel 表格 | mosheet |
| `pptx` | PowerPoint | presentation |
| `xmind` | XMind 思维导图 | mindmap |

**成功响应** (200)：
```json
{
  "taskId": "export_task_abc123def456"
}
```

**错误响应**：

| 状态码 | 场景 | 说明 |
|-------|------|------|
| `400` | 参数错误 | fileGuid 或 type 无效 |
| `401` | 未授权 | cookie 过期 |
| `403` | 禁止 | 无权导出该文件 |
| `404` | 不存在 | 文件已被删除 |
| `429` | 限流 | 请求过于频繁 |

**注意事项**：
- 即使 `type` 对当前文档类型不支持，API 可能仍然返回 200 和 taskId，但后续轮询时会失败
- 建议在调用前先根据导出支持矩阵验证格式兼容性

---

## 2. GET /lizard-api/office-gw/files/export/progress

查询导出任务的完成状态和下载链接。

**请求**：
```
GET https://shimo.im/lizard-api/office-gw/files/export/progress?taskId={taskId}
```

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | 是 | 导出任务的 ID，来自发起导出的响应 |

**成功响应 — 导出完成** (200)：
```json
{
  "status": 0,
  "data": {
    "downloadUrl": "https://uploader.shimo.im/f/xxxxx/会议纪要.md"
  }
}
```

**成功响应 — 仍在处理** (200)：
```json
{
  "status": 1,
  "data": {}
}
```

**响应字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | number | 0 = 完成，其他值 = 处理中 |
| `data.downloadUrl` | string | 下载链接（仅 status=0 时存在） |

**判断导出完成的条件**：
```
status === 0 AND data.downloadUrl 存在且不为空
```

任何不满足以上条件的响应都表示导出仍在进行中。

**轮询策略**：

使用指数退避避免频繁请求：

```
等待时间 = min(1000ms × 2^attempt, 16000ms) + random(0ms, 1000ms)

尝试 0: ~1000-2000ms
尝试 1: ~2000-3000ms
尝试 2: ~4000-5000ms
尝试 3: ~8000-9000ms
尝试 4: ~16000-17000ms (上限)
```

最大尝试次数：**5 次**

超过 5 次仍未完成：放弃该文件，标记为导出超时。

**错误响应**：

| 状态码 | 场景 | 处理 |
|-------|------|------|
| `429` | 限流 | 立即中止该文件的轮询 |
| `401` | 未授权 | 中止所有操作，触发重新认证 |
| 其他非 200 | 服务异常 | 抛出错误 |

---

## 下载文件

导出完成后，`downloadUrl` 是一个临时的直接下载链接，**无需额外认证头**。

```bash
curl -sL -o "output_filename.md" "https://uploader.shimo.im/f/xxxxx/xxx.md"
```

**特性**：
- **下载链接是 302 重定向**，必须使用 `curl -L` 或 `fetch({ redirect: 'follow' })` 跟随重定向
- 下载链接是临时的，有效期有限（通常数分钟）
- 无需携带 Cookie 或其他认证头
- 文件内容即为最终导出结果

---

## 完整导出流程时序图

```
Agent                        Shimo API
  |                              |
  |-- GET /export?fileGuid&type -->|
  |<-- { taskId } ------------------|
  |                              |
  |-- GET /progress?taskId ------->|
  |<-- { status: 1 } -------------|  (仍在处理)
  |                              |
  |   [等待: 指数退避]            |
  |                              |
  |-- GET /progress?taskId ------->|
  |<-- { status: 0, downloadUrl } |  (导出完成)
  |                              |
  |-- GET downloadUrl ------------>|
  |<-- [文件内容] ----------------|
  |                              |
  |   [等待 3-5 秒]              |
  |   [处理下一个文件...]        |
```
