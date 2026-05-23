// 引入浏览器兼容层
const browser = browserCompat;

// 全局变量
let isExporting = false;
let isPaused = false;
let fileInfo = null; // 存储从后台获取的文件信息
let totalFiles = 0; // 缓存文件总数
const START_BUTTON_DEFAULT_TEXT = '🚀 开始导出';
const START_BUTTON_DONE_TEXT = '🎉导出完成';

// DOM 元素 (在 DOMContentLoaded 中分配)
let exportTypeSelect, getInfoBtn, fileInfoDiv, totalFilesSpan, teamFilesSpan, startBtn, pauseBtn, 
    retrySection, retryFailedBtn, failedList, progressBar, 
    progressFill, progressText, statusDiv, logContainer, resetBtn,
    settingsBtn, loginBtn, sponsorBtn, sponsorModal, sponsorModalClose, mainContainer;
let statusHideTimer = null;
let sponsorHoverTimeout = null;

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
  // 分配 DOM 元素
  exportTypeSelect = document.getElementById('exportType');
  getInfoBtn = document.getElementById('getInfo');
  fileInfoDiv = document.getElementById('fileInfo');
  totalFilesSpan = document.getElementById('totalFiles');
  teamFilesSpan = document.getElementById('teamFiles');
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
  resetBtn = document.getElementById('reset-btn');
  settingsBtn = document.getElementById('settings-btn');
  loginBtn = document.getElementById('login-btn');
  sponsorBtn = document.getElementById('sponsor-btn');
  sponsorModal = document.getElementById('sponsorModal');
  sponsorModalClose = document.getElementById('sponsorModalClose');
  mainContainer = document.querySelector('.container');
  setStartButtonLabel(START_BUTTON_DEFAULT_TEXT);

  // 从存储中恢复UI设置和状态
  try {
    const result = await browser.storage.local.get(['exportType']);
    if (result.exportType) {
      exportTypeSelect.value = result.exportType;
    } else {
      exportTypeSelect.value = 'auto';
    }
    
    const response = await browser.runtime.sendMessage({ action: 'getUiState' });
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
    browser.runtime.openOptionsPage();
  });
  loginBtn.addEventListener('click', async () => {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getUserInfo' });
      if (response && response.success) {
        browser.tabs.create({ url: 'https://shimo.im' });
      } else {
        browser.tabs.create({ url: 'https://shimo.im/loginByPassword?from=home' });
      }
    } catch (error) {
      browser.tabs.create({ url: 'https://shimo.im/loginByPassword?from=home' });
    }
  });
  if (sponsorBtn) {
    sponsorBtn.addEventListener('click', () => toggleSponsorModal(true));
    sponsorBtn.addEventListener('mouseenter', handleSponsorHoverEnter);
    sponsorBtn.addEventListener('mouseleave', handleSponsorHoverLeave);
  }
  if (sponsorModalClose) {
    sponsorModalClose.addEventListener('click', () => toggleSponsorModal(false));
  }
  if (sponsorModal) {
    sponsorModal.addEventListener('click', (event) => {
      if (event.target === sponsorModal) {
        toggleSponsorModal(false);
      }
    });
    sponsorModal.addEventListener('mouseenter', clearSponsorHoverTimeout);
    sponsorModal.addEventListener('mouseleave', handleSponsorHoverLeave);
  }
  if (retryFailedBtn) {
    retryFailedBtn.addEventListener('click', handleRetryFailed);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sponsorModal && sponsorModal.classList.contains('is-visible')) {
      toggleSponsorModal(false);
    }
  });
  
  // 增强下拉框交互效果
  enhanceSelectInteraction();
  initRatingModal();
});

