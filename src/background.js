// 引入浏览器兼容层
// Firefox (Manifest V3 with scripts): browser.js 通过 manifest.json 的 scripts 数组加载
// Chrome/Edge (Manifest V3 with service_worker): 使用 importScripts 加载
if (typeof importScripts !== 'undefined') {
  // Service Worker 环境 (Chrome/Edge)
  importScripts('browser.js');
}

// 石墨文档 API 配置
const SHIMO_API = {
  ROOT: 'https://shimo.im/lizard-api/files',
  LIST: 'https://shimo.im/lizard-api/files?folder=%s',
  SPACE: 'https://shimo.im/panda-api/file/spaces?orderBy=updatedAt',
  PINNED_SPACE: 'https://shimo.im/panda-api/file/pinned_spaces',
  EXPORT: 'https://shimo.im/lizard-api/office-gw/files/export?fileGuid=%s&type=%s',
  QUERY: 'https://shimo.im/lizard-api/office-gw/files/export/progress?taskId=%s'
};

const DEFAULT_TIMESTAMP_FORMAT = 'YYYY-MM-DD_HH-mm';

// 石墨文档导出支持矩阵
const EXPORT_SUPPORT_MATRIX = {
  newdoc: ['md', 'jpg', 'docx', 'pdf'],
  modoc: ['docx', 'wps', 'pdf'],
  mosheet: ['xlsx'],
  presentation: ['pptx', 'pdf'],
  mindmap: ['xmind', 'jpg']
};

const UNSUPPORTED_TYPES = ['table', 'board', 'form'];

// 通用请求函数，添加必要的头部
async function makeRequest(url, options = {}) {
  // 模拟真实浏览器的请求头
  const defaultHeaders = {
    'Referer': 'https://shimo.im/desktop',
    'Accept': 'application/nd.shimo.v2+json, text/plain, */*',
    'X-Requested-With': 'SOS 2.0',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const requestOptions = {
    method: 'GET',
    credentials: 'include', // 关键: 让浏览器自动携带已设置的 cookies
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    },
    signal: abortController.signal
  };

  return fetch(url, requestOptions);
}

// 全局状态
let exportState = {
  isExporting: false,
  isPaused: false,
  totalFiles: 0,
  currentFileIndex: 0,
  fileList: [], // Each file will now have a 'status' property: pending, in_progress, success, failed
  exportType: 'auto',
  typeExportSettings: {},
  subfolder: '',
  preserveFileTimes: false,
  fileTimeFormat: DEFAULT_TIMESTAMP_FORMAT,
  fileTimeSource: 'createdAt',
  logs: [],
};
let abortController = new AbortController();

// Map to store desired filenames for pending downloads
const pendingRenames = new Map();

const defaultState = JSON.parse(JSON.stringify(exportState));

// --- 状态管理 ---
async function saveState() {
  await browser.storage.local.set({ exportState });
  if (exportState.fileList && exportState.fileList.length > 0) {
    await browser.storage.local.set({
      fileInfo: {
        totalFiles: exportState.totalFiles,
        fileList: exportState.fileList
      },
      totalFiles: exportState.totalFiles
    });
  }
}

async function loadState() {
  try {
    const result = await browser.storage.local.get(['exportState', 'fileInfo', 'totalFiles']);
    if (result.exportState) {
      Object.assign(exportState, result.exportState);
      if ((!exportState.fileList || exportState.fileList.length === 0) && result.fileInfo) {
        exportState.fileList = result.fileInfo.fileList;
        exportState.totalFiles = result.fileInfo.totalFiles;
      }
      sendLog('任务状态已从存储中加载。');
    }
  } catch (error) {
    sendLog('加载之前的状态失败。');
  }
}

// 初始化
(async () => {
  await loadState();
  if (exportState.isExporting && !exportState.isPaused) {
    sendLog('检测到中断的导出任务，正在恢复...');
    exportFiles();
  }
})();

// Listen for download filename suggestions
browser.downloads.onDeterminingFilename.addListener((downloadItem) => {
  if (pendingRenames.has(downloadItem.id)) {
    const filename = pendingRenames.get(downloadItem.id);
    pendingRenames.delete(downloadItem.id);
    return { filename: filename, conflictAction: 'uniquify' };
  }
});

