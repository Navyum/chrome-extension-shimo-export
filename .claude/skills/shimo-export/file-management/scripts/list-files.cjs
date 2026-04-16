/**
 * 石墨文档文件列表脚本
 *
 * 获取个人空间根目录或指定文件夹下的文件列表。
 *
 * 使用方法:
 *   node list-files.cjs [folder-guid]
 *
 * 参数:
 *   folder-guid - 文件夹的 guid (可选，不传则列出根目录)
 *
 * 环境变量:
 *   SHIMO_COOKIE - shimo_sid 的值 (优先使用)
 *   或者使用配置文件 config/env.json
 *
 * 输出:
 *   JSON 数组到 stdout
 *
 * Exit codes:
 *   0 - 成功
 *   1 - 失败
 */

const path = require('path');
const fs = require('fs');

// --- Configuration ---

const ENV_FILE = path.join(__dirname, '..', '..', 'config', 'env.json');

const FILES_API = 'https://shimo.im/lizard-api/files';

const HEADERS = {
  'Referer': 'https://shimo.im/desktop',
  'Accept': 'application/nd.shimo.v2+json, text/plain, */*',
  'X-Requested-With': 'SOS 2.0',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

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

function outputResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

// --- Main ---

async function main() {
  const folderGuid = process.argv[2] || null;

  const cookie = loadCookie();
  if (!cookie) {
    outputResult({ error: '未找到石墨凭证。请先运行 browser-login.cjs 或设置 SHIMO_COOKIE 环境变量。' });
    process.exit(1);
  }

  const headers = getHeaders(cookie);
  const url = folderGuid ? `${FILES_API}?folder=${encodeURIComponent(folderGuid)}` : FILES_API;

  try {
    const response = await fetch(url, { method: 'GET', headers });

    if (response.status === 401) {
      outputResult({ error: '凭证已过期，请重新登录。' });
      process.exit(1);
    }

    if (response.status === 404) {
      outputResult({ error: `文件夹不存在: ${folderGuid}` });
      process.exit(1);
    }

    if (!response.ok) {
      outputResult({ error: `请求失败: HTTP ${response.status} ${response.statusText}` });
      process.exit(1);
    }

    const files = await response.json();
    const results = (Array.isArray(files) ? files : []).map(f => ({
      guid: f.guid,
      name: f.name,
      type: f.type,
    }));

    outputResult(results);

  } catch (error) {
    outputResult({ error: error.message });
    process.exit(1);
  }
}

main().catch(error => {
  outputResult({ error: error.message });
  process.exit(1);
});
