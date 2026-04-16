---
name: shimo-export/export
description: |
  石墨文档导出模块 — 支持单文件和批量导出，三阶段导出流程（发起→轮询→下载），
  多格式支持（md, pdf, docx, xlsx, pptx, xmind, jpg），自动格式检测。
  当用户需要导出、下载、转换石墨文档时使用此模块。
---

# export — 导出与下载

此模块负责石墨文档的导出操作，实现三阶段导出流程：发起导出任务 → 轮询导出进度 → 下载导出文件。

## 前置条件

1. 凭证已配置且有效（参考 `auth/SKILL.md`）
2. 已获取目标文件的 `guid` 和 `type`（通过 `file-management` 模块或用户直接提供）

## 导出支持矩阵

| 文档类型 | API type | 支持格式 | 默认格式 |
|---------|----------|---------|---------|
| 新版文档 | `newdoc` | md, jpg, docx, pdf | md |
| 传统文档 | `modoc` | docx, wps, pdf | docx |
| 表格 | `mosheet` | xlsx | xlsx |
| 幻灯片 | `presentation` | pptx, pdf | pptx |
| 思维导图 | `mindmap` | xmind, jpg | xmind |

**不支持导出的类型**：`table`（应用表格）、`board`（白板）、`form`（表单）— 遇到这些类型直接跳过。

## 格式自动检测

当用户未指定导出格式时，按以下逻辑自动选择：

```
function getExportFormat(file, userFormat):
  fileType = file.type

  // 1. 类型映射（API 返回的 type 可能有变体）
  if fileType in ["ppt", "pptx"]: fileType = "presentation"
  if fileType == "sheet": fileType = "mosheet"

  // 2. 不支持的类型直接跳过
  if fileType in ["table", "board", "form"]: return null

  // 3. 查找支持的格式
  supportedFormats = EXPORT_MATRIX[fileType]
  if not supportedFormats:
    // 兜底映射
    if "sheet" in fileType: supportedFormats = EXPORT_MATRIX["mosheet"]
    elif "ppt" in fileType: supportedFormats = EXPORT_MATRIX["presentation"]
    elif "doc" in fileType: supportedFormats = EXPORT_MATRIX["newdoc"]
    elif "mind" in fileType: supportedFormats = EXPORT_MATRIX["mindmap"]

  if not supportedFormats: return "md"  // 最终兜底

  // 4. 格式选择
  if userFormat and userFormat in supportedFormats:
    return userFormat
  else:
    return supportedFormats[0]  // 使用默认格式
```

## 三阶段导出流程

### Phase 1: 发起导出

```bash
file_guid="xxxxxxxx"
export_format="md"
result=$(shimo_api "https://shimo.im/lizard-api/office-gw/files/export?fileGuid=$file_guid&type=$export_format")
task_id=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['taskId'])")
echo "导出任务已创建: $task_id"
```

**请求**：
```
GET https://shimo.im/lizard-api/office-gw/files/export?fileGuid={guid}&type={format}
```

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `fileGuid` | string | 文件的 guid |
| `type` | string | 导出格式：md, pdf, docx, wps, xlsx, pptx, xmind, jpg |

**成功响应** (200)：
```json
{
  "taskId": "export_task_abc123"
}
```

### Phase 2: 轮询进度

```bash
task_id="export_task_abc123"
max_attempts=5
for attempt in $(seq 0 $((max_attempts - 1))); do
  result=$(shimo_api "https://shimo.im/lizard-api/office-gw/files/export/progress?taskId=$task_id")

  # 检查 HTTP 429（限流）
  # 如果被限流，中止此文件

  download_url=$(echo "$result" | python3 -c "
import sys,json
d = json.load(sys.stdin)
if d.get('status') == 0 and d.get('data', {}).get('downloadUrl'):
    print(d['data']['downloadUrl'])
else:
    print('')
" 2>/dev/null)

  if [ -n "$download_url" ]; then
    echo "导出完成，下载链接: $download_url"
    break
  fi

  # 指数退避
  delay=$(python3 -c "import random; print(min(1000 * (2 ** $attempt), 16000) + random.random() * 1000)" 2>/dev/null)
  delay_sec=$(python3 -c "print(${delay:-2000} / 1000)")
  echo "等待 ${delay_sec}s 后重试..."
  sleep "$delay_sec"
done
```

