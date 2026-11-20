const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { catalogFixture } = require('./fixtures');
const { harness } = require('./background-harness');
const seed = () => ({ catalog: catalogFixture(), selectionDraft: { catalogRevision: 'r1', selectedIds: ['one'] } });
const start = (h, ids = ['one']) => h.request('startExport', { scope: 'selected', catalogRevision: 'r1', selectedIds: ids, exportType: 'md' });

function apiFetcher({ broken = false, empty = false } = {}) {
  return async rawUrl => {
    const url = new URL(rawUrl);
    let body;
    if (url.pathname.includes('spaces')) body = { spaces: [] };
    else if (broken && url.searchParams.get('folder') === 'a') return { ok: false, status: 503, statusText: 'Unavailable' };
    else if (!url.searchParams.has('folder')) body = empty ? [] : [
      { guid: 'a', name: '同名', type: 'folder' }, { guid: 'b', name: '同名', type: 'folder' }, { guid: 'empty', name: '空目录', type: 'folder' }
    ];
    else body = url.searchParams.get('folder') === 'empty' ? [] : [{ guid: url.searchParams.get('folder') === 'a' ? 'doc1' : 'doc2', name: '文件', type: 'newdoc' }];
    return { ok: true, status: 200, json: async () => structuredClone(body) };
  };
}

test('选择导出仅请求所选文件，全量导出之后仍包含完整目录', async () => {
  const h = await harness(seed());
  assert.equal((await start(h, ['three'])).success, true);
  await h.finish();
  assert.deepEqual(h.requested, ['doc3']);
  assert.equal(h.storage.catalog.files.length, 5);
  assert.equal(h.storage.exportState.fileList.length, 1);
  const state = (await h.request('getUiState')).data;
  assert.equal(state.catalogTotal, 5);
  assert.equal(state.scope, 'selected');
  assert.equal((await h.request('startExport', { scope: 'all', exportType: 'auto' })).success, true);
  await h.finish();
  assert.equal(h.storage.exportState.fileList.length, 5);
  assert.deepEqual(h.requested, ['doc3', 'doc1', 'doc2', 'doc3']);
});

test('后台拒绝空选择、未知文件、过期目录和错误格式，且不创建下载', async () => {
  const h = await harness(seed());
  for (const data of [
    { selectedIds: [] }, { selectedIds: ['unknown'] }, { selectedIds: ['blocked'] },
    { catalogRevision: 'old' }, { exportType: 'exe' }
  ]) assert.equal((await h.request('startExport', { scope: 'selected', catalogRevision: 'r1', selectedIds: ['one'], exportType: 'md', ...data })).success, false);
  assert.deepEqual(h.requested, []);
});

test('并发开始请求只创建一个任务，运行中禁止刷新目录', async () => {
  const h = await harness(seed());
  vm.runInContext('exportFiles = async () => {}', h.context);
  const replies = await Promise.all([start(h), start(h, ['two'])]);
  assert.deepEqual(replies.map(reply => reply.success), [true, false]);
  assert.equal((await h.request('getFileInfo')).success, false);
  assert.equal(h.storage.exportState.fileList[0].id, 'doc1');
});

test('失败重试仅重试所选任务的失败项，并保留原格式与输出设置', async () => {
  const h = await harness({ ...seed(), subfolder: 'original' });
  h.failIds.add('doc2');
  await start(h, ['one', 'two']);
  await h.finish();
  h.failIds.clear();
  h.storage.subfolder = 'changed';
  h.storage.typeExportSettings = { newdoc: 'pdf' };
  h.requested.length = 0;
  assert.equal((await h.request('retryFailedFiles')).success, true);
  await h.finish();
  assert.deepEqual(h.requested, ['doc2']);
  assert.equal(h.storage.exportState.subfolder, 'original');
  assert.equal(h.storage.exportState.exportType, 'md');
  assert.deepEqual(h.storage.exportState.fileList.map(file => file.status), ['success', 'success']);
});

