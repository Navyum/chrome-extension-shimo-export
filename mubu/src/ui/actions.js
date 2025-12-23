import { domRefs } from './dom.js';
import { uiState, updateUiState } from './state.js';
import {
  addLog,
  resetUiToIdle,
  setButtonState,
  setStartButtonLabel,
  showStatus,
  syncUiWithState
} from './ui.js';
import { START_BUTTON_DEFAULT_TEXT } from './constants.js';

export async function handleGetFileInfo() {
  const { getInfoBtn, logContainer } = domRefs;
  if (!getInfoBtn) return;

  getInfoBtn.disabled = true;
  getInfoBtn.textContent = '获取中...';
  showStatus('正在获取文件信息，请稍候...', 'info');
  if (logContainer) {
    logContainer.style.display = 'block';
  }
  addLog('开始获取文件信息...');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getFileInfo' });
    if (response && response.success) {
      showStatus('文件信息获取成功！', 'success');
      addLog(`成功找到 ${response.data.totalFiles} 个文档。`);
      syncUiWithState({ ...response.data, isExporting: false, isPaused: false });
      setStartButtonLabel(START_BUTTON_DEFAULT_TEXT);
      restoreGetInfoButton();
    } else {
      throw new Error(response ? response.error : '未知错误');
    }
  } catch (error) {
    showStatus(`获取信息失败: ${error.message}`, 'error');
    addLog(`错误: ${error.message}`);
    handleGetInfoErrorState(error);
  }
}

export async function handleStart() {
  if (!uiState.fileInfo || !uiState.fileInfo.fileList || uiState.fileInfo.fileList.length === 0) {
    showStatus('请先获取文件信息', 'error');
    return;
  }

  const { exportTypeSelect } = domRefs;
  const exportType = exportTypeSelect ? exportTypeSelect.value : 'md';

  showStatus('开始导出...', 'info');
  addLog('开始导出幕布文档...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startExport',
      data: { exportType }
    });
    if (!response?.success) {
      throw new Error(response?.error || '未知错误');
    }

    const uiStateResponse = await chrome.runtime.sendMessage({ action: 'getUiState' });
    if (uiStateResponse?.success) {
      syncUiWithState(uiStateResponse.data);
    }
  } catch (error) {
    showStatus(`开始导出失败: ${error.message}`, 'error');
    resetUiToIdle();
  }
}

export function handlePause() {
  if (!uiState.isExporting) {
    addLog('没有正在进行的任务，忽略暂停/继续指令。');
    return;
  }

  const { pauseBtn } = domRefs;
  const nextPaused = !uiState.isPaused;
  updateUiState({ isPaused: nextPaused });

  addLog(nextPaused ? '导出已暂停' : '导出已继续');
  setButtonState(pauseBtn, nextPaused ? '继续导出' : '暂停导出', nextPaused ? 'btn-continue' : 'btn-pause');

  chrome.runtime.sendMessage({
    action: 'togglePause',
    data: { isPaused: nextPaused }
  });
}

export async function handleReset() {
  addLog('正在请求重置任务...');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'resetExport' });
    if (response && response.success) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      window.close();
      return;
    }
    throw new Error('重置操作未能成功。');
  } catch (error) {
    showStatus(`重置失败: ${error.message}`, 'error');
    addLog(`重置失败: ${error.message}`);
  }
}

export async function handleRetryFailed() {
  const { retryFailedBtn } = domRefs;
  if (!retryFailedBtn) return;

  retryFailedBtn.disabled = true;
  retryFailedBtn.textContent = '重试中...';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'retryFailedFiles' });
    if (response && response.success) {
      addLog('开始重试失败的文件...');
      const newState = await chrome.runtime.sendMessage({ action: 'getUiState' });
      if (newState?.success) {
        syncUiWithState(newState.data);
      }
    } else {
      throw new Error(response?.error || '未知错误');
    }
  } catch (error) {
    showStatus(`重试失败: ${error.message}`, 'error');
    addLog(`重试失败: ${error.message}`);
  } finally {
    retryFailedBtn.disabled = false;
    retryFailedBtn.textContent = '重试失败的文件';
  }
}

export function saveSettings() {
  const { exportTypeSelect } = domRefs;
  if (!exportTypeSelect) return;
  chrome.storage.local.set({
    exportType: exportTypeSelect.value
  });
}

function restoreGetInfoButton() {
  const { getInfoBtn } = domRefs;
  if (!getInfoBtn) return;
  getInfoBtn.textContent = '获取文件信息';
  getInfoBtn.disabled = false;
  getInfoBtn.onclick = null;
  getInfoBtn.removeAttribute('data-login');
}

function handleGetInfoErrorState(error) {
  const { getInfoBtn } = domRefs;
  if (!getInfoBtn) return;

  if (error.message.includes('幕布') || error.message.includes('登录')) {
    getInfoBtn.textContent = '点击跳转登录幕布';
    getInfoBtn.disabled = false;
    getInfoBtn.onclick = () => {
      window.open('https://mubu.com/login', '_blank');
    };
    getInfoBtn.setAttribute('data-login', 'true');
  } else {
    restoreGetInfoButton();
  }
}

