/**
 * 浏览器 API 统一抽象层
 * 核心理念：业务代码只管调用 Promise，差异由本层消解。
 */

const browserType = (() => {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Edg')) return 'edge';
  return 'chrome';
})();

const isFirefox = browserType === 'firefox';
// 在 Firefox 中使用原生的 browser 对象，在 Chrome/Edge 中使用 chrome 对象
const api = isFirefox ? (typeof browser !== 'undefined' ? browser : chrome) : chrome;

/**
 * 统一包装器：将所有异步调用转化为 Promise，并处理不同的消息监听机制
 */
var browserCompat = {
  browserType,
  isFirefox,
  
  // 1. 存储：统一返回 Promise
  storage: {
    local: {
      get: (keys) => {
        if (isFirefox) return api.storage.local.get(keys);
        return new Promise(resolve => api.storage.local.get(keys, resolve));
      },
      set: (items) => {
        if (isFirefox) return api.storage.local.set(items);
        return new Promise(resolve => api.storage.local.set(items, resolve));
      },
      remove: (keys) => {
        if (isFirefox) return api.storage.local.remove(keys);
        return new Promise(resolve => api.storage.local.remove(keys, resolve));
      }
    }
  },

  // 2. 消息传递
  runtime: {
    sendMessage: (msg) => {
      if (isFirefox) return api.runtime.sendMessage(msg);
      return new Promise((resolve, reject) => {
        api.runtime.sendMessage(msg, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    },
    
    /**
     * 统一消息监听：
     * 业务回调函数只需要 return 一个结果或 Promise。
     * 本层自动决定是调用 sendResponse (Chrome) 还是直接 return (Firefox)。
     */
    onMessage: {
      addListener: (userCallback) => {
        api.runtime.onMessage.addListener((message, sender, sendResponse) => {
          const result = userCallback(message, sender);
          
          if (result instanceof Promise) {
            if (isFirefox) {
              return result; // Firefox 直接支持返回 Promise
            }
            result.then(sendResponse).catch(err => {
              console.error('Message response error:', err);
              sendResponse({ success: false, error: err.message });
            });
            return true; // Chrome 异步必须返回 true
          } else if (result !== undefined) {
            if (isFirefox) {
              return Promise.resolve(result);
            }
            sendResponse(result);
            return false;
          }
        });
      }
    },
    openOptionsPage: () => {
      if (isFirefox) return api.runtime.openOptionsPage();
      return new Promise(resolve => api.runtime.openOptionsPage(resolve));
    },
    getURL: (path) => api.runtime.getURL(path),
    onInstalled: api.runtime.onInstalled
  },

  // 3. 下载：彻底解决重命名差异
  downloads: {
    download: (options) => {
      if (isFirefox) return api.downloads.download(options);
      return new Promise((resolve, reject) => {
        api.downloads.download(options, id => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(id);
          }
        });
      });
    },
    
    /**
     * 统一文件名建议监听：
     * 业务函数只需要根据 item 返回建议对象 { filename, conflictAction }。
     */
    onDeterminingFilename: {
      addListener: (userCallback) => {
        if (!api.downloads || !api.downloads.onDeterminingFilename) return;
        api.downloads.onDeterminingFilename.addListener((item, suggest) => {
          const suggestion = userCallback(item);
          if (suggestion) {
            if (isFirefox) {
              return suggestion; // Firefox 同步返回对象
            }
            if (typeof suggest === 'function') {
              suggest(suggestion); // Chrome 调用回调
            }
          }
        });
      }
    }
  },

  cookies: {
    getAll: (details) => {
      if (isFirefox) return api.cookies.getAll(details);
      return new Promise(resolve => api.cookies.getAll(details, resolve));
    },
    get: (details) => {
      if (isFirefox) return api.cookies.get(details);
      return new Promise(resolve => api.cookies.get(details, resolve));
    },
    set: (details) => {
      if (isFirefox) return api.cookies.set(details);
      return new Promise(resolve => api.cookies.set(details, resolve));
    }
  },

  tabs: {
    create: (options) => {
      if (isFirefox) return api.tabs.create(options);
      return new Promise(resolve => api.tabs.create(options, resolve));
    }
  }
};

// 导出到全局环境
if (typeof self !== 'undefined') {
  self.browser = browserCompat;
  self.browserCompat = browserCompat;
}
if (typeof window !== 'undefined') {
  window.browser = browserCompat;
  window.browserCompat = browserCompat;
}
if (typeof globalThis !== 'undefined') {
  globalThis.browser = browserCompat;
  globalThis.browserCompat = browserCompat;
}
