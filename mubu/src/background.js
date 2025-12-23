import { registerRuntimeHandlers, maybeResumeExport } from './core/exporter.js';
import { initDownloadHooks } from './core/downloads.js';
import { loadState } from './core/state.js';
import { sendLog } from './core/messaging.js';

initDownloadHooks();
registerRuntimeHandlers();

(async function bootstrap() {
  const { restored, error } = await loadState();
  if (restored) {
    sendLog('已从存储中恢复任务状态。');
  } else if (error) {
    sendLog('恢复任务状态失败，请重新获取文件信息。');
  }
  await maybeResumeExport();
})();
