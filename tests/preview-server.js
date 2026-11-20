const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { harness } = require('./background-harness');
const { catalogFixture } = require('./fixtures');

(async () => {
  const catalog = catalogFixture();
  for (let index = 0; index < 3500; index++) catalog.files.push({
    selectionId: `bulk-${index}`, id: `bulk-${index}`, folderId: 'nested',
    folderPath: '同名目录/子目录', title: `批量文档 ${index + 1}`, type: 'newdoc'
  });
  const h = await harness({ catalog, selectionDraft: { catalogRevision: catalog.revision, selectedIds: [] } });
  h.context.previewCatalog = catalog;
  h.context.previewDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
  vm.runInContext(`
    getAllFiles = async () => ({ ...previewCatalog, revision: crypto.randomUUID() });
    downloadFile = async (url, file) => {
      await previewDelay(150);
      if (failIds.has(file.id)) throw new Error('合成下载失败');
      file.localPath = file.folderPath + '/' + file.title;
    };
  `, h.context);
  const root = path.resolve(__dirname, '../dist/chrome');
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === '/__rpc' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const { action, data } = JSON.parse(body);
        let result;
        if (action === '__events') result = { cursor: h.messages.length, messages: h.messages.slice(data) };
        else if (action === '__getStorage') result = Object.fromEntries((Array.isArray(data) ? data : [data]).map(key => [key, h.storage[key]]));
        else if (action === '__setStorage') {
          await h.context.browser.storage.local.set(data);
          result = { success: true };
        } else if (action === '__failNextWrite') { h.failNextWrite(); result = { success: true }; }
        else if (action === '__failDocument') { data.fail ? h.failIds.add(data.id) : h.failIds.delete(data.id); result = { success: true }; }
        else result = await h.request(action, data);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
        return;
      }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = pathname === '/browser.js' ? path.join(__dirname, 'preview-browser.js') : path.resolve(root, '.' + pathname);
      if (pathname !== '/browser.js' && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      const type = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.end(await fs.readFile(file));
    } catch (error) { res.writeHead(500); res.end(error.message); }
  });
  server.listen(0, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${server.address().port}/settings.html#select-export`));
})();