// 获取用户信息
async function getUserInfo() {
  try {
    const response = await makeRequest('https://shimo.im/lizard-api/users/me');
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    const userData = await response.json();
    
    return {
      success: true,
      data: {
        id: userData.id,
        name: userData.name,
        email: userData.email
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 监听来自 popup 的消息
browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.action) {
    case 'getFileInfo':
      sendLog('后台收到 getFileInfo 请求');
      return handleGetFileInfo();
    case 'startExport':
      sendLog('后台收到 startExport 请求');
      return handleStartExport(message.data);
    case 'togglePause':
      sendLog('后台收到 togglePause 请求');
      handleTogglePause(message.data);
      return { success: true };
    case 'getUiState':
      return { success: true, data: exportState };
    case 'retryFailedFiles':
      sendLog('后台收到 retryFailedFiles 请求');
      return handleRetryFailedFiles();
    case 'resetExport':
      sendLog('后台收到 resetExport 请求');
      return handleResetExport();
    case 'getUserInfo':
      return getUserInfo();
    default:
      return { success: false, error: 'Unknown action' };
  }
});

// 处理取消并重置任务的请求
async function handleResetExport() {
  sendLog('正在取消所有任务并清除状态...');
  
  exportState.isExporting = false;
  exportState.isPaused = false;
  
  abortController.abort();
  abortController = new AbortController();

  pendingRenames.clear();
  exportState = JSON.parse(JSON.stringify(defaultState));
  await browser.storage.local.set({ exportState });
  
  return { success: true, data: exportState };
}

// 同步 cookie
async function syncAllShimoCookies() {
  sendLog('开始同步所有 shimo.im cookies...');
  const cookies = await browser.cookies.getAll({ domain: 'shimo.im' });
  sendLog(`找到了 ${cookies.length} 个 cookies 来同步`);

  if (cookies.length === 0) {
      sendLog('警告: 未能从 shimo.im 域获取任何 cookies。请确保您已在该网站登录。');
      return;
  }

  for (const cookie of cookies) {
    const newCookie = {
      url: 'https://shimo.im' + (cookie.path || '/'),
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite
    };

    if (!cookie.hostOnly) {
      newCookie.domain = cookie.domain;
    }

    if (cookie.expirationDate && !cookie.session) {
      newCookie.expirationDate = cookie.expirationDate;
    }
    
    try {
      await browser.cookies.set(newCookie);
    } catch (error) {
      sendLog(`  设置 cookie: ${newCookie.name} 失败: ${error.message}`);
    }
  }
  
  sendLog('所有 shimo.im cookies 同步完成。');
  await new Promise(r => setTimeout(r, 200));
}

// 处理获取文件信息的请求
async function handleGetFileInfo() {
  try {
    sendLog('步骤 1: 开始同步 Cookies...');
    await syncAllShimoCookies();

    sendLog('步骤 2: 获取 shimo_sid...');
    const sidCookie = await browser.cookies.get({ url: 'https://shimo.im', name: 'shimo_sid' });
    if (!sidCookie) {
      throw new Error('未能获取 shimo_sid，请确保已登录石墨。');
    }
    sendLog(`步骤 2: 获取到 shimo_sid: ${sidCookie.value}`);

    sendLog('步骤 3: 开始获取文件列表 (同时验证登录状态)...');
    const rawFileList = await getAllFiles();
    if (rawFileList.length === 0) {
      throw new Error('获取文件列表失败，请确保已登录石墨。');
    }

    exportState.fileList = rawFileList.map(file => ({ ...file, status: 'pending' }));
    exportState.totalFiles = exportState.fileList.length;
    exportState.currentFileIndex = 0;

    await saveState();
    sendLog(`步骤 3: 成功获取 ${exportState.totalFiles} 个文件。`);

    return { success: true, data: exportState };
  } catch (error) {
    let errorMessage = `后台错误: ${error.message}`;
    if (error.message.includes('401')) errorMessage = '登录凭据无效或已过期，请重新登录石墨。';
    else if (error.message.includes('403')) errorMessage = '无权访问文件列表，请检查账号权限。';
    else if (error.message.includes('未能获取 shimo_sid')) errorMessage = '请确保已登录石墨';
    
    sendLog(`获取文件信息时出错: ${error.stack}`);
    return { success: false, error: errorMessage };
  }
}

// 处理开始导出的请求
async function handleStartExport(data) {
  if (exportState.fileList.length === 0) {
    return { success: false, error: '文件列表为空，请先获取文件信息。' };
  }
  
  const settings = await browser.storage.local.get(['subfolder', 'preserveFileTimes', 'fileTimeFormat', 'fileTimeSource', 'typeExportSettings']);

  exportState.isExporting = true;
  exportState.isPaused = false;
  exportState.currentFileIndex = 0;
  exportState.exportType = data.exportType;
  exportState.typeExportSettings = settings.typeExportSettings || {};
  exportState.subfolder = settings.subfolder || '';
  
  const fileTimeSource = settings.fileTimeSource || 'off';
  exportState.preserveFileTimes = Boolean(settings.preserveFileTimes) && fileTimeSource !== 'off';
  exportState.fileTimeFormat = settings.fileTimeFormat || DEFAULT_TIMESTAMP_FORMAT;
  exportState.fileTimeSource = fileTimeSource !== 'off' ? fileTimeSource : 'createdAt';
  exportState.logs = [];
  
  exportState.fileList.forEach(file => {
    if (file.status !== 'success') file.status = 'pending';
  });

  await saveState();
  
  abortController = new AbortController();
  exportFiles();
  
  return { success: true };
}

// 处理暂停/继续
async function handleTogglePause(data) {
  if (!exportState.isExporting) {
    sendComplete();
    return;
  }
  exportState.isPaused = data.isPaused;
  sendLog(exportState.isPaused ? '导出已暂停' : '导出已继续');
  await saveState();
}

// 获取所有文件列表
async function getAllFiles() {
  const allFiles = [];
  const teamSpacePrefix = '团队空间';
  
  async function getTeamSpaces() {
    const spacesMap = new Map(); // 使用 Map 来去重，key 为 guid
    
    // 1. 获取普通团队空间列表
    let nextUrl = SHIMO_API.SPACE;
    while (nextUrl) {
      try {
        const response = await makeRequest(nextUrl);
        if (!response.ok) {
          sendLog(`获取团队空间列表失败: HTTP ${response.status}，继续尝试获取置顶空间...`);
          break;
        }
        const data = await response.json();
        if (Array.isArray(data.spaces)) {
          data.spaces.forEach(space => {
            if (space.guid) {
              spacesMap.set(space.guid, space);
            }
          });
        }
        nextUrl = data.next ? (data.next.startsWith('http') ? data.next : `https://shimo.im${data.next}`) : '';
      } catch (error) {
        sendLog(`获取团队空间列表时出错: ${error.message}，继续尝试获取置顶空间...`);
        break;
      }
    }
    
    // 2. 获取置顶团队空间列表
    try {
      const pinnedResponse = await makeRequest(SHIMO_API.PINNED_SPACE);
      if (pinnedResponse.ok) {
        const pinnedData = await pinnedResponse.json();
        if (Array.isArray(pinnedData.spaces)) {
          pinnedData.spaces.forEach(space => {
            if (space.guid) {
              spacesMap.set(space.guid, space);
            }
          });
          sendLog(`从置顶空间接口获取到 ${pinnedData.spaces.length} 个空间`);
        }
      } else {
        sendLog(`获取置顶空间列表失败: HTTP ${pinnedResponse.status}`);
      }
    } catch (error) {
      sendLog(`获取置顶空间列表时出错: ${error.message}`);
    }
    
    // 3. 返回去重后的空间列表
    const uniqueSpaces = Array.from(spacesMap.values());
    sendLog(`合并后共获取到 ${uniqueSpaces.length} 个团队空间（已去重）`);
    return uniqueSpaces;
  }
  
  async function fetchFiles(folderId = '', currentPath = '') {
    const url = folderId ? SHIMO_API.LIST.replace('%s', folderId) : SHIMO_API.ROOT;
    try {
      const response = await makeRequest(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const files = await response.json();
      
      for (const file of files) {
        const sanitizedName = sanitizePathComponent(file.name);
        if (file.type === 'folder') {
          const newPath = currentPath ? `${currentPath}/${sanitizedName}` : sanitizedName;
          await fetchFiles(file.guid, newPath);
        } else {
          allFiles.push({
            id: file.guid,
            title: file.name,
            type: file.type,
            folderPath: currentPath,
            createdAt: file.createdAt || null,
            updatedAt: file.updatedAt || null
          });
        }
      }
    } catch (error) {
      sendLog(`获取文件夹内容失败 (ID: ${folderId}): ${error.message}`);
      if (error.message.includes('401') || error.message.includes('403') || error.message.includes('未登录')) {
        throw new Error('未能获取 shimo_sid，请确保已登录石墨。');
      }
    }
  }

  sendLog('开始获取个人空间文件列表...');
  await fetchFiles();
  sendLog('开始获取团队空间列表...');
  const teamSpaces = await getTeamSpaces();
  for (const space of teamSpaces) {
    const sanitizedSpaceName = sanitizePathComponent(space.name) || space.guid || '团队空间';
    await fetchFiles(space.guid, `${teamSpacePrefix}/${sanitizedSpaceName}`);
  }

  return allFiles;
}

// 文件名处理
function sanitizePathComponent(name) {
  if (!name) return '';
  return name.replace(/[\\/<>:"|?*]/g, '_').trim().replace(/^\.+|\.+$/g, '');
}

function formatFileTimestamp(timestamp, format = DEFAULT_TIMESTAMP_FORMAT) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const pad = (v) => String(v).padStart(2, '0');
  const tokens = {
    'YYYY': String(date.getFullYear()),
    'MM': pad(date.getMonth() + 1),
    'DD': pad(date.getDate()),
    'HH': pad(date.getHours()),
    'mm': pad(date.getMinutes()),
    'ss': pad(date.getSeconds())
  };
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, t => tokens[t] || t);
}

// 导出循环
async function exportFiles() {
  try {
    const filesToProcess = exportState.fileList;
    const totalCount = filesToProcess.length;

    for (let i = exportState.currentFileIndex; i < totalCount; i++) {
      if (!exportState.isExporting) return;
      
      const file = filesToProcess[i];
      exportState.currentFileIndex = i;

      if (file.status !== 'pending') continue;
      
      file.status = 'in_progress';
      file.startTime = Date.now();
      await saveState();
      sendLog(`(进度 ${i + 1}/${totalCount}) 开始处理: ${file.title}`);

      try {
        const type = getFileExportType(file);
        if (!type) {
          file.status = 'success';
          const fullPath = file.folderPath ? `${file.folderPath}/${file.title}` : file.title;
          sendLog(`跳过不支持导出的文件类型 (${file.type}): ${fullPath}`);
          sendProgress();
          await saveState();
          continue;
        }

        const MAX_RETRIES = 1;
        let success = false;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            file.retryCount = attempt;
            if (attempt > 0) {
              sendLog(`重试中 (${attempt}/${MAX_RETRIES}): ${file.title}`);
              await new Promise(r => setTimeout(r, 2000));
            }
            const taskId = await getExportTaskId(file);
            const downloadUrl = await waitForExportComplete(taskId, file);
            if (!downloadUrl) throw new Error('导出超时');

            await downloadFile(downloadUrl, file);
            file.status = 'success';
            file.endTime = Date.now();
            file.duration = file.endTime - file.startTime;
            sendLog(`下载完成: ${file.title} (耗时: ${(file.duration/1000).toFixed(2)}s)`);
            sendProgress();
            success = true;
            break;
          } catch (error) {
            if (error.name === 'AbortError') return;
            sendLog(`导出失败 (尝试 ${attempt + 1}): ${file.title} - ${error.message}`);
          }
        }
        if (!success) {
          file.status = 'failed';
          sendLog(`所有重试均失败，将 ${file.title} 标记为失败。`);
        }
      } catch (error) {
        file.status = 'failed';
        sendLog(`意外错误，将 ${file.title} 标记为失败: ${error.message}`);
      } finally {
        file.endTime = Date.now();
        file.duration = file.endTime - file.startTime;
        await saveState();
      }
      
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
    }
    
    exportState.isExporting = false;
    const failedCount = exportState.fileList.filter(f => f.status === 'failed').length;
    if (failedCount > 0) sendLog(`导出流程完成，但有 ${failedCount} 个文件失败。`);
    else sendLog('所有文件均已成功导出！');

    await saveState();
    sendComplete();
  } catch (error) {
    if (error.name !== 'AbortError') {
      sendLog(`导出流程因意外错误而终止: ${error.message}`);
      exportState.isExporting = false;
      await saveState();
    }
  }
}

