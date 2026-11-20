// 宣传图专用示例数据，不连接真实账号、不发起下载。
(() => {
  const catalog = {
    revision: 'promo',
    folders: [
      { id: 'personal', parentId: null, name: '个人空间' },
      { id: 'projects', parentId: 'personal', name: '项目资料' },
      { id: 'learning', parentId: 'personal', name: '学习笔记' },
      { id: 'teams', parentId: null, name: '团队空间' },
      { id: 'team-project', parentId: 'teams', name: '产品小组' }
    ],
    files: [
      { selectionId: 'plan', id: 'plan', folderId: 'projects', folderPath: '项目资料', title: '项目计划', type: 'newdoc', status: 'success', duration: 2100, actualExportType: 'md' },
      { selectionId: 'meeting', id: 'meeting', folderId: 'projects', folderPath: '项目资料', title: '会议纪要', type: 'newdoc', status: 'success', duration: 1800, actualExportType: 'md' },
      { selectionId: 'notes', id: 'notes', folderId: 'learning', folderPath: '学习笔记', title: '阅读笔记', type: 'newdoc', status: 'success', duration: 1500, actualExportType: 'md' },
      { selectionId: 'review', id: 'review', folderId: 'team-project', folderPath: '团队空间/产品小组', title: '需求评审', type: 'newdoc', status: 'failed' },
      { selectionId: 'budget', id: 'budget', folderId: 'team-project', folderPath: '团队空间/产品小组', title: '预算表', type: 'mosheet', status: 'success', duration: 2400, actualExportType: 'xlsx' },
      { selectionId: 'slides', id: 'slides', folderId: 'team-project', folderPath: '团队空间/产品小组', title: '项目汇报', type: 'presentation', status: 'success', duration: 3200, actualExportType: 'pptx' }
    ]
  };
  const task = {
    isExporting: false, isPaused: false, isScanning: false, taskId: null,
    scope: 'selected', exportType: 'md', totalFiles: 0, fileList: [], failedFiles: [], logs: ['文件列表已更新，共 6 个文档。', '团队空间：3 个文档。', '选择导出格式后，即可开始备份。'],
    catalogTotal: catalog.files.length, catalogTeamTotal: 3
  };
  const storage = { exportType: 'md', subfolder: '我的石墨文档', preserveFileTimes: true,
    fileTimeSource: 'createdAt', fileTimeFormat: 'YYYY-MM-DD_HH-mm',
    typeExportSettings: { newdoc: 'md', modoc: 'docx', mosheet: 'xlsx', presentation: 'pptx', mindmap: 'xmind' }, ratingDismissed: true };
  const performanceFiles = [catalog.files[0], catalog.files[1], { ...catalog.files[3], folderPath: '项目资料' }];
  const performanceTask = { ...task, taskId: 'example', totalFiles: performanceFiles.length,
    fileList: performanceFiles, failedFiles: performanceFiles.filter(f => f.status === 'failed') };
  window.browserCompat = {
    browserType: 'chrome',
    runtime: {
      getURL: path => '/' + path, openOptionsPage: async () => {},
      onMessage: { addListener() {} },
      sendMessage: async ({ action }) => {
        if (action === 'getUiState') return { success: true, data: location.hash === '#performance' ? performanceTask : task };
        if (action === 'getSelectionState') return { success: true, data: { catalog, task,
          selectionDraft: { catalogRevision: 'promo', selectedIds: ['plan', 'meeting'] } } };
        if (action === 'getUserInfo') return { success: true, data: { name: '示例用户' } };
        return { success: true };
      }
    },
    storage: { local: { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, storage[key]])),
      set: async values => Object.assign(storage, values) }, onChanged: { addListener() {} } },
    tabs: { create: async () => {} }, cookies: { get: async () => null }
  };
})();
