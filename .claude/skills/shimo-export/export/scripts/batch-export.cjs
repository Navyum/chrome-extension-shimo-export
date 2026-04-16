/**
 * 石墨文档批量导出脚本
 *
 * 搜索 + 导出一体化：按关键词搜索文档，然后批量导出到指定目录。
 * 也支持导出指定文件夹下的所有文件。
 *
 * 使用方法:
 *   node batch-export.cjs --keyword <关键词> --output <目录> [--format <格式>] [--size <数量>]
 *   node batch-export.cjs --folder <folder-guid> --output <目录> [--format <格式>]
 *   node batch-export.cjs --all --output <目录> [--format <格式>]
 *
 * 选项:
 *   --keyword <kw>    按关键词搜索并导出匹配的文档
 *   --folder <guid>   导出指定文件夹下的所有文件
 *   --all             导出个人空间根目录的所有文件
 *   --output <dir>    输出目录（必须）
 *   --format <fmt>    导出格式: md(默认), pdf, docx, xlsx, pptx, xmind, jpg
 *   --size <n>        搜索结果数量限制 (默认 50)
 *   --dry-run         仅列出文件，不实际导出
 *
 * Exit codes:
 *   0 - 全部成功
 *   1 - 部分或全部失败
 */

const path = require('path');
const fs = require('fs');

const ENV_FILE = path.join(__dirname, '..', '..', 'config', 'env.json');

const SHIMO_API = {
  SEARCH: 'https://shimo.im/lizard-api/search_v2/files',
  LIST_FILES: 'https://shimo.im/lizard-api/files',
  EXPORT: 'https://shimo.im/lizard-api/office-gw/files/export',
  PROGRESS: 'https://shimo.im/lizard-api/office-gw/files/export/progress',
  SPACES: 'https://shimo.im/panda-api/file/spaces?orderBy=updatedAt',
  PINNED_SPACES: 'https://shimo.im/panda-api/file/pinned_spaces',
};

