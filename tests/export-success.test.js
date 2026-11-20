const test = require('node:test');
const assert = require('node:assert/strict');
const { createCompletionTracker, isSuccessfulTask, estimateManualTimeSaved, REVIEW_URL } = require('../src/export-success-model');

const task = (overrides = {}) => ({ taskId: 'a', scope: 'selected', totalFiles: 1,
  isExporting: false, isPaused: false, fileList: [{ status: 'success' }], ...overrides });

test('成功反馈仅在观察到所选任务运行后全部成功时出现一次', () => {
  const observe = createCompletionTracker();
  assert.equal(observe(task({ isExporting: true, fileList: [{ status: 'pending' }] })), null);
  assert.equal(observe(task()), 1);
  assert.equal(observe(task()), null);
  observe(task({ isExporting: true }));
  assert.equal(observe(task()), null);
  observe(task({ taskId: 'b', isExporting: true }));
  assert.equal(observe(task({ taskId: 'b' })), 1);
});

test('刷新历史、取消、更换任务及全量导出不触发选择页庆祝', () => {
  assert.equal(createCompletionTracker()(task()), null);
  for (const next of [task({ taskId: null }), task({ taskId: 'other' }), task({ scope: 'all' }), task({ totalFiles: 0, fileList: [] })]) {
    const observe = createCompletionTracker();
    observe(task({ isExporting: true }));
    assert.equal(observe(next), null);
  }
});

test('失败、未完成、暂停和数量不匹配不能显示成功', () => {
  const unfinished = [
    task({ fileList: [{ status: 'failed' }] }), task({ fileList: [{ status: 'pending' }] }),
    task({ fileList: [{ status: 'in_progress' }] }), task({ isPaused: true }),
    task({ isExporting: true }), task({ totalFiles: 2 }), task({ fileList: [] })
  ];
  for (const next of unfinished) {
    const observe = createCompletionTracker();
    observe(task({ isExporting: true }));
    assert.equal(observe(next), null);
    assert.equal(isSuccessfulTask(next), false);
  }
});

test('部分失败后重试全部成功，按任务总成功数庆祝', () => {
  const observe = createCompletionTracker();
  observe(task({ isExporting: true }));
  assert.equal(observe(task({ fileList: [{ status: 'failed' }] })), null);
  observe(task({ isExporting: true }));
  assert.equal(observe(task()), 1);
});

test('单篇省时估算与秒、分钟、小时边界正确，非法数量不显示', () => {
  assert.equal(estimateManualTimeSaved(1), '15 秒');
  assert.equal(estimateManualTimeSaved(3), '45 秒');
  assert.equal(estimateManualTimeSaved(4), '1 分钟');
  assert.equal(estimateManualTimeSaved(239), '59 分钟');
  assert.equal(estimateManualTimeSaved(240), '1 小时');
  assert.equal(estimateManualTimeSaved(264), '1.1 小时');
  for (const value of [0, -1, 1.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER]) assert.equal(estimateManualTimeSaved(value), '');
});

test('评价入口指向石墨插件的商店评价页', () => {
  assert.equal(REVIEW_URL, 'https://chromewebstore.google.com/detail/jdipfhjpijkdjbefbaehnimligdldhdp/reviews');
});