test('暂停任务重启后继续只执行原选择，不扩大为完整目录', async () => {
  const h = await harness({ ...seed(), exportState: { taskId: 'saved', scope: 'selected', isExporting: true, isPaused: true,
    currentFileIndex: 0, totalFiles: 1, exportType: 'md', fileList: [{ ...catalogFixture().files[2], status: 'in_progress' }] } });
  assert.deepEqual(h.requested, []);
  assert.equal((await h.request('togglePause', { isPaused: false })).success, true);
  await h.finish();
  assert.deepEqual(h.requested, ['doc3']);
  assert.equal(h.storage.catalog.files.length, 5);
});

test('取消任务保留目录和勾选，可以重新发起不同的选择任务', async () => {
  const h = await harness({ ...seed(), exportState: { taskId: 'saved', scope: 'selected', isExporting: true, isPaused: true,
    totalFiles: 1, fileList: [{ ...catalogFixture().files[0], status: 'pending' }] } });
  assert.equal((await h.request('resetExport')).success, true);
  assert.equal(h.storage.catalog.files.length, 5);
  assert.deepEqual(h.storage.selectionDraft.selectedIds, ['one']);
  await start(h, ['two']);
  await h.finish();
  assert.deepEqual(h.requested, ['doc2']);
});

test('旧版本缓存要求先扫描才能选择导出，但保留全量导出能力', async () => {
  const h = await harness({ exportState: { fileList: [catalogFixture().files[0]], totalFiles: 1 } });
  assert.equal((await start(h)).success, false);
  assert.equal((await h.request('startExport', { exportType: 'md' })).success, true);
  await h.finish();
  assert.deepEqual(h.requested, ['doc1']);
});

test('扫描保留同名文件夹、空文件夹，成功刷新后保留有效选择', async () => {
  const h = await harness({}, apiFetcher());
  assert.equal((await h.request('getFileInfo')).success, true);
  const first = h.storage.catalog;
  assert.equal(first.files.length, 2);
  assert.notEqual(first.files[0].folderId, first.files[1].folderId);
  assert.ok(first.folders.some(folder => folder.name === '空目录'));
  await h.request('saveSelection', { catalogRevision: first.revision, selectedIds: [first.files[0].selectionId] });
  await h.request('getFileInfo');
  assert.notEqual(h.storage.catalog.revision, first.revision);
  assert.deepEqual(h.storage.selectionDraft.selectedIds, [first.files[0].selectionId]);
  assert.equal(h.messages.some(message => JSON.stringify(message).includes('synthetic-secret')), false);
});

test('子目录扫描失败时不发布部分目录、不丢弃已有选择', async () => {
  const h = await harness(seed(), apiFetcher({ broken: true }));
  assert.equal((await h.request('getFileInfo')).success, false);
  assert.equal(h.storage.catalog.revision, 'r1');
  assert.deepEqual(h.storage.selectionDraft.selectedIds, ['one']);
  assert.equal((await h.request('getUiState')).data.isScanning, false);
});

test('真正空目录扫描成功，清除旧选择且不能开始空任务', async () => {
  const h = await harness(seed(), apiFetcher({ empty: true }));
  assert.equal((await h.request('getFileInfo')).success, true);
  assert.equal(h.storage.catalog.files.length, 0);
  assert.deepEqual(h.storage.selectionDraft.selectedIds, []);
  assert.equal((await h.request('startExport', { exportType: 'auto' })).success, false);
});

test('选择写入串行化，保存失败不会把内存误标为已保存', async () => {
  const h = await harness(seed());
  const drafts = [['one'], ['two'], ['one', 'two'], []];
  await Promise.all(drafts.map(selectedIds => h.request('saveSelection', { catalogRevision: 'r1', selectedIds })));
  assert.deepEqual(h.storage.selectionDraft.selectedIds, []);
  h.failNextWrite();
  assert.equal((await h.request('saveSelection', { catalogRevision: 'r1', selectedIds: ['three'] })).success, false);
  assert.deepEqual((await h.request('getSelectionState')).data.selectionDraft.selectedIds, []);
});

test('创建任务的存储失败不会启动导出', async () => {
  const h = await harness(seed());
  h.failNextWrite();
  assert.equal((await start(h)).success, false);
  assert.deepEqual(h.requested, []);
  assert.equal((await h.request('getUiState')).data.isExporting, false);
});

