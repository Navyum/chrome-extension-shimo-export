import { domRefs } from './dom.js';
import { uiState, updateUiState } from './state.js';
import { START_BUTTON_DEFAULT_TEXT, DEFAULT_EXPORT_TYPE } from './constants.js';

const STATUS_ICONS = {
  success: '🎉',
  error: '⚠️',
  info: 'ℹ️'
};

let statusHideTimer = null;
let customSelectInitialized = false;

export function syncUiWithState(state) {
  if (!state) return;

  const hasFileList = Array.isArray(state.fileList) && state.fileList.length > 0;
  const nextFileInfo = hasFileList
    ? {
        totalFiles: state.totalFiles,
        fileList: state.fileList,
        folderCount: state.folderCount || 0
      }
    : null;

  updateUiState({
    isExporting: Boolean(state.isExporting),
    isPaused: Boolean(state.isPaused),
    totalFiles: state.totalFiles || 0,
    fileInfo: nextFileInfo
  });

  const {
    getInfoBtn,
    exportTypeSelect,
    fileInfoDiv,
    totalFilesSpan,
    folderCountSpan,
    startBtn,
    pauseBtn,
    progressBar,
    logContainer,
    retrySection,
    failedList,
    progressFill,
    progressText
  } = domRefs;

  if (exportTypeSelect) {
    const targetExportType = state.exportType || DEFAULT_EXPORT_TYPE;
    if (exportTypeSelect.value !== targetExportType) {
      exportTypeSelect.value = targetExportType;
    }
    updateExportTypeIcon();
  }

  if (nextFileInfo) {
    if (totalFilesSpan) totalFilesSpan.textContent = nextFileInfo.totalFiles;
    if (folderCountSpan) folderCountSpan.textContent = nextFileInfo.folderCount || 0;
    if (fileInfoDiv) fileInfoDiv.style.display = 'block';
  } else {
    if (totalFilesSpan) totalFilesSpan.textContent = '0';
    if (folderCountSpan) folderCountSpan.textContent = '0';
    if (fileInfoDiv) fileInfoDiv.style.display = 'none';
  }

  if (getInfoBtn) getInfoBtn.disabled = uiState.isExporting;
  if (exportTypeSelect) exportTypeSelect.disabled = uiState.isExporting;

  if (uiState.isExporting) {
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'inline-block';
    if (progressBar) progressBar.style.display = 'block';
    if (logContainer) logContainer.style.display = 'block';
    if (retrySection) retrySection.style.display = 'none';

    if (uiState.isPaused) {
      setButtonState(pauseBtn, '继续导出', 'btn-continue');
    } else {
      setButtonState(pauseBtn, '暂停导出', 'btn-pause');
    }

    const exportedCount = hasFileList ? state.fileList.filter(f => f.status === 'success').length : 0;
    if (progressFill && progressText) {
      updateProgress(exportedCount, state.totalFiles);
    }
  } else {
    if (startBtn) {
      startBtn.style.display = 'inline-block';
      startBtn.disabled = !nextFileInfo;
    }
    if (pauseBtn) pauseBtn.style.display = 'none';

    if (state.failedFiles && state.failedFiles.length > 0 && retrySection && failedList) {
      retrySection.style.display = 'block';
      failedList.innerHTML = '<strong>失败的文件:</strong>';
      const ul = document.createElement('ul');
      state.failedFiles.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file.title;
        ul.appendChild(li);
      });
      failedList.appendChild(ul);
    } else if (retrySection) {
      retrySection.style.display = 'none';
    }

    if (!nextFileInfo && progressBar) {
      progressBar.style.display = 'none';
    }
  }

  if (state.logs && state.logs.length > 0 && logContainer) {
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

export function resetUiToIdle() {
  const { startBtn, pauseBtn, progressBar } = domRefs;

  updateUiState({ isExporting: false, isPaused: false });

  if (startBtn) {
    startBtn.style.display = 'inline-block';
    startBtn.disabled = !(uiState.fileInfo && uiState.fileInfo.fileList && uiState.fileInfo.fileList.length > 0);
  }
  if (pauseBtn) {
    pauseBtn.style.display = 'none';
  }
  if (progressBar) {
    progressBar.style.display = 'none';
  }
}

export function setButtonState(button, text, className) {
  if (!button) return;
  button.textContent = text;
  button.className = 'btn';
  if (className) {
    button.classList.add(className);
  }
}

export function setStartButtonLabel(text = START_BUTTON_DEFAULT_TEXT) {
  const { startBtn } = domRefs;
  if (!startBtn) return;
  const labelSpan = startBtn.querySelector('span');
  if (labelSpan) {
    labelSpan.textContent = text;
  }
}

export function showStatus(message, type = 'info') {
  const { statusDiv } = domRefs;
  if (!statusDiv) return;

  const icon = STATUS_ICONS[type] || STATUS_ICONS.info;
  statusDiv.textContent = `${icon} ${message}`;
  statusDiv.className = `status status-toast ${type}`;
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

export function addLog(message) {
  const { logContainer } = domRefs;
  if (!logContainer) return;

  const placeholder = logContainer.querySelector('.log-placeholder');
  if (placeholder) {
    logContainer.innerHTML = '';
  }

  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  const content = message.startsWith('[') ? message : `[${new Date().toLocaleTimeString()}] ${message}`;
  logEntry.textContent = content;
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

export function updateProgress(exported, total) {
  const { progressFill, progressText } = domRefs;
  if (!progressFill || !progressText) return;
  const percentage = total > 0 ? Math.round((exported / total) * 100) : 0;
  progressFill.style.width = `${percentage}%`;
  progressText.textContent = `${exported}/${total}`;
}

export function toggleSponsorModal(shouldShow) {
  const { sponsorModal, mainContainer, sponsorModalClose, sponsorBtn } = domRefs;
  if (!sponsorModal) return;

  if (shouldShow) {
    sponsorModal.classList.add('is-visible');
    sponsorModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    if (mainContainer) {
      mainContainer.setAttribute('inert', '');
    }
    setTimeout(() => sponsorModalClose?.focus(), 0);
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

export function enhanceSelectInteraction() {
  const { selectContainer, exportTypeSelect, selectTrigger, selectOptionsList } = domRefs;
  if (!selectContainer || !exportTypeSelect) return;

  const updateSelectionState = () => {
    if (exportTypeSelect.value) {
      selectContainer.classList.add('has-selection');
    } else {
      selectContainer.classList.remove('has-selection');
    }
    updateExportTypeIcon();
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

  selectTrigger.addEventListener('click', event => {
    event.preventDefault();
    toggleCustomDropdown();
  });
  selectTrigger.addEventListener('keydown', handleTriggerKeydown);
  selectOptionsList.addEventListener('keydown', handleOptionsKeydown);
  document.addEventListener('click', handleSelectOutsideClick);

  exportTypeSelect.addEventListener('change', () => {
    updateSelectionState();
    closeCustomDropdown();
  });
}

function updateExportTypeIcon() {
  const { exportTypeSelect, selectIcon, selectContainer, selectLabel } = domRefs;
  if (!exportTypeSelect) return;

  const selectedOption =
    exportTypeSelect.selectedOptions?.[0] || exportTypeSelect.options[exportTypeSelect.selectedIndex];
  const iconSrc = selectedOption?.dataset?.icon;

  if (selectIcon) {
    if (iconSrc) {
      selectIcon.src = iconSrc;
      const optionLabel = selectedOption?.textContent?.trim() || '导出格式';
      selectIcon.alt = `${optionLabel} 图标`;
      selectIcon.classList.add('is-visible');
    } else {
      selectIcon.classList.remove('is-visible');
    }
  }

  if (selectContainer) {
    selectContainer.classList.toggle('has-icon', Boolean(iconSrc));
  }

  if (selectLabel && selectedOption) {
    selectLabel.textContent = selectedOption.textContent?.trim() || '导出格式';
  }

  updateCustomOptionsState();
}

function updateCustomOptionsState() {
  const { selectOptionsList, exportTypeSelect } = domRefs;
  if (!selectOptionsList || !exportTypeSelect) return;
  const currentValue = exportTypeSelect.value;
  selectOptionsList.querySelectorAll('.select-option-item').forEach(item => {
    const isActive = item.dataset.value === currentValue;
    item.classList.toggle('is-active', isActive);
    const button = item.querySelector('.select-option-button');
    if (button) {
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
  });
}

function buildCustomSelectOptions() {
  const { exportTypeSelect, selectOptionsList } = domRefs;
  if (!exportTypeSelect || !selectOptionsList) return;

  selectOptionsList.innerHTML = '';
  const fragment = document.createDocumentFragment();

  Array.from(exportTypeSelect.options).forEach(option => {
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
      button.appendChild(img);
    }

    const text = document.createElement('span');
    text.textContent = option.textContent.trim();
    button.appendChild(text);

    button.addEventListener('click', () => {
      if (exportTypeSelect.value !== option.value) {
        exportTypeSelect.value = option.value;
        exportTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
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
}

function toggleCustomDropdown() {
  const { selectContainer } = domRefs;
  if (!selectContainer) return;
  if (selectContainer.classList.contains('is-open')) {
    closeCustomDropdown({ restoreFocus: true });
  } else {
    openCustomDropdown();
  }
}

function openCustomDropdown() {
  const { selectContainer, selectTrigger, selectOptionsList } = domRefs;
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
}

function closeCustomDropdown({ restoreFocus = false } = {}) {
  const { selectContainer, selectTrigger } = domRefs;
  if (!selectContainer || !selectTrigger) return;
  const wasOpen = selectContainer.classList.contains('is-open');
  selectContainer.classList.remove('is-open');
  selectContainer.closest('.form-group')?.classList.remove('is-select-open');
  selectTrigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus && wasOpen) {
    selectTrigger.focus();
  }
}

function handleSelectOutsideClick(event) {
  const { selectContainer } = domRefs;
  if (!selectContainer?.classList.contains('is-open')) return;
  if (!selectContainer.contains(event.target)) {
    closeCustomDropdown();
  }
}

function handleTriggerKeydown(event) {
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
}

function handleOptionsKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCustomDropdown({ restoreFocus: true });
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusRelativeOption(event.key === 'ArrowDown' ? 1 : -1);
  }
}

function focusRelativeOption(step) {
  const { selectOptionsList } = domRefs;
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
}