async function getExportTaskId(file) {
  const type = getFileExportType(file);
  const url = SHIMO_API.EXPORT.replace('%s', file.id).replace('%s', type);
  file.exportUrl = url;
  file.actualExportType = type; // 保存实际使用的导出类型用于下载
  const response = await makeRequest(url);
  if (!response.ok) throw new Error(`获取导出任务失败: HTTP ${response.status}`);
  const data = await response.json();
  if (!data.taskId) throw new Error('未获取到导出任务ID');
  return data.taskId;
}

// 获取文件最终导出的类型
function getFileExportType(file) {
  let fileType = file.type;
  
  // 统一映射到矩阵键名，确保与设置页面 data-type 一致
  if (fileType === 'ppt' || fileType === 'pptx') fileType = 'presentation';
  if (fileType === 'sheet') fileType = 'mosheet';

  // 如果是不支持的类型，直接返回 null
  if (UNSUPPORTED_TYPES.includes(fileType)) {
    return null;
  }

  let supportedFormats = EXPORT_SUPPORT_MATRIX[fileType];
  
  // 兜底逻辑：如果没有匹配到矩阵，尝试一些常见的映射
  if (!supportedFormats) {
    if (fileType.includes('sheet')) supportedFormats = EXPORT_SUPPORT_MATRIX.mosheet;
    else if (fileType.includes('ppt') || fileType.includes('pptx') || fileType.includes('presentation')) supportedFormats = EXPORT_SUPPORT_MATRIX.presentation;
    else if (fileType.includes('doc')) supportedFormats = EXPORT_SUPPORT_MATRIX.newdoc;
    else if (fileType.includes('mind')) supportedFormats = EXPORT_SUPPORT_MATRIX.mindmap;
  }

  if (!supportedFormats || supportedFormats.length === 0) {
    // 最后的兜底：如果是 auto 模式返回 md，否则返回用户选择的类型
    const fallback = exportState.exportType === 'auto' ? 'md' : exportState.exportType;
    return fallback === 'auto' ? 'md' : fallback;
  }

  // 获取设置中的类型，并确保它在支持列表中
  const getSetting = (type) => {
    const setting = exportState.typeExportSettings[type];
    return (setting && supportedFormats.includes(setting)) ? setting : null;
  };

  // 1. 如果全局选择 Auto
  if (exportState.exportType === 'auto') {
    // 优先使用设置中的 per-type 设置
    const setting = getSetting(fileType);
    if (setting) return setting;
    
    // 否则使用矩阵中的第一个
    return supportedFormats[0];
  }

  // 2. 如果全局选择特定格式 (仅对 newdoc 生效，其他类型依然走 Auto 逻辑)
  if (fileType === 'newdoc') {
    return supportedFormats.includes(exportState.exportType) ? exportState.exportType : supportedFormats[0];
  } else {
    // 非 newdoc 类型，按照设置中的类型导出，如果没有设置则取支持列表第一个
    const setting = getSetting(fileType);
    if (setting) return setting;
    
    return supportedFormats[0];
  }
}

