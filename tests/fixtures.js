function catalogFixture() {
  return {
    revision: 'r1',
    folders: [
      { id: 'personal', parentId: null, name: '个人空间' },
      { id: 'a', parentId: 'personal', name: '同名目录' },
      { id: 'b', parentId: 'personal', name: '同名目录' },
      { id: 'nested', parentId: 'a', name: '子目录' },
      { id: 'empty', parentId: 'personal', name: '空目录' }
    ],
    files: [
      { selectionId: 'one', id: 'doc1', folderId: 'a', folderPath: '同名目录', title: '文档一', type: 'newdoc' },
      { selectionId: 'two', id: 'doc2', folderId: 'b', folderPath: '同名目录', title: '文档二', type: 'newdoc' },
      { selectionId: 'three', id: 'doc3', folderId: 'nested', folderPath: '同名目录/子目录', title: '<img onerror=alert(1)>', type: 'newdoc' },
      { selectionId: 'blocked', id: 'doc4', folderId: 'a', folderPath: '同名目录', title: '禁止下载', type: 'pdf', downloadable: false },
      { selectionId: 'unsupported', id: 'doc5', folderId: 'a', folderPath: '同名目录', title: '表单', type: 'form' }
    ]
  };
}

module.exports = { catalogFixture };
