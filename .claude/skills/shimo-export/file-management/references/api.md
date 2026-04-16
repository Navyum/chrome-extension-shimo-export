# 文件管理 API 参考

## 通用说明

**Base URL**: `https://shimo.im`

**必需请求头**（所有请求必须携带）：

| 请求头 | 值 | 说明 |
|-------|---|------|
| `Referer` | `https://shimo.im/desktop` | 防盗链检查 |
| `Accept` | `application/nd.shimo.v2+json, text/plain, */*` | 石墨自定义 MIME |
| `X-Requested-With` | `SOS 2.0` | 请求来源标识 |
| `Cookie` | `shimo_sid={value}` | 认证凭证 |
| `User-Agent` | `Mozilla/5.0 ...` | 浏览器标识 |

---

## 0. POST /lizard-api/search_v2/files

按关键词搜索文件（推荐优先使用，比递归扫描快得多）。

**请求**：
```
POST https://shimo.im/lizard-api/search_v2/files
Content-Type: application/json
```

**请求体**：
```json
{
  "keyword": "搜索词",
  "fileType": "",
  "category": "",
  "createdBy": "",
  "createdAtBegin": "",
  "createdAtEnd": "",
  "searchFields": "name",
  "desktop": false,
  "spaceGuids": [],
  "size": 15,
  "params": ""
}
```

**请求体参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 是 | 搜索关键词 |
| `fileType` | string | 否 | 文件类型筛选：`newdoc`, `modoc`, `mosheet`, `presentation`, `mindmap`，空串=全部 |
| `searchFields` | string | 否 | `name`=仅文件名搜索，空串=全文搜索 |
| `size` | number | 否 | 返回数量，默认 15 |
| `spaceGuids` | array | 否 | 限定团队空间，空数组=全部 |
| `createdBy` | string | 否 | 创建者筛选 |
| `createdAtBegin` | string | 否 | 创建时间起始 (ISO 8601) |
| `createdAtEnd` | string | 否 | 创建时间结束 (ISO 8601) |
| `desktop` | boolean | 否 | 仅桌面文件 |

**成功响应** (200)：
```json
{
  "next": "",
  "results": [
    {
      "source": {
        "id": 381999752,
        "guid": "g8J8GJjVkcKVyrqP",
        "name": "思维模式",
        "type": "newdoc",
        "userId": 55357239,
        "createdAt": "2021-04-15T01:53:25Z",
        "updatedAt": "2021-08-23T11:59:41Z",
        "ancestors": [
          { "guid": "cVJVGyJ9r3JCyCxd", "name": "4. 读书笔记", "isFolder": true }
        ],
        "user": { "id": 55357239, "name": "Navy" },
        "updatedUser": { "id": 55357239, "name": "Navy" }
      },
      "highlight": {
        "name": "<em>思维</em>模式",
        "content": ""
      }
    }
  ]
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `next` | string | 分页标记，空串=无更多结果 |
| `results[].source.guid` | string | 文件 guid，可直接用于导出 |
| `results[].source.name` | string | 文件名 |
| `results[].source.type` | string | 文件类型 |
| `results[].source.ancestors` | array | 父文件夹路径（从根到直接父级） |
| `results[].source.user` | object | 创建者 |
| `results[].highlight.name` | string | 高亮文件名，`<em>` 包裹匹配词 |

---

## 1. GET /lizard-api/users/me

获取当前登录用户信息，常用于验证凭证有效性。

**请求**：
```
GET https://shimo.im/lizard-api/users/me
```

**成功响应** (200)：
```json
{
  "id": 12345,
  "name": "张三",
  "email": "zhangsan@example.com"
}
```

**错误响应**：
- `401` — 凭证无效或已过期
- `403` — 账号被限制

---

## 2. GET /lizard-api/files

获取个人空间根目录的文件和文件夹列表。

**请求**：
```
GET https://shimo.im/lizard-api/files
```

**成功响应** (200)：
```json
[
  {
    "guid": "abc123",
    "name": "项目文档",
    "type": "folder",
    "createdAt": "2024-01-15T08:30:00Z",
    "updatedAt": "2024-06-20T14:22:00Z"
  },
  {
    "guid": "def456",
    "name": "会议纪要",
    "type": "newdoc",
    "createdAt": "2024-03-10T09:00:00Z",
    "updatedAt": "2024-03-10T10:30:00Z"
  }
]
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `guid` | string | 唯一标识，用于后续 API 调用 |
| `name` | string | 显示名称 |
| `type` | string | 文档类型，见下方类型表 |
| `createdAt` | string | 创建时间 (ISO 8601) |
| `updatedAt` | string | 最后修改时间 (ISO 8601) |

