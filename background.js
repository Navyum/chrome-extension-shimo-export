// 石墨文档 API 配置
const SHIMO_API = {
  ROOT: 'https://shimo.im/lizard-api/files',
  LIST: 'https://shimo.im/lizard-api/files?folder=%s',
  EXPORT: 'https://shimo.im/lizard-api/office-gw/files/export?fileGuid=%s&type=%s',
  QUERY: 'https://shimo.im/lizard-api/office-gw/files/export/progress?taskId=%s'
};

// 通用请求函数，添加必要的头部
async function makeRequest(url, shimoSid, options = {}) {
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
      // 注意: 不在此处手动设置 'Cookie' 头
    },
    signal: abortController.signal // Link the request to the abort controller
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
  exportType: 'md',
  subfolder: '',
  logs: [],
};
let abortController = new AbortController();

// Map to store desired filenames for pending downloads
const pendingRenames = new Map();

const defaultState = JSON.parse(JSON.stringify(exportState));

// --- 状态管理 ---
async function saveState() {
  await chrome.storage.local.set({ exportState });
  // 同时更新文件信息到独立的存储
  if (exportState.fileList && exportState.fileList.length > 0) {
    await chrome.storage.local.set({
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
    const result = await chrome.storage.local.get(['exportState', 'fileInfo', 'totalFiles']);
    if (result.exportState) {
      // 合并加载的状态，以防将来添加新属性
      Object.assign(exportState, result.exportState);
      
      // 如果没有文件列表但有存储的文件信息，则恢复它
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

// Service Worker 启动时，加载状态并检查是否需要恢复任务
(async () => {
  await loadState();
  if (exportState.isExporting && !exportState.isPaused) {
    sendLog('检测到中断的导出任务，正在恢复...');
    exportFiles(); // 恢复导出流程
  }
})();

// Listen for download filename suggestions
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  if (pendingRenames.has(downloadItem.id)) {
    const filename = pendingRenames.get(downloadItem.id);
    suggest({ filename: filename, conflictAction: 'uniquify' });
    pendingRenames.delete(downloadItem.id);
  }
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getFileInfo') {
    sendLog('后台收到 getFileInfo 请求');
    handleGetFileInfo(sendResponse);
    return true; // 保持消息通道开放以进行异步响应
  } else if (message.action === 'startExport') {
    sendLog('后台收到 startExport 请求');
    handleStartExport(message.data, sendResponse);
    return true;
  } else if (message.action === 'togglePause') {
    sendLog('后台收到 togglePause 请求');
    handleTogglePause(message.data);
    return false;
  } else if (message.action === 'getUiState') {
    sendResponse({ success: true, data: exportState });
    return false;
  } else if (message.action === 'retryFailedFiles') {
    sendLog('后台收到 retryFailedFiles 请求');
    handleRetryFailedFiles(sendResponse);
    return true;
  } else if (message.action === 'resetExport') {
    sendLog('后台收到 resetExport 请求');
    handleResetExport(sendResponse);
    return true;
  }
  return false;
});

// 新增：处理取消并重置任务的请求
async function handleResetExport(sendResponse) {
  sendLog('正在取消所有任务并清除状态...');
  
  exportState.isExporting = false;
  exportState.isPaused = false;
  
  // Abort any in-flight fetch requests
  abortController.abort();
  // Create a new controller for any subsequent operations
  abortController = new AbortController();

  pendingRenames.clear();

  // 使用深拷贝重置为默认状态
  exportState = JSON.parse(JSON.stringify(defaultState));
  
  // Overwrite the storage with the clean, default state.
  await chrome.storage.local.set({ exportState });
  
  // DO NOT log a confirmation message here. The reset state must be pristine.
  // The user action of closing the popup is sufficient confirmation.
  sendResponse({ success: true, data: exportState });
}

// 在 handleStartExport 之前，先设置 cookie
async function syncAllShimoCookies() {
  sendLog('开始同步所有 shimo.im cookies...');
  
  // 1. 获取 shimo.im 域下的所有 cookies
  const cookies = await chrome.cookies.getAll({ domain: 'shimo.im' });
  sendLog(`找到了 ${cookies.length} 个 cookies 来同步`);

  if (cookies.length === 0) {
      sendLog('警告: 未能从 shimo.im 域获取任何 cookies。请确保您已在该网站登录。');
      return;
  }

  // 增加调试日志，查看找到的cookie详情
  for (const cookie of cookies) {
    sendLog(`  -> 发现 Cookie: Name=${cookie.name}, Domain=${cookie.domain}`);
  }

  // 2. 遍历并精确地重新设置它们
  for (const cookie of cookies) {
    // 构造一个新的 cookie 对象以进行设置
    const newCookie = {
      url: 'https://shimo.im' + (cookie.path || '/'), // URL 必须与 cookie 的作用域匹配
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite
    };

    // 如果它是一个域 cookie (而不是 host-only)，则指定该域
    // 这保留了 host-only 的状态
    if (!cookie.hostOnly) {
      newCookie.domain = cookie.domain;
    }

    // 如果 cookie 有过期日期且不是会话 cookie
    if (cookie.expirationDate && !cookie.session) {
      newCookie.expirationDate = cookie.expirationDate;
    }
    
    try {
      await chrome.cookies.set(newCookie);
    } catch (error) {
      sendLog(`  设置 cookie: ${newCookie.name} 失败: ${error.message}`);
    }
  }
  
  sendLog('所有 shimo.im cookies 同步完成。');
  await new Promise(r => setTimeout(r, 200)); // 等待 cookie 操作生效
}

// 新：处理获取文件信息的请求
async function handleGetFileInfo(sendResponse) {
  try {
    sendLog('步骤 1: 开始同步 Cookies...');
    await syncAllShimoCookies();
    sendLog('步骤 1: Cookies 同步完成。');

    sendLog('步骤 2: 获取 shimo_sid...');
    const sidCookie = await chrome.cookies.get({ url: 'https://shimo.im', name: 'shimo_sid' });
    if (!sidCookie) {
      throw new Error('未能获取 shimo_sid，请确保已登录石墨。');
    }
    sendLog(`步骤 2: 获取到 shimo_sid: ${sidCookie.value}`);

    sendLog('步骤 3: 开始获取文件列表 (同时验证登录状态)...');
    const rawFileList = await getAllFiles();
    if (rawFileList.length === 0) {
      throw new Error('获取文件列表失败，请确保已登录石墨。');
    }

    // Initialize each file with a 'pending' status
    exportState.fileList = rawFileList.map(file => ({ ...file, status: 'pending' }));
    exportState.totalFiles = exportState.fileList.length;
    exportState.currentFileIndex = 0; // Always start from the beginning

    await saveState(); // 立即保存状态
    sendLog(`步骤 3: 成功获取 ${exportState.totalFiles} 个文件。`);

    sendLog('任务成功，向 popup 发送成功响应。');
    sendResponse({ success: true, data: exportState });
  } catch (error) {
    let errorMessage = `后台错误: ${error.message}`;
    if (error.message.includes('401')) {
        errorMessage = '登录凭据无效或已过期，请重新登录石墨。';
    } else if (error.message.includes('403')) {
        errorMessage = '无权访问文件列表，请检查账号权限。';
    }
    sendLog(`获取文件信息时出错: ${error.stack}`);
    sendResponse({ success: false, error: errorMessage });
  }
}

// 更新：处理开始导出的请求
async function handleStartExport(data, sendResponse) {
  if (exportState.fileList.length === 0) {
    sendResponse({ success: false, error: '文件列表为空，请先获取文件信息。' });
    return;
  }
  
  const settings = await chrome.storage.local.get(['subfolder']);

  exportState.isExporting = true;
  exportState.isPaused = false;
  exportState.currentFileIndex = 0;
  exportState.exportType = data.exportType;
  exportState.subfolder = settings.subfolder || '';
  exportState.logs = []; // 每次全新开始时清空日志
  
  // Reset statuses for a fresh start, ensuring all files are ready to be processed.
  exportState.fileList.forEach(file => {
    if (file.status !== 'success') {
      file.status = 'pending';
    }
  });

  await saveState(); // 保存初始状态
  sendResponse({ success: true });

  // Create a new AbortController for the new export session
  abortController = new AbortController();

  // 在后台开始导出，不阻塞 popup
  exportFiles();
}

// 处理暂停/继续
async function handleTogglePause(data) {
  if (!exportState.isExporting) {
    sendLog('收到继续/暂停信号，但没有任务在运行。将强制同步UI。');
    sendComplete(); // This triggers a full UI re-sync
    return;
  }

  exportState.isPaused = data.isPaused;
  sendLog(exportState.isPaused ? '导出已暂停' : '导出已继续');
  await saveState(); // 保存状态

  // CRITICAL FIX: Do NOT start a new exportFiles() loop here.
  // The existing, suspended loop will automatically resume when isPaused becomes false.
}

// 获取所有文件列表
async function getAllFiles() {
  const allFiles = [];
  
  async function fetchFiles(folderId = '', currentPath = '') {
    const url = folderId 
      ? SHIMO_API.LIST.replace('%s', folderId) 
      : SHIMO_API.ROOT;

    try {
      // We don't need the shimoSid here as makeRequest will handle cookies
      const response = await makeRequest(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const files = await response.json();
      
      for (const file of files) {
        // Sanitize the name to make it a valid path component
        const sanitizedName = sanitizePathComponent(file.name);

        if (file.type === 'folder') {
          const newPath = currentPath ? `${currentPath}/${sanitizedName}` : sanitizedName;
          await fetchFiles(file.guid, newPath);
        } else {
          allFiles.push({
            id: file.guid,
            title: file.name, // Keep original title for logs
            type: file.type,
            folderPath: currentPath // Store the path of the containing folder
          });
        }
      }
    } catch (error) {
      sendLog(`获取文件夹内容失败 (ID: ${folderId}): ${error.message}`);
      // 新增：如果是未登录、401、403等关键字，抛出到外层处理
      if (
        error.message.includes('401') ||
        error.message.includes('403') ||
        error.message.includes('未登录')
      ) {
        throw new Error('未能获取 shimo_sid，请确保已登录石墨。');
      }
      // Don't re-throw, just log and continue, so one bad folder doesn't stop everything.
    }
  }

  await fetchFiles();
  return allFiles;
}

// 更严格的文件名/文件夹名清理函数
function sanitizePathComponent(name) {
  if (!name) return '';
  // Replace path separators and other illegal characters with an underscore
  const sanitized = name.replace(/[\\/<>:"|?*]/g, '_');
  // 移除所有首尾空格和点
  return sanitized.trim().replace(/^\.+|\.+$/g, '');
}

// 导出文件
async function exportFiles() {
  try {
    const filesToProcess = exportState.fileList;
    const totalCount = filesToProcess.length;

    for (let i = exportState.currentFileIndex; i < totalCount; i++) {
      if (!exportState.isExporting) {
        sendLog('导出循环在开始时检测到中止信号。');
        return;
      }
      
      const file = filesToProcess[i];
      exportState.currentFileIndex = i;

      // Main guard: Only process files that are pending.
      // 'failed' files are handled by the retry mechanism which resets them to 'pending'.
      if (file.status !== 'pending') {
        sendLog(`跳过文件 (${file.status}): ${file.title}`);
        continue;
      }
      
      // Lock the file by changing its status and saving immediately
      file.status = 'in_progress';
      file.startTime = Date.now();
      file.retryCount = 0;
      file.exportUrl = '';
      file.downloadUrl = '';
      await saveState();
      sendLog(`(进度 ${i + 1}/${totalCount}) 开始处理: ${file.title}`);

      // --- 单个文件处理，包含重试逻辑 ---
      try {
        const MAX_RETRIES = 1;
        let success = false;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              sendLog(`重试中 (${attempt}/${MAX_RETRIES}): ${file.title}`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            file.retryCount = attempt;
            
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
            if (error.name === 'AbortError') {
              sendLog('网络请求被用户中止，立即停止导出循环。');
              return; // Exit exportFiles() immediately.
            }
            if (error.isRateLimit) throw error;
            
            sendLog(`导出失败 (尝试 ${attempt + 1}): ${file.title} - ${error.message}`);
          }
        }

        if (!success) {
          file.status = 'failed';
          sendLog(`所有重试均失败，将 ${file.title} 标记为失败。`);
        }
      } catch (error) {
        if (error.isRateLimit) {
          sendLog('检测到服务器速率限制 (429)。将中止所有剩余任务。');
          
          // Mark the current file and all other pending files as 'failed'
          file.endTime = Date.now(); // Set metrics for the file that triggered the limit
          file.duration = file.endTime - file.startTime;
          exportState.fileList.forEach(f => {
              if (f.status === 'pending' || f.status === 'in_progress') {
                  f.status = 'failed';
              }
          });

          // Stop the export process
          exportState.isExporting = false;
          exportState.isPaused = false;

          // Save the final state and notify UI
          await saveState();
          sendComplete();

          // Exit the function entirely to stop the loop
          return;
        } else {
          file.status = 'failed';
          sendLog(`意外错误，将 ${file.title} 标记为失败: ${error.message}`);
        }
      } finally {
        if (file.status !== 'success') {
          file.endTime = Date.now();
          file.duration = file.endTime - file.startTime;
        }
        await saveState();
      }
      
      const delay = 3000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    if (!exportState.isExporting) {
      sendLog('导出被重置，跳过完成步骤。');
      return;
    }

    exportState.isExporting = false;
    
    const failedCount = exportState.fileList.filter(f => f.status === 'failed').length;
    if (failedCount > 0) {
      sendLog(`导出流程完成，但有 ${failedCount} 个文件失败。`);
    } else {
      sendLog('所有文件均已成功导出！');
    }

    await saveState();
    sendComplete();
  } catch (error) {
    if (error.name === 'AbortError') {
      sendLog('捕获到中止信号，导出流程已完全终止。');
      // Function exits, no more processing.
    } else {
      // Handle other critical, unexpected errors
      sendLog(`导出流程因意外错误而终止: ${error.message}`);
      exportState.isExporting = false;
      await saveState();
    }
  }
}

async function getExportTaskId(file) {
  const url = SHIMO_API.EXPORT.replace('%s', file.id).replace('%s', exportState.exportType);
  file.exportUrl = url;
  
  const response = await makeRequest(url);

  if (!response.ok) {
    throw new Error(`获取导出任务失败: HTTP ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.taskId) {
    throw new Error('未获取到导出任务ID');
  }

  return data.taskId;
}

// 等待导出完成
async function waitForExportComplete(taskId, file) {
  const maxAttempts = 5; // 最多尝试5次
  const baseDelay = 1000;   // 初始等待1秒
  const maxDelay = 16000;   // 最大等待时间为16秒

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check for pause or cancellation before each attempt
    if (exportState.isPaused) {
      sendLog('导出已暂停，等待继续...');
      while (exportState.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Also check for cancellation while paused
        if (!exportState.isExporting) {
            sendLog('Export cancelled during pause.');
            return null;
        }
      }
      sendLog('导出已继续，恢复轮询...');
    }

    if (!exportState.isExporting) {
      sendLog('Export cancelled during polling.');
      return null;
    }

    const url = SHIMO_API.QUERY.replace('%s', taskId);
    const response = await makeRequest(url, exportState.shimoSid);

    // Add a final check after the network request returns
    if (!exportState.isExporting) {
      sendLog('Export cancelled immediately after network request.');
      return null;
    }

    if (response.status === 429) {
      const error = new Error(`API rate limit exceeded: HTTP 429`);
      sendLog(`查询导出进度失败: ${error.message}`);
      return null;
    }

    if (!response.ok) {
      // 如果查询API本身就失败了，直接抛出错误
      throw new Error(`查询导出进度失败: HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status === 0 && data.data && data.data.downloadUrl) {
      file.downloadUrl = data.data.downloadUrl;
      return data.data.downloadUrl;
    }

    // 如果是最后一次尝试，则不继续等待
    if (attempt === maxAttempts - 1) {
      break;
    }

    // 指数退避 + 随机抖动
    // 计算延迟: 1s, 2s, 4s, 8s, 16s, 16s...
    let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    delay += Math.random() * 1000; // 增加最多1秒的随机抖动

    sendLog(`下次将在 ~${Math.round(delay/1000)}秒 后重试 (尝试 ${attempt + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  sendLog(`任务ID ${taskId} 导出超时。`);
  return null; // 返回 null 表示超时
}

// 下载文件
async function downloadFile(downloadUrl, file) {
  try {
    let fileName = sanitizePathComponent(file.title) || '无标题';
    fileName = `${fileName}.${exportState.exportType}`;

    const rootSubfolder = exportState.subfolder ? exportState.subfolder.replace(/[<>:"|?*]/g, '_') : '';
    const relativeFolderPath = file.folderPath || '';

    // Combine the parts to form the final path
    let finalDownloadPath = fileName;
    if (relativeFolderPath) {
      finalDownloadPath = `${relativeFolderPath}/${finalDownloadPath}`;
    }
    if (rootSubfolder) {
      finalDownloadPath = `${rootSubfolder}/${finalDownloadPath}`;
    }
    
    // Ensure the path is relative
    while (finalDownloadPath.startsWith('/') || finalDownloadPath.startsWith('\\')) {
      finalDownloadPath = finalDownloadPath.substring(1);
    }

    sendLog(`开始下载: ${finalDownloadPath}`);

    // This is the new, more efficient method.
    // We start the download and the onDeterminingFilename listener will handle the rename.
    const downloadId = await chrome.downloads.download({
      url: downloadUrl,
      saveAs: false,
      // The final filename is set in the listener to avoid issues with redirects
    });

    pendingRenames.set(downloadId, finalDownloadPath);
    sendLog(`下载任务已创建 (ID: ${downloadId})，等待重命名...`);

  } catch (error) {
    sendLog(`创建下载任务失败: ${error.message}`);
    throw error;
  }
}

// --- 通信辅助函数 ---

// 新增：一个安全的包装器，用于向 popup 发送消息
// 它可以处理 popup 关闭时发生的 "Receiving end does not exist" 错误
async function sendMessageToPopup(message) {
  try {
    // 检查是否有活动的接收者 (即 popup 是否打开)
    // 这是更优雅的方式，但 sendMessage 的 try-catch 更直接
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (error.message.includes('Receiving end does not exist')) {
      // 这是预期的行为：当popup关闭时，它无法接收消息。
      // 我们可以安全地忽略这个错误。
    } else {
      // 对于其他意外错误，我们仍然应该记录它们。
      // console.error(`向 popup 发送消息失败:`, message, error);
    }
  }
}

// 发送进度更新
function sendProgress() {
  const exportedCount = exportState.fileList.filter(f => f.status === 'success').length;
  sendMessageToPopup({
    action: 'exportProgress',
    data: {
      exportedFiles: exportedCount,
      totalFiles: exportState.totalFiles
    }
  });
}

// 发送日志并存储
function sendLog(message) {
  const timestampedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
  exportState.logs.push(timestampedMessage);

  // 保持日志数组的大小，避免无限增长
  if (exportState.logs.length > 200) {
    exportState.logs.shift(); // 移除最旧的日志
  }

  sendMessageToPopup({
    action: 'exportLog',
    data: { message: timestampedMessage }
  });
}

// 发送错误
function sendError(error) {
  sendMessageToPopup({
    action: 'exportError',
    data: { error: error }
  });
}

// 发送完成消息
function sendComplete() {
  sendMessageToPopup({
    action: 'exportComplete'
  });
}

// 新增：处理重试失败文件的请求
async function handleRetryFailedFiles(sendResponse) {
    if (exportState.isExporting) {
        sendResponse({ success: false, error: '当前有任务在进行中，请稍后再试。'});
        return;
    }

    const failedFiles = exportState.fileList.filter(file => file.status === 'failed');
    if (failedFiles.length === 0) {
        sendResponse({ success: false, error: '没有失败的文件可以重试。' });
        return;
    }

    sendLog(`准备重试 ${failedFiles.length} 个失败的文件...`);

    // Reset status of failed files to pending
    exportState.fileList.forEach(file => {
      if (file.status === 'failed') {
        file.status = 'pending';
      }
    });

    // 准备状态以进行重试
    exportState.isExporting = true;
    exportState.isPaused = false;
    exportState.currentFileIndex = 0; // Start from the beginning
    exportState.subfolder = (await chrome.storage.local.get('subfolder')).subfolder || '';
    exportState.logs = []; // 为重试运行清空日志
    
    // Create a new AbortController for the new export session
    abortController = new AbortController();
    
    await saveState();
    sendResponse({ success: true });

    exportFiles();
}