async function waitForExportComplete(taskId, file) {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (exportState.isPaused) {
      sendLog('导出已暂停，等待继续...');
      while (exportState.isPaused) {
        await new Promise(r => setTimeout(r, 1000));
        if (!exportState.isExporting) return null;
      }
    }
    if (!exportState.isExporting) return null;

    const response = await makeRequest(SHIMO_API.QUERY.replace('%s', taskId));
    if (!exportState.isExporting) return null;
    if (response.status === 429) return null;
    if (!response.ok) throw new Error(`查询导出进度失败: HTTP ${response.status}`);

    const data = await response.json();
    if (data.status === 0 && data.data && data.data.downloadUrl) {
      file.downloadUrl = data.data.downloadUrl;
      return data.data.downloadUrl;
    }

    if (attempt < maxAttempts - 1) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 16000) + Math.random() * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return null;
}

// 下载文件
async function downloadFile(downloadUrl, file) {
  try {
    let baseName = sanitizePathComponent(file.title) || '无标题';
    if (exportState.preserveFileTimes && exportState.fileTimeSource !== 'off') {
      const formatted = formatFileTimestamp(file[exportState.fileTimeSource], exportState.fileTimeFormat);
      if (formatted) baseName = `${baseName}__${formatted}`;
    }

    let type = file.actualExportType;
    if (!type || type === 'auto') {
      type = exportState.exportType === 'auto' ? 'md' : exportState.exportType;
    }
    // 确保 type 绝对不会是 'auto'
    if (type === 'auto') type = 'md';

    const fileName = `${baseName}.${type}`;
    const relativeFolderPath = file.folderPath || '';
    const rootSubfolder = exportState.subfolder ? exportState.subfolder.replace(/[<>:"|?*]/g, '_') : '';

    let finalDownloadPath = fileName;
    if (relativeFolderPath) finalDownloadPath = `${relativeFolderPath}/${finalDownloadPath}`;
    if (rootSubfolder) finalDownloadPath = `${rootSubfolder}/${finalDownloadPath}`;
    
    finalDownloadPath = finalDownloadPath.replace(/^[/\\]+/, '');

    sendLog(`开始下载: ${finalDownloadPath}`);

    // 直接调用，由 browser.js 处理差异
    const downloadId = await browser.downloads.download({
      url: downloadUrl,
      filename: finalDownloadPath, // 始终提供 filename，作为 Chrome 的默认或 Firefox 的回退
      saveAs: false
    });

    pendingRenames.set(downloadId, finalDownloadPath);
    sendLog(`下载任务已创建 (ID: ${downloadId})`);

  } catch (error) {
    sendLog(`创建下载任务失败: ${error.message}`);
    throw error;
  }
}

// --- 通信辅助函数 ---
async function sendMessageToPopup(message) {
  try {
    await browser.runtime.sendMessage(message);
  } catch (error) {
    // 忽略 popup 关闭导致的错误
  }
}

function sendProgress() {
  const exportedCount = exportState.fileList.filter(f => f.status === 'success').length;
  sendMessageToPopup({
    action: 'exportProgress',
    data: { exportedFiles: exportedCount, totalFiles: exportState.totalFiles }
  });
}

function sendLog(message) {
  const timestampedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
  exportState.logs.push(timestampedMessage);
  if (exportState.logs.length > 200) exportState.logs.shift();
  sendMessageToPopup({ action: 'exportLog', data: { message: timestampedMessage } });
}

function sendComplete() {
  sendMessageToPopup({ action: 'exportComplete' });
}

// 处理重试失败文件的请求
async function handleRetryFailedFiles() {
    if (exportState.isExporting) {
        return { success: false, error: '当前有任务在进行中，请稍后再试。' };
    }

    const failedFiles = exportState.fileList.filter(file => file.status === 'failed');
    if (failedFiles.length === 0) {
        return { success: false, error: '没有失败的文件可以重试。' };
    }

    sendLog(`准备重试 ${failedFiles.length} 个失败的文件...`);
    exportState.fileList.forEach(file => {
      if (file.status === 'failed') file.status = 'pending';
    });

    exportState.isExporting = true;
    exportState.isPaused = false;
    exportState.currentFileIndex = 0;
    
    const settings = await browser.storage.local.get(['subfolder', 'preserveFileTimes', 'fileTimeFormat', 'fileTimeSource', 'typeExportSettings']);
    exportState.subfolder = settings.subfolder || '';
    exportState.typeExportSettings = settings.typeExportSettings || {};
    const fileTimeSource = settings.fileTimeSource || 'off';
    exportState.preserveFileTimes = Boolean(settings.preserveFileTimes) && fileTimeSource !== 'off';
    exportState.fileTimeFormat = settings.fileTimeFormat || DEFAULT_TIMESTAMP_FORMAT;
    exportState.fileTimeSource = fileTimeSource !== 'off' ? fileTimeSource : 'createdAt';
    exportState.logs = [];
    
    abortController = new AbortController();
    await saveState();
    exportFiles();
    
    return { success: true };
}
