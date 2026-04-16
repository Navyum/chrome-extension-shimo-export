/**
 * 石墨文档团队空间列表脚本
 *
 * 获取所有团队空间（普通 + 置顶），自动分页并合并去重。
 *
 * 使用方法:
 *   node list-spaces.cjs
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

const SPACES_API = 'https://shimo.im/panda-api/file/spaces?orderBy=updatedAt';
const PINNED_API = 'https://shimo.im/panda-api/file/pinned_spaces';
const BASE_URL = 'https://shimo.im';

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

// --- API ---

async function fetchAllSpaces(headers) {
  const allSpaces = [];
  let url = SPACES_API;

  while (url) {
    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      throw new Error(`获取团队空间失败: HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const spaces = data.spaces || [];
    allSpaces.push(...spaces);

    if (data.next) {
      url = data.next.startsWith('http') ? data.next : `${BASE_URL}${data.next}`;
    } else {
      url = null;
    }
  }

  return allSpaces;
}

async function fetchPinnedSpaces(headers) {
  const response = await fetch(PINNED_API, { method: 'GET', headers });

  if (!response.ok) {
    throw new Error(`获取置顶空间失败: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.spaces || [];
}

// --- Main ---

async function main() {
  const cookie = loadCookie();
  if (!cookie) {
    outputResult({ error: '未找到石墨凭证。请先运行 browser-login.cjs 或设置 SHIMO_COOKIE 环境变量。' });
    process.exit(1);
  }

  const headers = getHeaders(cookie);

  try {
    const [allSpaces, pinnedSpaces] = await Promise.all([
      fetchAllSpaces(headers),
      fetchPinnedSpaces(headers),
    ]);

    // 合并去重，以 guid 为唯一键
    const map = new Map();
    for (const s of allSpaces) {
      if (s.guid) map.set(s.guid, s);
    }
    for (const s of pinnedSpaces) {
      if (s.guid) map.set(s.guid, s);
    }

    const results = Array.from(map.values()).map(s => ({
      guid: s.guid,
      name: s.name,
    }));

    outputResult(results);

  } catch (error) {
    if (error.message.includes('401')) {
      outputResult({ error: '凭证已过期，请重新登录。' });
    } else {
      outputResult({ error: error.message });
    }
    process.exit(1);
  }
}

main().catch(error => {
  outputResult({ error: error.message });
  process.exit(1);
});
