const { hasDownloadRestriction } = require('./file-access');
const EXPORT_FORMATS = ['auto', 'md', 'pdf', 'docx', 'jpg'];

function emptyCatalog() {
  return { revision: null, files: [], folders: [] };
}

function entryKey(parentId, id) {
  const ancestors = parentId.startsWith('[') ? JSON.parse(parentId) : [parentId];
  return JSON.stringify([...ancestors, String(id)]);
}

function selectionReason(file) {
  if (hasDownloadRestriction(file)) return '无下载权限';
  if (['table', 'board', 'form'].includes(file.type)) return '暂不支持导出';
  return '';
}

function normalizeSelection(catalog, ids = []) {
  const known = new Set(catalog.files.filter(file => !selectionReason(file)).map(file => file.selectionId));
  return [...new Set(ids)].filter(id => known.has(id));
}

function buildTaskFiles(catalog, { scope = 'all', catalogRevision, selectedIds = [] } = {}) {
  if (!catalog.revision) throw new Error('请先刷新文件列表。');
  if (!['all', 'selected'].includes(scope)) throw new Error('未知导出范围。');
  if (catalogRevision && catalogRevision !== catalog.revision) throw new Error('文件列表已变化，请刷新后重试。');
  if (scope === 'selected') {
    if (catalogRevision !== catalog.revision) throw new Error('文件列表已变化，请刷新后重试。');
    if (!Array.isArray(selectedIds)) throw new Error('选择范围必须是文件列表。');
    const valid = new Set(normalizeSelection(catalog, selectedIds));
    if (selectedIds.some(id => !valid.has(id))) throw new Error('选择包含已失效或不可导出的文件，请刷新列表。');
  }
  const selected = new Set(selectedIds);
  const files = catalog.files.filter(file => scope === 'all' || selected.has(file.selectionId));
  if (!files.length) throw new Error('请至少选择一个可导出的文件。');
  return files.map(file => ({ ...file, status: 'pending' }));
}

// 文件夹使用稳定 ID，而非名称或下载路径，避免同名目录混选。
function buildSelectionTree(catalog) {
  const root = { kind: 'folder', id: null, title: '全部文件', children: [] };
  const folders = new Map([[null, root]]);
  for (const folder of catalog.folders) {
    folders.set(folder.id, { ...folder, kind: 'folder', title: folder.name, children: [] });
  }
  for (const folder of catalog.folders) {
    (folders.get(folder.parentId) || root).children.push(folders.get(folder.id));
  }
  for (const file of catalog.files) {
    (folders.get(file.folderId) || root).children.push({ ...file, kind: 'file' });
  }
  const branches = [root];
  for (let i = 0; i < branches.length; i++) {
    for (const child of branches[i].children) if (child.kind === 'folder') branches.push(child);
  }
  return { root, branches };
}

module.exports = { EXPORT_FORMATS, emptyCatalog, entryKey, selectionReason, normalizeSelection, buildTaskFiles, buildSelectionTree };
