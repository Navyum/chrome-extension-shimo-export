// 仅用于本地合成验收，不接触真实账号、接口或下载。
(() => {
  const runtimeListeners = [];
  const storageListeners = [];
  async function rpc(action, data) {
    const response = await fetch('/__rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data }) });
    return response.json();
  }
  window.browserCompat = {
    browserType: 'chrome',
    runtime: {
      sendMessage: (message) => rpc(message.action, message.data),
      onMessage: { addListener: fn => runtimeListeners.push(fn) },
      getURL: path => `${location.origin}/${path}`,
      openOptionsPage: async () => window.open('/settings.html')
    },
    storage: {
      local: {
        get: keys => rpc('__getStorage', keys),
        set: async values => {
          const result = await rpc('__setStorage', values);
          if (!result.success) throw new Error(result.error);
        }
      },
      onChanged: { addListener: fn => storageListeners.push(fn) }
    },
    tabs: { create: async ({ url }) => { window.previewOpenedURL = url; } },
    cookies: { get: async () => null }
  };
  window.preview = { rpc, emit: message => runtimeListeners.forEach(fn => fn(message)) };
  let cursor = null;
  let polling = false;
  setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const events = await rpc('__events', cursor);
      if (cursor === null) { cursor = events.cursor; return; }
      cursor = events.cursor;
      for (const event of events.messages) {
        if (event.action === '__storage') storageListeners.forEach(fn => fn(event.changes, 'local'));
        else runtimeListeners.forEach(fn => fn(event));
      }
    } finally { polling = false; }
  }, 150);
})();
