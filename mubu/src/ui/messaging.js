import { START_BUTTON_DONE_TEXT } from './constants.js';
import { updateUiState } from './state.js';
import {
  addLog,
  resetUiToIdle,
  setStartButtonLabel,
  showStatus,
  syncUiWithState,
  updateProgress
} from './ui.js';

let listenerRegistered = false;

export function initRuntimeMessaging() {
  if (listenerRegistered) return;
  listenerRegistered = true;

  chrome.runtime.onMessage.addListener(message => {
    switch (message.action) {
      case 'exportProgress': {
        const { exportedFiles, totalFiles } = message.data;
        updateUiState({ totalFiles });
        updateProgress(exportedFiles, totalFiles);
        break;
      }
      case 'exportComplete': {
        addLog('导出流程完成。');
        showStatus('导出完成！', 'success');
        setStartButtonLabel(START_BUTTON_DONE_TEXT);
        updateUiState({ isExporting: false });
        chrome.runtime.sendMessage({ action: 'getUiState' }).then(response => {
          if (response?.success) {
            syncUiWithState(response.data);
          }
        });
        break;
      }
      case 'exportError': {
        const error = message.data.error;
        addLog(`错误: ${error}`);
        showStatus(`导出出错: ${error}`, 'error');
        resetUiToIdle();
        break;
      }
      case 'exportLog': {
        addLog(message.data.message);
        break;
      }
      default:
        break;
    }
  });
}