**请求**：
```
GET https://shimo.im/lizard-api/office-gw/files/export/progress?taskId={taskId}
```

**成功响应**（导出完成）：
```json
{
  "status": 0,
  "data": {
    "downloadUrl": "https://uploader.shimo.im/xxxxx.md"
  }
}
```

**进行中响应**：
```json
{
  "status": 1,
  "data": {}
}
```

**轮询策略**：

| 尝试次数 | 等待时间 | 公式 |
|---------|---------|------|
| 第 1 次 | ~1-2 秒 | `min(1000 * 2^0, 16000) + random(0, 1000)` |
| 第 2 次 | ~2-3 秒 | `min(1000 * 2^1, 16000) + random(0, 1000)` |
| 第 3 次 | ~4-5 秒 | `min(1000 * 2^2, 16000) + random(0, 1000)` |
| 第 4 次 | ~8-9 秒 | `min(1000 * 2^3, 16000) + random(0, 1000)` |
| 第 5 次 | ~16-17 秒 | `min(1000 * 2^4, 16000) + random(0, 1000)` |

最多 5 次轮询。超过 5 次仍未完成，标记为超时失败。

### Phase 3: 下载文件

```bash
download_url="https://uploader.shimo.im/xxxxx.md"
output_dir="/tmp/shimo-export"
file_name="会议纪要.md"

mkdir -p "$output_dir"
curl -sL -o "$output_dir/$file_name" "$download_url"
echo "已下载: $output_dir/$file_name"
```

**文件命名规则**：

```
基本格式: {sanitized_title}.{export_format}
带时间戳: {sanitized_title}__{YYYY-MM-DD_HH-mm}.{export_format}
带路径:   {output_dir}/{folder_path}/{file_name}
```

**文件名清洗**：替换 `\/<>:"|?*` 为 `_`，去除首尾的 `.`

> **重要**：`downloadUrl` 是 302 重定向链接，curl 必须使用 `-L` 参数跟随重定向。链接是临时的，必须在获取后立即下载，不要缓存或延迟使用。

## 使用 export-helper 脚本

封装了完整三阶段流程的 Node.js 脚本：

```bash
node <skill-path>/export/scripts/export-helper.cjs <fileGuid> <format> [outputDir]
```

**参数**：
- `fileGuid`：文件的 guid
- `format`：导出格式（md, pdf, docx, xlsx, pptx, xmind, jpg）
- `outputDir`：输出目录（可选，默认为当前目录）

**输出**：JSON 格式的结果
```json
{
  "success": true,
  "fileGuid": "abc123",
  "format": "md",
  "downloadPath": "/tmp/shimo-export/文件名.md"
}
```

## 批量导出工作流

批量导出所有文件的完整流程：

```
1. [auth] 验证凭证有效性
   └→ 无效则触发扫码登录

2. [file-management] 全量递归扫描
   └→ 获得完整文件列表 (fileList)

3. [export] 逐文件导出
   for file in fileList:
     a. 判断导出格式（自动检测或用户指定）
     b. 跳过不支持的类型（table, board, form）
     c. 发起导出 → 轮询 → 下载
     d. 成功/失败标记
     e. 等待 3-5 秒（速率限制）

4. 输出结果汇总
   - 成功数量
   - 失败数量及原因
   - 失败文件列表（可用于重试）
```

**速率限制**：每次导出之间必须等待 **3-5 秒**：

```bash
sleep_time=$(python3 -c "import random; print(3 + random.random() * 2)")
sleep "$sleep_time"
```

**失败重试**：
- 每个文件最多重试 1 次
- 重试前等待 2 秒
- 重试失败后标记为 `failed`，继续处理下一个文件
- 所有文件处理完成后，可以单独重试失败文件

## 错误处理

| 错误类型 | 检测方式 | 处理策略 |
|---------|---------|---------|
| 凭证过期 | HTTP 401 | 中止导出，触发 auth 重新登录 |
| 权限不足 | HTTP 403 | 跳过该文件，记录警告 |
| 速率限制 | HTTP 429 | 中止当前文件，等待后继续下一个 |
| 导出超时 | 5 次轮询后无 downloadUrl | 标记失败，继续下一个 |
| 网络错误 | 请求异常 | 重试 1 次（2 秒延迟），失败则标记 |
| 格式不支持 | type 不在矩阵中 | 跳过并告知用户 |
| taskId 缺失 | 响应中无 taskId | 标记失败 |