function syncUiWithState(state) {
  if (!state) return;

  isExporting = state.isExporting;
  isPaused = state.isPaused;
  totalFiles = state.totalFiles;

  if (state.fileList && state.fileList.length > 0) {
    fileInfo = { totalFiles: state.totalFiles, fileList: state.fileList };
    totalFilesSpan.textContent = state.totalFiles;
    updateTeamFilesCount(state.fileList);
    fileInfoDiv.style.display = 'block';
  } else {
    fileInfo = null;
    updateTeamFilesCount([]);
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
    const response = await browser.runtime.sendMessage({ action: 'getFileInfo' });
    if (response && response.success) {
      showStatus('文件信息获取成功！', 'success');
      addLog(`成功找到 ${response.data.totalFiles} 个文件。`);
      syncUiWithState({ ...response.data, isExporting: false, isPaused: false });
      setStartButtonLabel(START_BUTTON_DEFAULT_TEXT);
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
    if (error.message.includes('请确保已登录石墨') || error.message.includes('登录')) {
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
    const response = await browser.runtime.sendMessage({
      action: 'startExport',
      data: { 
        exportType: exportTypeSelect.value
      }
    });
    if (!response.success) throw new Error(response.error);
    
    const uiState = await browser.runtime.sendMessage({ action: 'getUiState' });
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

  browser.runtime.sendMessage({
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
    const response = await browser.runtime.sendMessage({ action: 'resetExport' });
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
    button.className = 'btn'; // Reset to base class first
    button.classList.add(className);
    const labelSpan = button.querySelector('span');
    if (labelSpan) {
      labelSpan.textContent = text;
    } else {
      button.textContent = text;
    }
}

function setStartButtonLabel(text = START_BUTTON_DEFAULT_TEXT) {
  if (!startBtn) return;
  const labelSpan = startBtn.querySelector('span');
  if (labelSpan) {
    labelSpan.textContent = text;
  }
}

// 检查是否可以弹出悬浮弹窗（一天最多2次）
async function canShowHoverPopup() {
  try {
    const today = new Date().toISOString().split('T')[0]; // 格式：YYYY-MM-DD
    const result = await browser.storage.local.get(['sponsorHoverPopup']);
    
    if (!result.sponsorHoverPopup || result.sponsorHoverPopup.date !== today) {
      // 新的一天，重置计数
      await browser.storage.local.set({
        sponsorHoverPopup: { date: today, count: 0 }
      });
      return true;
    }
    
    // 检查今天的弹出次数
    return result.sponsorHoverPopup.count < 2;
  } catch (error) {
    return false; // 出错时不允许弹出，避免影响用户体验
  }
}

// 增加悬浮弹窗计数
async function incrementHoverPopupCount() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await browser.storage.local.get(['sponsorHoverPopup']);
    
    if (!result.sponsorHoverPopup || result.sponsorHoverPopup.date !== today) {
      await browser.storage.local.set({
        sponsorHoverPopup: { date: today, count: 1 }
      });
    } else {
      await browser.storage.local.set({
        sponsorHoverPopup: { 
          date: today, 
          count: result.sponsorHoverPopup.count + 1 
        }
      });
    }
  } catch (error) {
    console.error('更新悬浮弹窗计数失败:', error);
  }
}

async function handleSponsorHoverEnter() {
  clearSponsorHoverTimeout();
  // 检查是否可以弹出悬浮弹窗
  const canShow = await canShowHoverPopup();
  if (canShow) {
    toggleSponsorModal(true);
    await incrementHoverPopupCount();
  }
}

function handleSponsorHoverLeave() {
  clearSponsorHoverTimeout();
  sponsorHoverTimeout = setTimeout(() => {
    toggleSponsorModal(false);
  }, 200);
}

function clearSponsorHoverTimeout() {
  if (sponsorHoverTimeout) {
    clearTimeout(sponsorHoverTimeout);
    sponsorHoverTimeout = null;
  }
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
  if (!statusDiv) return;
  
  const icons = {
    success: '🎉',
    error: '⚠️',
    info: 'ℹ️'
  };
  const icon = icons[type] || icons.info;

  statusDiv.textContent = `${icon} ${message}`;
  statusDiv.className = `status status-toast ${type || 'info'}`;
  statusDiv.style.display = 'block';

  requestAnimationFrame(() => {
    statusDiv.classList.add('is-visible');
  });

  if (statusHideTimer) {
    clearTimeout(statusHideTimer);
  }

  statusHideTimer = setTimeout(() => {
    statusDiv.classList.remove('is-visible');
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 300);
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
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
      showRatingModalAfterExport();
      setStartButtonLabel(START_BUTTON_DONE_TEXT);
      isExporting = false;
      // 从后台获取最终状态，以显示可能的失败文件
      browser.runtime.sendMessage({ action: 'getUiState' }).then(response => {
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

function updateTeamFilesCount(fileList = []) {
  if (!teamFilesSpan) return;
  const list = Array.isArray(fileList) ? fileList : [];
  const teamCount = list.filter(file => {
    const folderPath = file && typeof file.folderPath === 'string' ? file.folderPath : '';
    return folderPath.startsWith('团队空间');
  }).length;
  teamFilesSpan.textContent = teamCount;
}


// 保存设置和状态到存储
function saveSettings() {
  browser.storage.local.set({
    exportType: exportTypeSelect.value
  });
}

function toggleSponsorModal(shouldShow) {
  if (!sponsorModal) return;
  if (shouldShow) {
    sponsorModal.classList.add('is-visible');
    sponsorModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    if (mainContainer) {
      mainContainer.setAttribute('inert', '');
    }
    setTimeout(() => {
      sponsorModalClose?.focus();
    }, 0);
  } else {
    if (mainContainer) {
      mainContainer.removeAttribute('inert');
    }
    document.body.classList.remove('modal-open');
    if (sponsorBtn) {
      sponsorBtn.focus();
    } else if (mainContainer) {
      mainContainer.focus();
    }
    sponsorModal.classList.remove('is-visible');
    sponsorModal.setAttribute('aria-hidden', 'true');
    sponsorModalClose?.blur();
  }
}

// 增强下拉框交互效果
let customSelectInitialized = false;

function enhanceSelectInteraction() {
  const selectContainer = document.querySelector('.select-container');
  const select = document.getElementById('exportType');
  const selectTrigger = document.getElementById('exportTypeTrigger');
  const selectOptionsList = document.getElementById('exportTypeOptions');
  const selectIcon = document.getElementById('exportTypeIcon');
  const selectLabel = document.getElementById('exportTypeSelectedValue');
  
  if (!selectContainer || !select) return;

  const updateSelectionState = () => {
    if (select.value) {
      selectContainer.classList.add('has-selection');
    } else {
      selectContainer.classList.remove('has-selection');
    }
    updateExportTypeIcon();
  };

  const updateExportTypeIcon = () => {
    if (!select) return;
    const selectedOption = select.selectedOptions?.[0] || select.options[select.selectedIndex];
    const iconSrc = selectedOption?.dataset?.icon;
    const optionText = selectedOption?.textContent?.trim() || '导出格式';

    if (selectIcon) {
      if (iconSrc) {
        selectIcon.src = iconSrc;
        selectIcon.alt = `${optionText} 图标`;
        selectIcon.classList.add('is-visible');
        selectIcon.style.display = '';
      } else {
        selectIcon.classList.remove('is-visible');
        selectIcon.style.display = 'none';
      }
    }

    if (selectContainer) {
      selectContainer.classList.toggle('has-icon', Boolean(iconSrc));
    }

    if (selectLabel && selectedOption) {
      selectLabel.textContent = optionText;
    }

    updateCustomOptionsState();
  };

  const updateCustomOptionsState = () => {
    if (!selectOptionsList || !select) return;
    const currentValue = select.value;
    selectOptionsList.querySelectorAll('.select-option-item').forEach(item => {
      const isActive = item.dataset.value === currentValue;
      item.classList.toggle('is-active', isActive);
      const button = item.querySelector('.select-option-button');
      if (button) {
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
    });
  };

  const buildCustomSelectOptions = () => {
    if (!select || !selectOptionsList) return;
    selectOptionsList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    Array.from(select.options).forEach(option => {
      const li = document.createElement('li');
      li.className = 'select-option-item';
      li.dataset.value = option.value;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'select-option-button';
      button.dataset.value = option.value;
      button.setAttribute('role', 'option');
      button.tabIndex = -1;

      if (option.dataset.icon) {
        const img = document.createElement('img');
        img.src = option.dataset.icon;
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.onerror = function() {
          this.style.display = 'none';
        };
        button.appendChild(img);
      }

      const text = document.createElement('span');
      text.textContent = option.textContent.trim();
      button.appendChild(text);

      button.addEventListener('click', () => {
        if (select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          updateExportTypeIcon();
        }
        closeCustomDropdown({ restoreFocus: true });
      });

      li.appendChild(button);
      fragment.appendChild(li);
    });

    selectOptionsList.appendChild(fragment);
    updateCustomOptionsState();
  };

  const toggleCustomDropdown = () => {
    if (!selectContainer) return;
    if (selectContainer.classList.contains('is-open')) {
      closeCustomDropdown({ restoreFocus: true });
    } else {
      openCustomDropdown();
    }
  };

  const openCustomDropdown = () => {
    if (!selectContainer || !selectTrigger || !selectOptionsList) return;
    if (selectContainer.classList.contains('is-open')) return;
    selectContainer.classList.add('is-open');
    selectContainer.closest('.form-group')?.classList.add('is-select-open');
    selectTrigger.setAttribute('aria-expanded', 'true');
    const activeBtn =
      selectOptionsList.querySelector('.select-option-item.is-active .select-option-button') ||
      selectOptionsList.querySelector('.select-option-button');
    setTimeout(() => {
      activeBtn?.focus();
    }, 0);
  };

  const closeCustomDropdown = ({ restoreFocus = false } = {}) => {
    if (!selectContainer || !selectTrigger) return;
    const wasOpen = selectContainer.classList.contains('is-open');
    selectContainer.classList.remove('is-open');
    selectContainer.closest('.form-group')?.classList.remove('is-select-open');
    selectTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && wasOpen) {
      selectTrigger.focus();
    }
  };

  const handleSelectOutsideClick = (event) => {
    if (!selectContainer?.classList.contains('is-open')) return;
    if (!selectContainer.contains(event.target)) {
      closeCustomDropdown();
    }
  };

  const handleTriggerKeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleCustomDropdown();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openCustomDropdown();
      focusRelativeOption(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeCustomDropdown({ restoreFocus: true });
    }
  };

  const handleOptionsKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCustomDropdown({ restoreFocus: true });
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusRelativeOption(event.key === 'ArrowDown' ? 1 : -1);
    }
  };

  const focusRelativeOption = (step) => {
    if (!selectOptionsList) return;
    const buttons = Array.from(selectOptionsList.querySelectorAll('.select-option-button'));
    if (!buttons.length) return;
    const focusedIndex = buttons.indexOf(document.activeElement);
    let nextIndex = focusedIndex;
    if (nextIndex === -1) {
      const active =
        selectOptionsList.querySelector('.select-option-item.is-active .select-option-button') || buttons[0];
      nextIndex = buttons.indexOf(active);
    }
    nextIndex = (nextIndex + step + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  };

  if (!selectTrigger || !selectOptionsList) {
    updateSelectionState();
    return;
  }

  if (customSelectInitialized) {
    updateSelectionState();
    updateCustomOptionsState();
    return;
  }
  customSelectInitialized = true;

  selectTrigger.removeAttribute('hidden');
  selectOptionsList.removeAttribute('hidden');
  selectContainer.classList.add('is-enhanced');

  updateSelectionState();
  buildCustomSelectOptions();

  selectTrigger.addEventListener('click', (event) => {
    event.preventDefault();
    toggleCustomDropdown();
  });
  selectTrigger.addEventListener('keydown', handleTriggerKeydown);
  selectOptionsList.addEventListener('keydown', handleOptionsKeydown);
  document.addEventListener('click', handleSelectOutsideClick);

  select.addEventListener('change', () => {
    updateSelectionState();
    closeCustomDropdown();
  });
}

// ── Rating Modal ──

const REVIEW_URL = 'https://chromewebstore.google.com/detail/jdipfhjpijkdjbefbaehnimligdldhdp/reviews';
const RATING_SHOW_DELAY_MS = 2500;

function showRatingModalAfterExport() {
  setTimeout(async () => {
    const { ratingDismissed } = await browser.storage.local.get('ratingDismissed');
    if (ratingDismissed) return;
    toggleRatingModal(true);
  }, RATING_SHOW_DELAY_MS);
}

function initRatingModal() {
  const ratingModal = document.getElementById('ratingModal');
  const ratingModalClose = document.getElementById('ratingModalClose');
  const ratingReviewBtn = document.getElementById('ratingReviewBtn');
  const ratingDismissBtn = document.getElementById('ratingDismissBtn');
  const ratingLaterBtn = document.getElementById('ratingLaterBtn');
  const ratingSponsorLink = document.getElementById('ratingSponsorLink');

  if (!ratingModal) return;

  if (ratingReviewBtn) {
    ratingReviewBtn.addEventListener('click', () => {
      browser.tabs.create({ url: REVIEW_URL });
      toggleRatingModal(false);
    });
  }

  if (ratingDismissBtn) {
    ratingDismissBtn.addEventListener('click', () => {
      browser.storage.local.set({ ratingDismissed: true });
      toggleRatingModal(false);
    });
  }

  if (ratingLaterBtn) {
    ratingLaterBtn.addEventListener('click', () => {
      toggleRatingModal(false);
    });
  }

  if (ratingModalClose) {
    ratingModalClose.addEventListener('click', () => {
      toggleRatingModal(false);
    });
  }

  if (ratingSponsorLink) {
    ratingSponsorLink.addEventListener('click', () => {
      toggleRatingModal(false);
      setTimeout(() => toggleSponsorModal(true), 350);
    });
  }

  ratingModal.addEventListener('click', (e) => {
    if (e.target === ratingModal) toggleRatingModal(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ratingModal.classList.contains('is-visible')) {
      toggleRatingModal(false);
    }
  });
}

function toggleRatingModal(shouldShow) {
  const ratingModal = document.getElementById('ratingModal');
  if (!ratingModal) return;

  if (shouldShow) {
    ratingModal.removeAttribute('inert');
    ratingModal.classList.add('is-visible');
    document.body.classList.add('modal-open');
    if (mainContainer) mainContainer.setAttribute('inert', '');
  } else {
    if (mainContainer) mainContainer.removeAttribute('inert');
    document.body.classList.remove('modal-open');
    ratingModal.classList.remove('is-visible');
    setTimeout(() => { ratingModal.setAttribute('inert', ''); }, 300);
  }
}
