const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTaskFiles, normalizeSelection, buildSelectionTree, entryKey } = require('../src/selection-model');

const { catalogFixture } = require('./fixtures');

test('选择任务仅包含所选文件，保留目录，且不修改目录快照', () => {
  const catalog = catalogFixture();
  const before = structuredClone(catalog);
  const files = buildTaskFiles(catalog, { scope: 'selected', catalogRevision: 'r1', selectedIds: ['three', 'one', 'one'] });
  assert.deepEqual(files.map(file => file.id), ['doc1', 'doc3']);
  assert.equal(files[1].folderPath, '同名目录/子目录');
  files[0].status = 'success';
  assert.deepEqual(catalog, before);
  assert.equal(buildTaskFiles(catalog).length, 5);
});

test('空选择、过期版本、未知文件及无权限文件不能静默变为全量导出', () => {
  const catalog = catalogFixture();
  for (const data of [
    { selectedIds: [] }, { selectedIds: ['missing'] }, { selectedIds: ['blocked'] },
    { selectedIds: ['unsupported'] }, { selectedIds: 'one' },
    { selectedIds: ['one'], catalogRevision: 'old' }, { selectedIds: ['one'], catalogRevision: undefined }
  ]) assert.throws(() => buildTaskFiles(catalog, { scope: 'selected', catalogRevision: 'r1', ...data }));
  assert.throws(() => buildTaskFiles(catalog, { scope: 'other' }));
});

test('刷新只保留仍存在且有导出权限的勾选', () => {
  assert.deepEqual(normalizeSelection(catalogFixture(), ['one', 'one', 'removed', 'blocked', 'unsupported', 'two']), ['one', 'two']);
});

test('同名目录按 ID 区分，子目录和空目录完整保留', () => {
  const { branches } = buildSelectionTree(catalogFixture());
  assert.equal(branches.find(folder => folder.id === 'a').children.filter(file => file.kind === 'file')[0].id, 'doc1');
  assert.equal(branches.find(folder => folder.id === 'b').children[0].id, 'doc2');
  assert.equal(branches.find(folder => folder.id === 'empty').children.length, 0);
  assert.equal(branches.find(folder => folder.id === 'nested').children[0].title, '<img onerror=alert(1)>');
  assert.notEqual(entryKey('a', 'same-doc'), entryKey('b', 'same-doc'));
});

test('深层目录标识保持线性长度，特殊字符不造成目录碰撞', () => {
  let key = 'personal';
  for (let index = 0; index < 50; index++) key = entryKey(key, `folder-${index}`);
  assert.equal(JSON.parse(key).length, 51);
  assert.ok(key.length < 1000);
  assert.notEqual(entryKey(entryKey('personal', 'a/b'), 'c'), entryKey(entryKey('personal', 'a'), 'b/c'));
});
