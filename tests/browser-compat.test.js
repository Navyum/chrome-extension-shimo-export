const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('Chrome 存储失败会拒绝 Promise，选择保存不会误报成功', async () => {
  const chrome = { runtime: { lastError: null }, storage: { onChanged: { addListener() {} }, local: {
    set: (items, callback) => { chrome.runtime.lastError = { message: 'quota' }; callback(); chrome.runtime.lastError = null; }
  } } };
  const context = vm.createContext({ chrome, navigator: { userAgent: 'Chrome' } });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/browser.js'), 'utf8'), context);
  await assert.rejects(context.browserCompat.storage.local.set({ selectionDraft: {} }), /quota/);
  assert.equal(context.browserCompat.storage.onChanged, chrome.storage.onChanged);
});

test('Chrome 打开评价标签页失败时拒绝 Promise', async () => {
  const chrome = { runtime: { lastError: null }, storage: { local: {} }, tabs: {
    create: (options, callback) => { chrome.runtime.lastError = { message: 'tab failed' }; callback(); chrome.runtime.lastError = null; }
  } };
  const context = vm.createContext({ chrome, navigator: { userAgent: 'Chrome' } });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/browser.js'), 'utf8'), context);
  await assert.rejects(context.browserCompat.tabs.create({ url: 'https://example.test' }), /tab failed/);
});

test('头像规则 API 使用浏览器兼容层，并传播 Chrome 权限错误', async () => {
  const chrome = { runtime: { lastError: null }, storage: { local: {} }, declarativeNetRequest: {
    updateSessionRules: (options, callback) => { chrome.runtime.lastError = { message: 'permission denied' }; callback(); chrome.runtime.lastError = null; }
  } };
  const context = vm.createContext({ chrome, navigator: { userAgent: 'Chrome' } });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/browser.js'), 'utf8'), context);
  await assert.rejects(context.browserCompat.declarativeNetRequest.updateSessionRules({}), /permission denied/);
});
