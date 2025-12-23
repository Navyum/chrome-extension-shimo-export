import { exportState, resetExportState, saveState } from './state.js';
import { sendLog, sendProgress, sendComplete, sendError } from './messaging.js';
import { fetchAllDocuments, fetchDocumentDefinition, getJwtTokenOrThrow } from './mubu.js';
import { buildExportPayload } from './formatters.js';
import { saveContentToDisk } from './downloads.js';
import { delay } from './utils.js';
import { refreshAbortController, abortActiveTasks } from './task-controller.js';

export function registerRuntimeHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'getFileInfo':
        handleGetFileInfo(sendResponse);
        return true;
      case 'startExport':
        handleStartExport(message.data, sendResponse);
        return true;
      case 'togglePause':
        handleTogglePause(message.data);
        return false;
      case 'getUiState':
        sendResponse({ success: true, data: exportState });
        return false;
      case 'retryFailedFiles':
        handleRetryFailedFiles(sendResponse);
        return true;
      case 'resetExport':
        handleResetExport(sendResponse);
        return true;
      default:
        return false;
    }
  });
}

export async function maybeResumeExport() {
  if (exportState.isExporting && !exportState.isPaused) {
    sendLog('检测到中断的导出任务，正在尝试恢复...');
    exportFiles();
  }
}

async function handleGetFileInfo(sendResponse) {
  try {
    const jwtToken = await getJwtTokenOrThrow();
    sendLog('开始获取幕布文件列表...');
    const { files, folderCount } = await fetchAllDocuments(jwtToken);

    if (files.length === 0) {
      throw new Error('未获取到任何文档，请确认账号下是否存在内容。');
    }

    exportState.fileList = files.map(file => ({ ...file, status: 'pending', localPath: '' }));
    exportState.totalFiles = files.length;
    exportState.folderCount = folderCount;
    exportState.currentFileIndex = 0;
    exportState.logs = [];

    await saveState();
    sendLog(`成功获取 ${files.length} 个文档，${folderCount} 个文件夹。`);
    sendResponse({ success: true, data: exportState });
  } catch (error) {
    const message = error.message.includes('Jwt-Token')
      ? '未检测到 Jwt-Token，请确认已在 https://mubu.com 登录后重试。'
      : error.message;
    sendLog(`获取文件信息失败: ${message}`);
    sendResponse({ success: false, error: message });
  }
}

async function handleStartExport(data, sendResponse) {
  if (!exportState.fileList.length) {
    sendResponse({ success: false, error: '文件列表为空，请先获取文件信息。' });
    return;
  }

  try {
    await getJwtTokenOrThrow(); // 提前校验
    const settings = await chrome.storage.local.get(['subfolder']);

    exportState.isExporting = true;
    exportState.isPaused = false;
    exportState.currentFileIndex = 0;
    exportState.exportType = data?.exportType || 'md';
    exportState.subfolder = settings.subfolder || '';
    exportState.logs = [];

    exportState.fileList.forEach(file => {
      if (file.status !== 'success') {
        file.status = 'pending';
      }
    });

    refreshAbortController();

    await saveState();
    sendResponse({ success: true });
    exportFiles();
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleRetryFailedFiles(sendResponse) {
  if (exportState.isExporting) {
    sendResponse({ success: false, error: '当前有任务正在运行，请先暂停或重置。' });
    return;
  }

  const failedFiles = exportState.fileList.filter(file => file.status === 'failed');
  if (!failedFiles.length) {
    sendResponse({ success: false, error: '没有失败的文件需要重试。' });
    return;
  }

  try {
    await getJwtTokenOrThrow();
    const settings = await chrome.storage.local.get(['subfolder']);

    exportState.fileList.forEach(file => {
      if (file.status === 'failed') {
        file.status = 'pending';
      }
    });

    exportState.isExporting = true;
    exportState.isPaused = false;
    exportState.currentFileIndex = 0;
    exportState.subfolder = settings.subfolder || '';
    exportState.logs = [];

    refreshAbortController();

    await saveState();
    sendResponse({ success: true });
    exportFiles();
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleResetExport(sendResponse) {
  abortActiveTasks();
  refreshAbortController();
  resetExportState();
  await saveState();
  sendResponse({ success: true, data: exportState });
}

async function handleTogglePause(data) {
  if (!exportState.isExporting) {
    sendLog('没有正在进行的任务，忽略暂停/继续指令。');
    return;
  }
  exportState.isPaused = data?.isPaused ?? false;
  sendLog(exportState.isPaused ? '导出已暂停。' : '导出已继续。');
  await saveState();
}

async function exportFiles() {
  try {
    const jwtToken = await getJwtTokenOrThrow();
    const filesToProcess = exportState.fileList;
    const totalCount = filesToProcess.length;

    for (let i = exportState.currentFileIndex; i < totalCount; i++) {
      if (!exportState.isExporting) {
        sendLog('导出流程已被取消。');
        return;
      }

      await waitIfPaused();

      const file = filesToProcess[i];
      exportState.currentFileIndex = i;

      if (file.status !== 'pending') {
        continue;
      }

      file.status = 'in_progress';
      file.startTime = Date.now();
      file.retryCount = 0;
      file.exportUrl = `mubu://${file.id}`;
      file.downloadUrl = '';
      await saveState();
      sendLog(`(进度 ${i + 1}/${totalCount}) 处理 ${file.title}...`);

      const MAX_RETRIES = 1;
      let success = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            sendLog(`重试第 ${attempt} 次: ${file.title}`);
            await delay(2000);
          }

          file.retryCount = attempt;
          const definition = await fetchDocumentDefinition(file.id, jwtToken);
          const exportPayload = buildExportPayload(definition, exportState.exportType, file);
          const savedPath = await saveContentToDisk(exportPayload, file);

          file.status = 'success';
          file.localPath = savedPath;
          file.endTime = Date.now();
          file.duration = file.endTime - file.startTime;
          sendLog(`导出完成: ${file.title} (耗时 ${(file.duration / 1000).toFixed(2)}s)`);
          sendProgress();
          success = true;
          break;
        } catch (error) {
          if (error.name === 'AbortError') {
            sendLog('检测到中止信号，结束导出流程。');
            return;
          }
          sendLog(`导出失败: ${file.title} -> ${error.message}`);
        }
      }

      if (!success) {
        file.status = 'failed';
        file.endTime = Date.now();
        file.duration = file.endTime - file.startTime;
        sendLog(`已将 ${file.title} 标记为失败。`);
      }

      await saveState();
      await delay(1200 + Math.random() * 800);
    }

    if (!exportState.isExporting) {
      sendLog('导出被外部中止，跳过收尾。');
      return;
    }

    exportState.isExporting = false;
    await saveState();

    const failedCount = exportState.fileList.filter(file => file.status === 'failed').length;
    if (failedCount > 0) {
      sendLog(`导出完成，但仍有 ${failedCount} 个文档失败。请稍后重试。`);
    } else {
      sendLog('所有幕布文档均已成功导出！');
    }

    sendComplete();
  } catch (error) {
    if (error.name === 'AbortError') {
      sendLog('导出流程已被重置。');
      return;
    }
    exportState.isExporting = false;
    await saveState();
    sendLog(`导出流程发生异常: ${error.message}`);
    sendError(error.message);
  }
}

async function waitIfPaused() {
  if (!exportState.isPaused) return;
  sendLog('导出已暂停，等待继续...');
  while (exportState.isPaused) {
    await delay(1000);
    if (!exportState.isExporting) {
      throw new Error('导出已被取消');
    }
  }
  sendLog('检测到继续指令，恢复导出。');
}

