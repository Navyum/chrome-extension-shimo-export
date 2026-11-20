const REVIEW_URL = 'https://chromewebstore.google.com/detail/jdipfhjpijkdjbefbaehnimligdldhdp/reviews';

function isSuccessfulTask(task) {
  return Boolean(task?.taskId && !task.isExporting && !task.isPaused &&
    Number.isSafeInteger(task.totalFiles) && task.totalFiles > 0 &&
    Array.isArray(task.fileList) && task.fileList.length === task.totalFiles &&
    task.fileList.every(file => file.status === 'success'));
}

// 仅庆祝页面观察到的运行中 -> 全部成功；重复通知和历史快照不重播。
function createCompletionTracker() {
  let previous = {};
  const celebrated = new Set();
  return task => {
    const completed = previous.taskId === task?.taskId && previous.isExporting &&
      task.scope === 'selected' && isSuccessfulTask(task) && !celebrated.has(task.taskId);
    previous = { taskId: task?.taskId, isExporting: Boolean(task?.isExporting) };
    if (!completed) return null;
    celebrated.add(task.taskId);
    return task.totalFiles;
  };
}

// 估算避免重复点击所节省的手动操作时间，不代表实际下载耗时。
function estimateManualTimeSaved(count) {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(count * 15)) return '';
  const seconds = count * 15;
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  return `${Math.floor(seconds / 360) / 10} 小时`;
}

module.exports = { REVIEW_URL, isSuccessfulTask, createCompletionTracker, estimateManualTimeSaved };
