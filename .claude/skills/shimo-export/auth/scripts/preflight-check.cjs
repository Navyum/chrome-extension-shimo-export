/**
 * 石墨文档凭证预检脚本
 *
 * 检查 shimo_sid 是否存在且有效，输出用户信息或诊断错误。
 *
 * 优先级: 环境变量 SHIMO_COOKIE → 配置文件 config/env.json
 *
 * 使用方法:
 *   node preflight-check.cjs
 *
 * Exit codes:
 *   0 - 凭证有效
 *   1 - 凭证缺失或无效
 */

const path = require('path');
const fs = require('fs');

const ENV_FILE = path.join(__dirname, '..', '..', 'config', 'env.json');
const USER_API = 'https://shimo.im/lizard-api/users/me';

const HEADERS = {
  'Referer': 'https://shimo.im/desktop',
  'Accept': 'application/nd.shimo.v2+json, text/plain, */*',
  'X-Requested-With': 'SOS 2.0',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function main() {
  // 1. Load credential
  let cookie = process.env.SHIMO_COOKIE;
  let source = '环境变量 SHIMO_COOKIE';

  if (!cookie) {
    try {
      const config = JSON.parse(fs.readFileSync(ENV_FILE, 'utf-8'));
      cookie = config.shimo_sid || '';
      source = `配置文件 ${ENV_FILE}`;
    } catch {
      // File doesn't exist or can't be read
    }
  }

  if (!cookie) {
    console.error('❌ 未找到石墨凭证。');
    console.error('');
    console.error('请通过以下方式之一配置：');
    console.error('  推荐：运行 node auth/scripts/browser-login.cjs 扫码登录');
    console.error('  或者：export SHIMO_COOKIE="your_shimo_sid_value"');
    console.error(`  或者：在 ${ENV_FILE} 中设置 shimo_sid 字段`);
    process.exit(1);
  }

  console.log(`📋 凭证来源: ${source}`);
  console.log(`🔍 正在验证凭证...`);

  // 2. Verify credential
  try {
    const response = await fetch(USER_API, {
      method: 'GET',
      headers: {
        ...HEADERS,
        'Cookie': `shimo_sid=${cookie}`,
      },
    });

    if (!response.ok) {
      const statusMessages = {
        401: '凭证已过期或无效',
        403: '无权访问，可能是账号被限制',
        429: '请求过于频繁，请稍后重试',
      };
      const reason = statusMessages[response.status] || `未知错误`;
      console.error(`❌ 验证失败: HTTP ${response.status} — ${reason}`);

      if (response.status === 401) {
        console.error('');
        console.error('建议重新登录：');
        console.error('  node auth/scripts/browser-login.cjs');
      }
      process.exit(1);
    }

    const user = await response.json();
    console.log('');
    console.log('✅ 凭证有效！');
    console.log(`   用户 ID: ${user.id}`);
    console.log(`   用户名:  ${user.name}`);
    if (user.email) {
      console.log(`   邮箱:    ${user.email}`);
    }

  } catch (error) {
    console.error(`❌ 网络请求失败: ${error.message}`);
    console.error('请检查网络连接后重试。');
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`❌ 发生错误: ${error.message}`);
  process.exit(1);
});
