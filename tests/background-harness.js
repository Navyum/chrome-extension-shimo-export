const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const { catalogFixture } = require('./fixtures');
const backgroundPath = path.resolve(__dirname, '../src/background.js');

async function harness(initial = {}, fetcher) {
  const storage = structuredClone(initial);
  const messages = [];
  const requested = [];
  const failIds = new Set();
  let listener;
  let failWrite = false;
  const browser = {
    declarativeNetRequest: { updateSessionRules: async rules => { messages.push({ action: '__avatarRules', rules: structuredClone(rules) }); } },
    storage: { local: {
      get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(storage[key])])),
      set: async values => {
        if (failWrite) { failWrite = false; throw new Error('存储空间不足'); }
        const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { oldValue: structuredClone(storage[key]), newValue: structuredClone(value) }]));
        Object.assign(storage, structuredClone(values));
        messages.push({ action: '__storage', changes });
      }
    } },
    cookies: { getAll: async () => [], get: async () => ({ value: 'synthetic-secret' }), set: async () => {} },
    runtime: { getURL: path => 'chrome-extension://test-extension/' + path, onMessage: { addListener: fn => { listener = fn; } }, sendMessage: async msg => { messages.push(structuredClone(msg)); } },
    downloads: { onChanged: { addListener() {} }, onCreated: { addListener() {} }, onDeterminingFilename: { addListener() {} }, search: async () => [], cancel: async () => {} }
  };
  const context = vm.createContext({ browser, console, AbortController, URL, crypto: { randomUUID },
    require: createRequire(backgroundPath), setTimeout: fn => setTimeout(fn, 1), clearTimeout,
    fetch: fetcher || (async () => { throw new Error('Unexpected network'); }), requested, failIds });
  vm.runInContext(fs.readFileSync(backgroundPath, 'utf8'), context);
  await vm.runInContext('stateReady', context);
  vm.runInContext(`
    getExportTaskId = async file => file.id;
    waitForExportComplete = async id => 'https://example.test/' + id;
    downloadFile = async (url, file) => {
      requested.push(file.id);
      if (failIds.has(file.id)) throw new Error('synthetic download failure');
      file.localPath = file.folderPath + '/' + file.title;
    };
  `, context);
  return { storage, requested, messages, failIds, context,
    request: (action, data) => listener({ action, data }),
    finish: () => vm.runInContext('runningExport', context),
    failNextWrite: () => { failWrite = true; } };
}

module.exports = { harness };
