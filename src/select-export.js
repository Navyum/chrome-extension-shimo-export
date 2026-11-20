const { enhanceSelectInteraction } = require('./export-format-select');
const { normalizeSelection } = require('./selection-model');
const { createSelectionTree } = require('./selection-tree');
const { createCompletionTracker } = require('./export-success-model');
const { initExportSuccess } = require('./export-success');

async function initSelectExport(root, browser) {
  const observeCompletion = createCompletionTracker();
  const showExportSuccess = initExportSuccess(root, browser);
  const byId = id => root.querySelector(`#selection-${id}`);
  enhanceSelectInteraction(byId('format'));
  let catalog = { revision: null, files: [], folders: [] };
  let selected = [];
  let tree;
  let task = {};
  let busy = false;
  let saveError = false;
  let saveVersion = 0;
  let pendingSave = Promise.resolve();
  let refreshVersion = 0;
  async function request(action, data) {
    const response = await browser.runtime.sendMessage({ action, data });
    if (!response?.success) throw new Error(response?.error || '请求失败，请重试。');
    return response.data;
  }
  function showError(message = '') {
    byId('error').textContent = message;
    byId('error').hidden = !message;
  }
  function controls() {
    const locked = busy || task.isExporting || task.isScanning;
    const ready = Boolean(catalog.revision);
    byId('counts').textContent = `共 ${catalog.files.length} 个文档 · 已选 ${selected.length} 个`;
    byId('start').disabled = locked || saveError || !ready || !selected.length;
    byId('refresh').disabled = locked;
    byId('refresh').textContent = task.isScanning ? '正在获取…' : '刷新文件列表';
    for (const id of ['all', 'clear']) byId(id).disabled = locked || !ready;
    byId('format').disabled = locked;
    tree?.setDisabled(locked || !ready);
    byId('empty').hidden = ready && catalog.files.length > 0;
    byId('empty').textContent = ready ? '文件列表为空。' : '先获取文件列表，再勾选要导出的文件夹或文档。';
    byId('pause').hidden = !task.isExporting;
    byId('pause').disabled = busy;
    byId('pause').textContent = task.isPaused ? '继续导出' : '暂停导出';
    byId('retry').hidden = task.isExporting || !task.fileList?.some(file => file.status === 'failed');
    byId('retry').disabled = busy || task.isScanning;
    byId('cancel').hidden = !task.isExporting;
    byId('cancel').disabled = busy;
  }
  function renderTask(next) {
    const completedCount = observeCompletion(next);
    task = next;
    const files = task.fileList || [];
    const success = files.filter(file => file.status === 'success').length;
    const failed = files.filter(file => file.status === 'failed').length;
    byId('task-title').textContent = task.isPaused ? '任务已暂停' : task.isExporting ? '正在导出' : task.taskId ? (failed ? '导出结束，部分文件失败' : '导出已结束') : '尚未开始导出';
    byId('task-counts').textContent = `总计 ${files.length} · 成功 ${success} · 失败 ${failed}`;
    byId('task-config').textContent = task.taskId ? `${task.scope === 'selected' ? '选择导出' : '全量导出'} · ${task.exportType} · ${task.subfolder || '下载目录'}` : '';
    byId('progress').max = files.length || 1;
    byId('progress').value = success + failed;
    byId('failures').replaceChildren();
    for (const file of files.filter(file => file.status === 'failed').slice(0, 20)) {
      const item = document.createElement('li');
      item.textContent = `${file.folderPath ? `${file.folderPath}/` : ''}${file.title}`;
      byId('failures').appendChild(item);
    }
    byId('failures').hidden = !failed;
    byId('log').textContent = (task.logs || []).slice(-8).join('\n');
    controls();
    if (completedCount && root.classList.contains('active')) void showExportSuccess(completedCount);
  }
  async function load() {
    const version = ++refreshVersion;
    const localSave = saveVersion;
    await pendingSave;
    const state = await request('getSelectionState');
    if (version !== refreshVersion || localSave !== saveVersion) return;
    if (state.catalog.revision !== catalog.revision || !tree) {
      catalog = state.catalog;
      tree = createSelectionTree(byId('tree'), catalog, persist);
    }
    selected = normalizeSelection(catalog, state.selectionDraft.selectedIds);
    tree.setSelection(selected);
    renderTask(state.task);
  }
  function persist(ids) {
    selected = ids;
    tree?.setSelection(ids);
    const version = ++saveVersion;
    saveError = false;
    showError();
    // 立即发送每次选择，后台串行写入，关闭页面也不会丢失尚未发送的选择。
    const write = request('saveSelection', { catalogRevision: catalog.revision, selectedIds: ids });
    pendingSave = Promise.all([pendingSave.catch(() => {}), write]).catch(error => {
      if (version === saveVersion) {
        saveError = true;
        showError(`选择保存失败，请重新勾选后重试：${error.message}`);
        controls();
      }
    });
    controls();
  }
  async function perform(operation) {
    if (busy) return;
    busy = true; showError(); controls();
    try { await operation(); }
    catch (error) { showError(error.message); }
    finally {
      busy = false;
      try { renderTask(await request('getUiState')); }
      catch (error) { showError(error.message); controls(); }
    }
  }
  byId('all').addEventListener('click', () => persist(normalizeSelection(catalog, catalog.files.map(file => file.selectionId))));
  byId('clear').addEventListener('click', () => persist([]));
  byId('refresh').addEventListener('click', () => perform(async () => {
    await pendingSave;
    await request('getFileInfo');
    await load();
  }));
  byId('start').addEventListener('click', () => perform(async () => {
    await pendingSave;
    if (saveError) throw new Error('选择尚未保存，请重新勾选后再开始。');
    await request('startExport', { scope: 'selected', selectedIds: selected,
      catalogRevision: catalog.revision, exportType: byId('format').value });
  }));
  byId('pause').addEventListener('click', () => perform(() => request('togglePause', { isPaused: !task.isPaused })));
  byId('retry').addEventListener('click', () => perform(() => request('retryFailedFiles')));
  byId('cancel').addEventListener('click', () => perform(() => request('resetExport')));
  byId('format').addEventListener('change', () => {
    browser.storage.local.set({ exportType: byId('format').value }).catch(error => showError(error.message));
  });
  browser.runtime.onMessage.addListener(message => {
    if (message.action === 'taskStateChanged') renderTask(message.data);
    if (message.action === 'exportComplete') void request('getUiState').then(renderTask).catch(error => showError(error.message));
    if (message.action === 'exportLog') {
      byId('log').textContent = [...byId('log').textContent.split('\n'), message.data.message].slice(-8).join('\n');
    }
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.catalog || changes.selectionDraft)) {
      void load().catch(error => showError(error.message));
    }
  });
  await perform(async () => {
    const settings = await browser.storage.local.get(['exportType']);
    if (settings.exportType) byId('format').value = settings.exportType;
    byId('format').dispatchEvent(new Event('format-refresh'));
    await load();
  });
}

module.exports = { initSelectExport };
