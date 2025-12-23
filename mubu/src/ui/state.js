export const uiState = {
  isExporting: false,
  isPaused: false,
  fileInfo: null,
  totalFiles: 0
};

export function updateUiState(partial = {}) {
  Object.assign(uiState, partial);
}

