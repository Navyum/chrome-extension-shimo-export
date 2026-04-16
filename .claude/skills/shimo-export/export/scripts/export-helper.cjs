/**
 * 石墨文档导出工作流脚本
 *
 * 封装完整的三阶段导出流程：发起导出 → 轮询进度 → 下载文件
 *
 * 使用方法:
 *   node export-helper.cjs <fileGuid> <format> [outputDir]
 *
 * 参数:
 *   fileGuid  - 文件的唯一标识 (guid)
 *   format    - 导出格式: md, pdf, docx, wps, xlsx, pptx, xmind, jpg
 *   outputDir - 输出目录 (可选，默认为当前目录)
 *
 * 环境变量:
 *   SHIMO_COOKIE - shimo_sid 的值 (优先使用)
 *   或者使用配置文件 config/env.json
 *
 * 输出:
 *   JSON 格式的结果到 stdout
 *
 * Exit codes:
 *   0 - 导出成功
 *   1 - 导出失败
 */

const path = require('path');
const fs = require('fs');

// --- Configuration ---

const ENV_FILE = path.join(__dirname, '..', '..', 'config', 'env.json');

const SHIMO_API = {
  EXPORT: 'https://shimo.im/lizard-api/office-gw/files/export',
  PROGRESS: 'https://shimo.im/lizard-api/office-gw/files/export/progress',
};

const HEADERS = {
  'Referer': 'https://shimo.im/desktop',
  'Accept': 'application/nd.shimo.v2+json, text/plain, */*',
  'X-Requested-With': 'SOS 2.0',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const MAX_POLL_ATTEMPTS = 5;
const MAX_POLL_DELAY_MS = 16000;

// --- Helpers ---

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(ENV_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function loadCookie() {
  let cookie = process.env.SHIMO_COOKIE;
  if (!cookie) {
    const config = loadConfig();
    cookie = config.shimo_sid || '';
  }
  return cookie || null;
}

function getHeaders(cookie) {
  return {
    ...HEADERS,
    'Cookie': `shimo_sid=${cookie}`,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFilename(name) {
  if (!name) return 'untitled';
  return name.replace(/[\\/<>:"|?*]/g, '_').trim().replace(/^\.+|\.+$/g, '') || 'untitled';
}

function outputResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

// --- Export Workflow ---

async function initiateExport(fileGuid, format, headers) {
  const url = `${SHIMO_API.EXPORT}?fileGuid=${encodeURIComponent(fileGuid)}&type=${encodeURIComponent(format)}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    throw new Error(`发起导出失败: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.taskId) {
    throw new Error('响应中未包含 taskId');
  }

  return data.taskId;
}

async function pollProgress(taskId, headers) {
  const url = `${SHIMO_API.PROGRESS}?taskId=${encodeURIComponent(taskId)}`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(url, { method: 'GET', headers });

    if (response.status === 429) {
      throw new Error('请求被限流 (HTTP 429)，请稍后重试');
    }

    if (!response.ok) {
      throw new Error(`查询进度失败: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 0 && data.data && data.data.downloadUrl) {
      return data.data.downloadUrl;
    }

    // Exponential backoff
    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      const delay = Math.min(1000 * Math.pow(2, attempt), MAX_POLL_DELAY_MS) + Math.random() * 1000;
      await sleep(delay);
    }
  }

  throw new Error(`导出超时: ${MAX_POLL_ATTEMPTS} 次轮询后仍未完成`);
}

async function downloadFile(downloadUrl, outputPath) {
  // downloadUrl 是 302 重定向，fetch 默认 follow redirect
  const response = await fetch(downloadUrl, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`下载失败: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buffer);

  return buffer.length;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    process.stderr.write('用法: node export-helper.cjs <fileGuid> <format> [outputDir]\n');
    process.stderr.write('\n');
    process.stderr.write('参数:\n');
    process.stderr.write('  fileGuid   文件的唯一标识 (guid)\n');
    process.stderr.write('  format     导出格式: md, pdf, docx, wps, xlsx, pptx, xmind, jpg\n');
    process.stderr.write('  outputDir  输出目录 (默认: 当前目录)\n');
    process.exit(1);
  }

  // Support --name flag: node export-helper.cjs <guid> <format> [outputDir] [--name "文档名称"]
  let fileName = null;
  const nameIdx = args.indexOf('--name');
  if (nameIdx !== -1 && args[nameIdx + 1]) {
    fileName = args[nameIdx + 1];
    args.splice(nameIdx, 2);
  }
  const [fileGuid, format, outputDir = '.'] = args;

  // 1. Load cookie
  const cookie = loadCookie();
  if (!cookie) {
    outputResult({
      success: false,
      fileGuid,
      format,
      error: '未找到石墨凭证。请先运行 browser-login.cjs 或设置 SHIMO_COOKIE 环境变量。',
    });
    process.exit(1);
  }

  const headers = getHeaders(cookie);

  try {
    const taskId = await initiateExport(fileGuid, format, headers);
    const downloadUrl = await pollProgress(taskId, headers);

    const filename = `${sanitizeFilename(fileName || fileGuid)}.${format}`;
    const outputPath = path.resolve(outputDir, filename);
    const fileSize = await downloadFile(downloadUrl, outputPath);

    outputResult({
      success: true,
      name: fileName || fileGuid,
      format,
      path: outputPath,
      size: fileSize,
    });

  } catch (error) {
    outputResult({ success: false, error: error.message });
    process.exit(1);
  }
}

main().catch(error => {
  outputResult({
    success: false,
    error: error.message,
  });
  process.exit(1);
});
