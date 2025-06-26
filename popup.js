// 全局变量
let isExporting = false;
let isPaused = false;
let fileInfo = null; // 存储从后台获取的文件信息
let totalFiles = 0; // 缓存文件总数

// DOM 元素 (在 DOMContentLoaded 中分配)
let exportTypeSelect, getInfoBtn, fileInfoDiv, totalFilesSpan, startBtn, pauseBtn, 
    retrySection, retryFailedBtn, failedList, progressBar, 
    progressFill, progressText, statusDiv, logContainer, resetBtn,
    settingsBtn;

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
  // 分配 DOM 元素
  exportTypeSelect = document.getElementById('exportType');
  getInfoBtn = document.getElementById('getInfo');
  fileInfoDiv = document.getElementById('fileInfo');
  totalFilesSpan = document.getElementById('totalFiles');
  startBtn = document.getElementById('startExport');
  pauseBtn = document.getElementById('pauseExport');
  retrySection = document.getElementById('retrySection');
  retryFailedBtn = document.getElementById('retryFailedBtn');
  failedList = document.getElementById('failedList');
  progressBar = document.getElementById('progressBar');
  progressFill = document.getElementById('progressFill');
  progressText = document.getElementById('progressText');
  statusDiv = document.getElementById('status');
  logContainer = document.getElementById('logContainer');
  resetBtn = document.getElementById('resetBtn');
  settingsBtn = document.getElementById('settingsBtn');

  // 从存储中恢复UI设置和状态
  try {
    const result = await chrome.storage.local.get(['exportType']);
    if (result.exportType) {
      exportTypeSelect.value = result.exportType;
    }
    
    const response = await chrome.runtime.sendMessage({ action: 'getUiState' });
    if (response && response.success) {
      syncUiWithState(response.data);
    }
  } catch (error) {
    addLog('恢复之前的状态失败，请重新获取文件信息。');
  }

  // 绑定事件
  getInfoBtn.addEventListener('click', handleGetFileInfo);
  startBtn.addEventListener('click', handleStart);
  pauseBtn.addEventListener('click', handlePause);
  exportTypeSelect.addEventListener('change', saveSettings);
  resetBtn.addEventListener('click', handleReset);
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  if (retryFailedBtn) {
    retryFailedBtn.addEventListener('click', handleRetryFailed);
  }
});

function syncUiWithState(state) {
  if (!state) return;

  isExporting = state.isExporting;
  isPaused = state.isPaused;
  totalFiles = state.totalFiles;

  if (state.fileList && state.fileList.length > 0) {
    fileInfo = { totalFiles: state.totalFiles, fileList: state.fileList };
    totalFilesSpan.textContent = state.totalFiles;
    fileInfoDiv.style.display = 'block';
  } else {
    fileInfo = null;
    fileInfoDiv.style.display = 'none';
  }
  
  getInfoBtn.disabled = isExporting;
  exportTypeSelect.disabled = isExporting;

  if (isExporting) {
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    progressBar.style.display = 'block';
    logContainer.style.display = 'block';
    retrySection.style.display = 'none';

    if (isPaused) {
      setButtonState(pauseBtn, '继续导出', 'btn-continue');
    } else {
      setButtonState(pauseBtn, '暂停导出', 'btn-pause');
    }
    
    const exportedCount = state.fileList.filter(f => f.status === 'success').length;
    updateProgress(exportedCount, state.totalFiles);
  } else {
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    startBtn.disabled = !fileInfo;

    if (state.failedFiles && state.failedFiles.length > 0) {
      retrySection.style.display = 'block';
      if (failedList) {
        failedList.innerHTML = '<strong>失败的文件:</strong>';
        const ul = document.createElement('ul');
        state.failedFiles.forEach(file => {
          const li = document.createElement('li');
          li.textContent = file.title;
          ul.appendChild(li);
        });
        failedList.appendChild(ul);
      }
    } else {
      retrySection.style.display = 'none';
    }

    if (!fileInfo) {
       progressBar.style.display = 'none';
    }
  }

  if (state.logs && state.logs.length > 0) {
    logContainer.innerHTML = '';
    state.logs.forEach(log => {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      logEntry.textContent = log;
      logContainer.appendChild(logEntry);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

async function handleGetFileInfo() {
  getInfoBtn.disabled = true;
  getInfoBtn.textContent = '获取中...';
  showStatus('正在获取文件信息，请稍候...', 'info');
  logContainer.style.display = 'block';
  addLog('开始获取文件信息...');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getFileInfo' });
    if (response && response.success) {
      showStatus('文件信息获取成功！', 'success');
      addLog(`成功找到 ${response.data.totalFiles} 个文件。`);
      syncUiWithState({ ...response.data, isExporting: false, isPaused: false });
      // 恢复按钮
      getInfoBtn.textContent = '获取文件信息';
      getInfoBtn.disabled = false;
      getInfoBtn.onclick = null;
      getInfoBtn.removeAttribute('data-login');
    } else {
      throw new Error(response ? response.error : '未知错误');
    }
  } catch (error) {
    showStatus(`获取信息失败: ${error.message}`, 'error');
    addLog(`错误: ${error.message}`);
    // 检查特定错误
    if (error.message.includes('请确保已登录石墨')) {
      getInfoBtn.textContent = '点击跳转登录石墨文档';
      getInfoBtn.disabled = false;
      getInfoBtn.onclick = () => { window.open('https://shimo.im', '_blank'); };
      getInfoBtn.setAttribute('data-login', 'true');
    } else {
      getInfoBtn.textContent = '获取文件信息';
      getInfoBtn.disabled = false;
      getInfoBtn.onclick = null;
      getInfoBtn.removeAttribute('data-login');
    }
  }
}

async function handleStart() {
  if (!fileInfo || fileInfo.fileList.length === 0) {
    showStatus('请先获取文件信息', 'error');
    return;
  }

  showStatus('开始导出...', 'info');
  addLog('开始导出石墨文档...');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startExport',
      data: { 
        exportType: exportTypeSelect.value
      }
    });
    if (!response.success) throw new Error(response.error);
    
    const uiState = await chrome.runtime.sendMessage({ action: 'getUiState' });
    if (uiState.success) syncUiWithState(uiState.data);

  } catch (error) {
    showStatus('开始导出失败: ' + error.message, 'error');
    resetUiToIdle();
  }
}