const HEADERS = {
  'Referer': 'https://shimo.im/desktop',
  'Accept': 'application/nd.shimo.v2+json, text/plain, */*',
  'X-Requested-With': 'SOS 2.0',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// 各文档类型支持的导出格式（第一个为默认格式）
const SUPPORTED_FORMATS = {
  newdoc: ['md', 'docx', 'pdf', 'jpg'],
  modoc: ['docx', 'wps', 'pdf'],
  mosheet: ['xlsx'],
  presentation: ['pptx', 'pdf'],
  mindmap: ['xmind', 'jpg'],
};

// 导出格式映射：文档类型 → 默认格式
const FORMAT_MAP = {
  newdoc: 'md',
  modoc: 'docx',
  mosheet: 'xlsx',
  presentation: 'pptx',
  mindmap: 'xmind',
};

// 不支持导出的类型
const SKIP_TYPES = new Set(['folder', 'table', 'board', 'form', 'shortcut']);

const MAX_POLL_ATTEMPTS = 5;
const MAX_POLL_DELAY_MS = 16000;
const EXPORT_INTERVAL_MS = 4000; // 间隔 4 秒防限流

function loadCookie() {
  let cookie = process.env.SHIMO_COOKIE;
  if (!cookie) {
    try {
      const config = JSON.parse(fs.readFileSync(ENV_FILE, 'utf-8'));
      cookie = config.shimo_sid || '';
    } catch {}
  }
  return cookie || null;
}

function getHeaders(cookie, contentType) {
  const h = { ...HEADERS, 'Cookie': `shimo_sid=${cookie}` };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFilename(name) {
  if (!name) return 'untitled';
  return name.replace(/[\\/<>:"|?*]/g, '_').trim().replace(/^\.+|\.+$/g, '') || 'untitled';
}

function normalizeType(type) {
  if (!type) return 'newdoc';
  if (type === 'modoc') return 'modoc';
  if (type === 'mosheet') return 'mosheet';
  if (type === 'ppt' || type === 'pptx') return 'presentation';
  if (type === 'sheet') return 'mosheet';
  if (type.includes('mind')) return 'mindmap';
  if (type.includes('doc')) return 'newdoc';
  return type;
}

function getExportFormat(docType, userFormat) {
  const nType = normalizeType(docType);
  const supported = SUPPORTED_FORMATS[nType];
  const defaultFmt = FORMAT_MAP[nType] || 'md';

  // auto mode: use default format for this type
  if (!userFormat || userFormat === 'auto') return defaultFmt;

  // user specified a format: check if this type supports it
  if (supported && supported.includes(userFormat)) return userFormat;

  // user format not supported for this type: fall back to default
  return defaultFmt;
}

// --- API calls ---

async function searchFiles(keyword, size, headers) {
  const resp = await fetch(SHIMO_API.SEARCH, {
    method: 'POST',
    headers: getHeaders(headers, 'application/json'),
    body: JSON.stringify({
      keyword,
      fileType: '',
      category: '',
      createdBy: '',
      createdAtBegin: '',
      createdAtEnd: '',
      searchFields: 'name',
      desktop: false,
      spaceGuids: [],
      size,
      params: '',
    }),
  });
  if (!resp.ok) throw new Error(`搜索失败: HTTP ${resp.status}`);
  const data = await resp.json();
  return (data.results || []).map(r => {
    const s = r.source || {};
    return { guid: s.guid, name: s.name, type: normalizeType(s.type) };
  });
}

async function listFiles(folderGuid, cookie) {
  const url = folderGuid
    ? `${SHIMO_API.LIST_FILES}?folder=${encodeURIComponent(folderGuid)}`
    : SHIMO_API.LIST_FILES;
  const resp = await fetch(url, { headers: getHeaders(cookie) });
  if (!resp.ok) throw new Error(`获取文件列表失败: HTTP ${resp.status}`);
  const data = await resp.json();
  return (Array.isArray(data) ? data : data.children || []).map(f => ({
    guid: f.guid,
    name: f.name,
    type: f.type,
    normalizedType: normalizeType(f.type),
  }));
}

async function listAllSpaces(cookie) {
  const headers = getHeaders(cookie);
  const allSpaces = [];

  // Fetch normal spaces (with pagination)
  let url = SHIMO_API.SPACES;
  while (url) {
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`获取团队空间失败: HTTP ${resp.status}`);
    const data = await resp.json();
    allSpaces.push(...(data.spaces || []));
    url = data.next ? (data.next.startsWith('http') ? data.next : `https://shimo.im${data.next}`) : null;
  }

  // Fetch pinned spaces
  try {
    const resp = await fetch(SHIMO_API.PINNED_SPACES, { headers });
    if (resp.ok) {
      const data = await resp.json();
      allSpaces.push(...(data.spaces || []));
    }
  } catch {}

  // Deduplicate by guid
  const map = new Map();
  for (const s of allSpaces) {
    if (s.guid) map.set(s.guid, { guid: s.guid, name: s.name });
  }
  return Array.from(map.values());
}

/**
 * 递归遍历文件夹，返回所有文件（带路径信息）
 * @param {string|null} folderGuid - 文件夹 guid
 * @param {string} cookie - 凭证
 * @param {string} currentPath - 当前路径前缀
 * @returns {Array<{guid, name, type, normalizedType, folderPath}>}
 */
async function listFilesRecursive(folderGuid, cookie, currentPath = '') {
  let files;
  try {
    files = await listFiles(folderGuid, cookie);
  } catch (err) {
    process.stderr.write(`警告: 无法访问文件夹 ${folderGuid}: ${err.message}\n`);
    return [];
  }

  const results = [];
  for (const f of files) {
    if (f.type === 'folder') {
      const subPath = currentPath ? `${currentPath}/${sanitizeFilename(f.name)}` : sanitizeFilename(f.name);
      const subFiles = await listFilesRecursive(f.guid, cookie, subPath);
      results.push(...subFiles);
      // Small delay between folder requests
      await sleep(500);
    } else {
      results.push({
        guid: f.guid,
        name: f.name,
        type: f.normalizedType,
        folderPath: currentPath,
      });
    }
  }
  return results;
}

async function exportAndDownload(fileGuid, format, outputPath, headers) {
  // 1. Initiate
  const exportUrl = `${SHIMO_API.EXPORT}?fileGuid=${encodeURIComponent(fileGuid)}&type=${encodeURIComponent(format)}`;
  const resp1 = await fetch(exportUrl, { headers: getHeaders(headers) });
  if (!resp1.ok) throw new Error(`发起导出失败: HTTP ${resp1.status}`);
  const { taskId } = await resp1.json();
  if (!taskId) throw new Error('响应中未包含 taskId');

  // 2. Poll
  let downloadUrl = null;
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const delay = Math.min(1000 * Math.pow(2, i), MAX_POLL_DELAY_MS) + Math.random() * 1000;
    await sleep(delay);
    const resp2 = await fetch(`${SHIMO_API.PROGRESS}?taskId=${encodeURIComponent(taskId)}`, {
      headers: getHeaders(headers),
    });
    if (resp2.status === 429) throw new Error('请求被限流 (HTTP 429)');
    if (!resp2.ok) throw new Error(`查询进度失败: HTTP ${resp2.status}`);
    const data = await resp2.json();
    if (data.status === 0 && data.data && data.data.downloadUrl) {
      downloadUrl = data.data.downloadUrl;
      break;
    }
  }
  if (!downloadUrl) throw new Error('导出超时');

  // 3. Download
  const resp3 = await fetch(downloadUrl, { redirect: 'follow' });
  if (!resp3.ok) throw new Error(`下载失败: HTTP ${resp3.status}`);
  const buffer = Buffer.from(await resp3.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return buffer.length;
}

// --- CLI ---

function parseArgs(argv) {
  const opts = { keyword: null, folder: null, all: false, output: null, format: 'auto', size: 50, dryRun: false };
  let i = 0;
  while (i < argv.length) {
    switch (argv[i]) {
      case '--keyword': opts.keyword = argv[++i]; break;
      case '--folder': opts.folder = argv[++i]; break;
      case '--all': opts.all = true; break;
      case '--output': opts.output = argv[++i]; break;
      case '--format': opts.format = argv[++i]; break;
      case '--size': opts.size = parseInt(argv[++i], 10) || 50; break;
      case '--dry-run': opts.dryRun = true; break;
    }
    i++;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.output) {
    process.stderr.write('错误: 必须指定 --output <目录>\n\n');
    process.stderr.write('用法:\n');
    process.stderr.write('  node batch-export.cjs --keyword <关键词> --output <目录> [--format md]\n');
    process.stderr.write('  node batch-export.cjs --folder <guid> --output <目录>\n');
    process.stderr.write('  node batch-export.cjs --all --output <目录>\n');
    process.exit(1);
  }

  if (!opts.keyword && !opts.folder && !opts.all) {
    process.stderr.write('错误: 必须指定 --keyword、--folder 或 --all 之一\n');
    process.exit(1);
  }

  const cookie = loadCookie();
  if (!cookie) {
    console.log(JSON.stringify({ error: '未找到石墨凭证。请先登录。' }));
    process.exit(1);
  }

  // 1. Get file list
  let files = [];
  if (opts.keyword) {
    const searchResults = await searchFiles(opts.keyword, opts.size, cookie);
    files = searchResults.map(f => ({ ...f, folderPath: '' }));
  } else if (opts.folder) {
    files = await listFilesRecursive(opts.folder, cookie, '');
  } else if (opts.all) {
    // 全量导出：个人空间 + 所有团队空间，递归遍历
    process.stderr.write('正在扫描个人空间...\n');
    const personalFiles = await listFilesRecursive(null, cookie, '个人空间');

    process.stderr.write('正在获取团队空间列表...\n');
    const spaces = await listAllSpaces(cookie);
    process.stderr.write(`找到 ${spaces.length} 个团队空间\n`);

    const spaceFiles = [];
    for (const space of spaces) {
      process.stderr.write(`正在扫描空间: ${space.name}...\n`);
      const sf = await listFilesRecursive(space.guid, cookie, sanitizeFilename(space.name));
      spaceFiles.push(...sf);
      await sleep(500);
    }

    files = [...personalFiles, ...spaceFiles];
    process.stderr.write(`共发现 ${files.length} 个可导出文件\n`);
  }

  const exportable = files.filter(f => !SKIP_TYPES.has(f.type));

  if (exportable.length === 0) {
    console.log(JSON.stringify({ success: true, exported: 0, files: [] }));
    return;
  }

  if (opts.dryRun) {
    const preview = exportable.map(f => {
      const fmt = getExportFormat(f.type, opts.format);
      const adapted = (opts.format && opts.format !== 'auto' && fmt !== opts.format);
      return { name: f.name, type: f.type, format: fmt, folderPath: f.folderPath || '', adapted };
    });
    console.log(JSON.stringify({ dryRun: true, count: preview.length, files: preview }));
    return;
  }

  // 2. Batch export
  const results = [];
  const outputDir = path.resolve(opts.output);
  fs.mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < exportable.length; i++) {
    const f = exportable[i];
    const fmt = getExportFormat(f.type, opts.format);
    const filename = `${sanitizeFilename(f.name)}.${fmt}`;
    // 按原始文件夹层级保存
    const subDir = f.folderPath ? path.join(outputDir, f.folderPath) : outputDir;
    const outputPath = path.join(subDir, filename);

    process.stderr.write(`[${i + 1}/${exportable.length}] 导出: ${f.folderPath ? f.folderPath + '/' : ''}${f.name}\n`);
    try {
      const size = await exportAndDownload(f.guid, fmt, outputPath, cookie);
      results.push({ name: f.name, format: fmt, path: outputPath, folderPath: f.folderPath || '', size, success: true });
    } catch (err) {
      results.push({ name: f.name, format: fmt, folderPath: f.folderPath || '', error: err.message, success: false });
    }

    if (i < exportable.length - 1) {
      await sleep(EXPORT_INTERVAL_MS + Math.random() * 1000);
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(JSON.stringify({ success: failed === 0, exported: succeeded, failed, outputDir, files: results }));

  if (failed > 0) process.exit(1);
}

main().catch(error => {
  console.log(JSON.stringify({ error: error.message }));
  process.exit(1);
});
