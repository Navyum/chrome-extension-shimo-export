/**
 * 石墨文档浏览器登录脚本（反向代理模式）
 *
 * 启动本地反向代理服务器，将 shimo.im 代理到 localhost。
 * 用户在本地浏览器中完成登录，脚本自动从 Set-Cookie 响应头中
 * 拦截 shimo_sid 并保存，全程无需手动复制粘贴。
 *
 * 使用方法:
 *   node browser-login.cjs
 *
 * 无任何外部依赖，仅使用 Node.js 内置模块。
 *
 * Exit codes:
 *   0 - 登录成功
 *   1 - 登录失败或超时
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const ENV_FILE = path.join(__dirname, '..', '..', 'config', 'env.json');
const USER_API = 'https://shimo.im/lizard-api/users/me';
const TARGET_HOST = 'shimo.im';
const PORT = 18927;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const API_HEADERS = {
  'Referer': 'https://shimo.im/desktop',
  'Accept': 'application/nd.shimo.v2+json, text/plain, */*',
  'X-Requested-With': 'SOS 2.0',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function loadEnvConfig() {
  try {
    return JSON.parse(fs.readFileSync(ENV_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveEnvConfig(fields) {
  const config = loadEnvConfig();
  Object.assign(config, fields);
  const dir = path.dirname(ENV_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ENV_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

async function verifyLogin(cookieValue) {
  try {
    const response = await fetch(USER_API, {
      method: 'GET',
      headers: { ...API_HEADERS, 'Cookie': `shimo_sid=${cookieValue}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Rewrite URLs in HTML/JS content:
 *  - https://shimo.im/xxx  → /xxx  (relative, goes through proxy)
 *  - //shimo.im/xxx        → /xxx
 */
function rewriteBody(buf, contentType) {
  if (!contentType || !/(text\/html|application\/javascript|text\/javascript|text\/css)/i.test(contentType)) {
    return buf;
  }
  let text = buf.toString('utf-8');
  text = text.replace(/https?:\/\/shimo\.im/g, `http://localhost:${PORT}`);
  text = text.replace(/\/\/shimo\.im/g, `//localhost:${PORT}`);
  return Buffer.from(text, 'utf-8');
}

/**
 * Rewrite Set-Cookie headers:
 *  - Change Domain from .shimo.im to localhost
 *  - Remove Secure flag (we're on HTTP)
 *  - Keep everything else intact
 */
function rewriteSetCookies(setCookieHeaders) {
  if (!setCookieHeaders) return [];
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return cookies.map(c =>
    c.replace(/;\s*Domain=[^;]*/gi, '; Domain=localhost')
     .replace(/;\s*Secure/gi, '')
     .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
  );
}

/**
 * Extract shimo_sid value from Set-Cookie headers
 */
function extractShimoSid(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const c of cookies) {
    const match = c.match(/shimo_sid=([^;]+)/);
    if (match && match[1] && match[1] !== '' && !match[1].startsWith('deleted')) {
      return match[1];
    }
  }
  return null;
}

async function main() {
  let serverClosed = false;
  let verifiedSid = false;
  const seenSids = new Set(); // track already-seen (invalid) sids

  const SUCCESS_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>登录成功</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f0f9f0; margin: 0; }
    .card { background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h1 { color: #2d8a2d; font-size: 28px; }
    p { color: #666; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ 登录成功</h1>
    <p>凭证已自动保存，可以关闭此页面了。</p>
  </div>
</body>
</html>`;

  const server = http.createServer((clientReq, clientRes) => {
    // If already verified, show success page for any page navigation
    if (verifiedSid && clientReq.headers.accept && clientReq.headers.accept.includes('text/html')) {
      clientRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      clientRes.end(SUCCESS_PAGE);
      return;
    }

    // Status check endpoint
    if (clientReq.url === '/__status__') {
      clientRes.writeHead(200, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ captured: verifiedSid }));
      return;
    }

    // Build proxy request options
    const proxyOptions = {
      hostname: TARGET_HOST,
      port: 443,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: TARGET_HOST,
        referer: (clientReq.headers.referer || '').replace(`http://localhost:${PORT}`, `https://${TARGET_HOST}`),
        origin: clientReq.headers.origin ? `https://${TARGET_HOST}` : undefined,
      },
    };

    // Remove headers that don't apply
    delete proxyOptions.headers['accept-encoding']; // avoid compressed responses for rewriting
    if (!proxyOptions.headers.origin) delete proxyOptions.headers.origin;

    const proxyReq = https.request(proxyOptions, (proxyRes) => {
      // Check for shimo_sid in Set-Cookie
      const rawSetCookie = proxyRes.headers['set-cookie'];
      const sid = extractShimoSid(rawSetCookie);
      if (sid && !verifiedSid && !seenSids.has(sid)) {
        seenSids.add(sid);
        // Verify asynchronously — only save if valid
        (async () => {
          const userInfo = await verifyLogin(sid);
          if (userInfo) {
            verifiedSid = true;
            saveEnvConfig({ shimo_sid: sid });
            console.log(`\n✅ 登录成功！用户: ${userInfo.name} (${userInfo.email || userInfo.id})`);
            console.log(`💾 凭证已保存到 ${ENV_FILE}`);
            setTimeout(() => {
              if (!serverClosed) {
                serverClosed = true;
                server.close();
                process.exit(0);
              }
            }, 2000);
          }
          // If invalid, silently ignore — keep waiting for the real login cookie
        })();
      }

      // Rewrite response headers
      const responseHeaders = { ...proxyRes.headers };

      // Rewrite Set-Cookie headers
      if (rawSetCookie) {
        responseHeaders['set-cookie'] = rewriteSetCookies(rawSetCookie);
      }

      // Remove security headers that would block our proxy
      delete responseHeaders['content-security-policy'];
      delete responseHeaders['content-security-policy-report-only'];
      delete responseHeaders['strict-transport-security'];
      delete responseHeaders['x-frame-options'];

      // Rewrite Location header for redirects
      if (responseHeaders.location) {
        responseHeaders.location = responseHeaders.location
          .replace(`https://${TARGET_HOST}`, `http://localhost:${PORT}`)
          .replace(`http://${TARGET_HOST}`, `http://localhost:${PORT}`);
      }

      // Collect body for potential rewriting
      const chunks = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks);
        const ct = proxyRes.headers['content-type'] || '';

        // Rewrite body content (URLs)
        body = rewriteBody(body, ct);

        // Fix content-length after rewrite
        responseHeaders['content-length'] = body.length;

        clientRes.writeHead(proxyRes.statusCode, responseHeaders);
        clientRes.end(body);
      });
    });

    proxyReq.on('error', (err) => {
      console.error(`代理请求失败: ${err.message}`);
      clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
      clientRes.end('Proxy Error: ' + err.message);
    });

    // Forward request body
    clientReq.on('data', chunk => proxyReq.write(chunk));
    clientReq.on('end', () => proxyReq.end());
  });

  server.listen(PORT, () => {
    const loginUrl = `http://localhost:${PORT}/login?from=home`;
    console.log(`🔗 请在浏览器中打开: ${loginUrl}`);
    console.log('');
    console.log('在页面中完成登录（扫码/短信/密码均可），登录成功后凭证会自动保存。');
    console.log(`等待中...（${TIMEOUT_MS / 60000} 分钟超时）`);

    // Auto-open browser
    const { exec } = require('child_process');
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} "${loginUrl}"`, () => {});
  });

  // Timeout
  setTimeout(() => {
    if (!serverClosed) {
      serverClosed = true;
      console.error(`\n❌ 超时（${TIMEOUT_MS / 60000} 分钟），请重新运行。`);
      server.close();
      process.exit(1);
    }
  }, TIMEOUT_MS);
}

main().catch(error => {
  console.error(`❌ 发生错误: ${error.message}`);
  process.exit(1);
});