async function handlePause() {
  isPaused = !isPaused;
  addLog(isPaused ? '导出已暂停' : '导出已继续');
  
  if (isPaused) {
    setButtonState(pauseBtn, '继续导出', 'btn-continue');
  } else {
    setButtonState(pauseBtn, '暂停导出', 'btn-pause');
  }

  chrome.runtime.sendMessage({
    action: 'togglePause',
    data: { isPaused: isPaused }
  });
}

function resetUiToIdle() {
    isExporting = false;
    isPaused = false;
    
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
    startBtn.disabled = !(fileInfo && fileInfo.fileList.length > 0);

    progressBar.style.display = 'none';
}

async function handleReset() {
  addLog('正在请求重置任务...');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'resetExport' });
    if (response && response.success) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      window.close();
    } else {
      throw new Error('重置操作未能成功。');
    }
  } catch (error) {
    showStatus(`重置失败: ${error.message}`, 'error');
    addLog(`重置失败: ${error.message}`);
  }
}

// 新增：设置按钮状态的辅助函数
function setButtonState(button, text, className) {
    if (!button) return;
    button.textContent = text;
    button.className = 'btn'; // Reset to base class first
    button.classList.add(className);
}

// 新增：处理重试失败文件的点击事件
async function handleRetryFailed() {
  if (!retryFailedBtn) return; // 安全卫士

  retryFailedBtn.disabled = true;
  retryFailedBtn.textContent = '重试中...';
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'retryFailedFiles' });
    if (response && response.success) {
      addLog('开始重试失败的文件...');
      // 重新同步UI到导出状态
      const newState = await chrome.runtime.sendMessage({ action: 'getUiState' });
      syncUiWithState(newState.data);
    } else {
      throw new Error(response.error || '未知的重试错误');
    }
  } catch(error) {
    showStatus(`重试失败: ${error.message}`, 'error');
    addLog(`重试失败: ${error.message}`);
  } finally {
    retryFailedBtn.disabled = false;
    retryFailedBtn.textContent = '重试失败的文件';
  }
}

// 显示状态信息
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  // 3秒后自动隐藏
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// 添加日志
function addLog(message) {
  // Clear placeholder on first log
  const placeholder = logContainer.querySelector('.log-placeholder');
  if (placeholder) {
    logContainer.innerHTML = '';
  }

  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  // 后台消息已经带了时间戳，这里只处理UI触发的日志
  const content = message.startsWith('[') ? message : `[${new Date().toLocaleTimeString()}] ${message}`;
  logEntry.textContent = content;
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// 监听来自 background script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'exportProgress':
      const exportedFiles = message.data.exportedFiles;
      totalFiles = message.data.totalFiles; // 确保totalFiles也同步
      updateProgress(exportedFiles, totalFiles);
      // 日志由 exportLog 单独处理
      break;
      
    case 'exportComplete':
      addLog('导出流程完成。');
      showStatus('导出完成！', 'success');
      isExporting = false;
      // 从后台获取最终状态，以显示可能的失败文件
      chrome.runtime.sendMessage({ action: 'getUiState' }).then(response => {
        if (response && response.success) {
          syncUiWithState(response.data);
        }
      });
      break;
      
    case 'exportError':
      addLog(`错误: ${message.data.error}`);
      showStatus('导出出错: ' + message.data.error, 'error');
      resetUiToIdle();
      break;
      
    case 'exportLog':
      addLog(message.data.message);
      break;
  }
});

function updateProgress(exported, total) {
  if (progressFill && progressText) {
    const percentage = total > 0 ? Math.round((exported / total) * 100) : 0;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${exported}/${total}`; // 更新居中的文本
  }
}

// 保存设置和状态到存储
function saveSettings() {
  chrome.storage.local.set({
    exportType: exportTypeSelect.value
  });
} 