test('新目录的空闲状态重启后不会从兼容缓存复活上次任务', async () => {
  const h = await harness({ ...seed(), exportState: { taskId: null, fileList: [], totalFiles: 0 }, fileInfo: { fileList: catalogFixture().files, totalFiles: 5 } });
  const state = (await h.request('getUiState')).data;
  assert.equal(state.fileList.length, 0);
  assert.equal(state.catalogTotal, 5);
});

test('暂停状态保存失败时不会改变当前任务，重试保存失败时不会启动队列', async () => {
  const h = await harness({ ...seed(), exportState: { isExporting: true, isPaused: true, fileList: [{ ...catalogFixture().files[0], status: 'pending' }] } });
  h.failNextWrite();
  assert.equal((await h.request('togglePause', { isPaused: false })).success, false);
  assert.equal((await h.request('getUiState')).data.isPaused, true);
  await h.request('resetExport');
  h.failIds.add('doc1');
  await start(h);
  await h.finish();
  h.requested.length = 0;
  h.failNextWrite();
  assert.equal((await h.request('retryFailedFiles')).success, false);
  assert.equal((await h.request('getUiState')).data.isExporting, false);
  assert.deepEqual(h.requested, []);
});

test('原文件下载在文件之间暂停，并可取消运行中的队列', async () => {
  const data = seed();
  data.catalog.files = data.catalog.files.slice(0, 2).map(file => ({ ...file, type: 'pdf' }));
  const h = await harness(data);
  let release;
  let entered;
  const firstEntered = new Promise(resolve => { entered = resolve; });
  h.context.waitForTest = () => { entered(); return new Promise(resolve => { release = resolve; }); };
  vm.runInContext('downloadFile = async (url, file) => { requested.push(file.id); if (file.id === "doc1") await waitForTest(); };', h.context);
  await start(h, ['one', 'two']);
  await firstEntered;
  await h.request('togglePause', { isPaused: true });
  release();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.deepEqual(h.requested, ['doc1']);
  await h.request('resetExport');
  assert.equal((await h.request('getUiState')).data.isExporting, false);
  assert.deepEqual(h.requested, ['doc1']);
});

test('团队在线文档的下载标记不阻止转换，原文件下载限制仍保留', async () => {
  const h = await harness({}, async rawUrl => {
    const url = new URL(rawUrl);
    let body;
    if (url.pathname.includes('spaces')) body = { spaces: [{ guid: 'team', name: '团队' }] };
    else if (!url.searchParams.has('folder')) body = [];
    else body = [
      { guid: 'online', name: '在线文档', type: 'newdoc', permissions: { downloadable: false } },
      { guid: 'sheet', name: '在线表格', type: 'mosheet', permissionsAndReasons: { canDownload: { value: false } } },
      { guid: 'original', name: '附件.pdf', type: 'pdf', permissions: { downloadable: false } },
      { guid: 'cloud', name: '上传文件.docx', type: 'newdoc', isCloudFile: true, permissionsAndReasons: { canDownload: { value: false } } }
    ];
    return { ok: true, status: 200, json: async () => body };
  });
  assert.equal((await h.request('getFileInfo')).success, true);
  const { files, revision } = h.storage.catalog;
  assert.equal(files.length, 4);
  const onlineIds = files.slice(0, 2).map(file => file.selectionId);
  assert.equal((await h.request('startExport', { scope: 'selected', catalogRevision: revision, selectedIds: onlineIds, exportType: 'auto' })).success, true);
  await h.finish();
  assert.deepEqual(h.requested, ['online', 'sheet']);
  for (const file of files.slice(2)) {
    assert.equal((await h.request('startExport', { scope: 'selected', catalogRevision: revision, selectedIds: [file.selectionId], exportType: 'auto' })).success, false);
  }
});

test('已有目录中在线文档的下载标记不再误禁用，但服务端拒绝导出仍记录失败', async () => {
  const data = seed();
  data.catalog.files[0].downloadable = false;
  const h = await harness(data);
  vm.runInContext("getExportTaskId = async () => { throw new Error('HTTP 403: 禁止导出'); };", h.context);
  assert.equal((await start(h)).success, true);
  await h.finish();
  assert.deepEqual(h.requested, []);
  assert.equal(h.storage.exportState.fileList[0].status, 'failed');
  assert.ok(h.storage.exportState.logs.some(log => log.includes('403')));
});