**文档类型对照表**：

| type 值 | 含义 |
|---------|------|
| `folder` | 文件夹 |
| `newdoc` | 新版文档 |
| `modoc` | 传统文档 |
| `mosheet` | 表格 |
| `presentation` | 幻灯片 |
| `mindmap` | 思维导图 |
| `table` | 应用表格（不支持导出） |
| `board` | 白板（不支持导出） |
| `form` | 表单（不支持导出） |
| `ppt` / `pptx` | 幻灯片变体（映射为 `presentation`） |
| `sheet` | 表格变体（映射为 `mosheet`） |

---

## 3. GET /lizard-api/files?folder={folderId}

获取指定文件夹下的文件和子文件夹列表。

**请求**：
```
GET https://shimo.im/lizard-api/files?folder={folderId}
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `folder` | string | 是 | 文件夹的 guid |

**响应格式**：与根目录接口相同（JSON 数组）。

---

## 4. GET /panda-api/file/spaces

获取用户所属的团队空间列表（支持分页）。

**请求**：
```
GET https://shimo.im/panda-api/file/spaces?orderBy=updatedAt
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `orderBy` | string | 否 | 排序字段，推荐 `updatedAt` |
| `cursor` | string | 否 | 分页游标，来自上一页响应的 `next` |

**成功响应** (200)：
```json
{
  "spaces": [
    {
      "guid": "space_001",
      "name": "产品团队",
      "membersCount": 15
    },
    {
      "guid": "space_002",
      "name": "研发团队",
      "membersCount": 30
    }
  ],
  "next": "/panda-api/file/spaces?orderBy=updatedAt&cursor=xxx"
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `spaces` | array | 团队空间列表 |
| `spaces[].guid` | string | 空间唯一标识，可用作 folder 参数获取空间内文件 |
| `spaces[].name` | string | 空间名称 |
| `spaces[].membersCount` | number | 成员数量 |
| `next` | string\|null | 下一页 URL（相对或绝对路径），为空表示已到最后一页 |

**分页处理**：
1. 发起首次请求
2. 检查 `next` 字段
3. 如果 `next` 不为空，拼接 base URL 后继续请求
4. 重复直到 `next` 为空

```
next 值处理规则：
  - 如果以 "http" 开头 → 直接使用
  - 否则 → 拼接 "https://shimo.im" + next
```

---

## 5. GET /panda-api/file/pinned_spaces

获取用户置顶的团队空间列表（不分页）。

**请求**：
```
GET https://shimo.im/panda-api/file/pinned_spaces
```

**成功响应** (200)：
```json
{
  "spaces": [
    {
      "guid": "space_001",
      "name": "产品团队",
      "membersCount": 15
    }
  ]
}
```

**与 /panda-api/file/spaces 的区别**：
- 此接口不分页，一次返回所有置顶空间
- 结果可能与 `/panda-api/file/spaces` 有重叠
- **必须合并去重**：以 `guid` 为唯一键，两个接口的结果合并后去重

---

## 通用错误码

| HTTP 状态码 | 含义 | 建议处理 |
|------------|------|---------|
| `200` | 成功 | 正常解析 |
| `401` | 未授权 | cookie 过期，需重新登录 |
| `403` | 禁止 | 无权访问该资源 |
| `404` | 不存在 | 文件/文件夹已被删除 |
| `429` | 限流 | 等待后重试 |
| `500` | 服务器错误 | 记录并跳过 |
