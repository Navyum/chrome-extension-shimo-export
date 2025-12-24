/**
 * 石墨文档团队空间获取调试脚本
 * 
 * 使用方法:
 * 1. 确保安装了 Node.js (建议 v18+)
 * 2. 在终端运行: node debug_team_spaces.js
 */

const SHIMO_SID = 's%3A57c8421aa79f4589897d9b88dcd2c158.JvxspM9V8X172udT6SmQ9BwpkUM9uvrYvZw5noAgRuU';

const SHIMO_API = {
  SPACE: 'https://shimo.im/panda-api/file/spaces?orderBy=updatedAt',
  PINNED_SPACE: 'https://shimo.im/panda-api/file/pinned_spaces',
  // 备用接口，有些版本可能使用这个
  TEAM_USAGE: 'https://shimo.im/panda-api/teams/usage',
  // 检查登录状态
  ME: 'https://shimo.im/lizard-api/users/me'
};

async function debugRequest(name, url) {
  console.log(`\n--- 正在测试: ${name} ---`);
  console.log(`URL: ${url}`);
  
  const headers = {
    'Referer': 'https://shimo.im/desktop',
    'Accept': 'application/nd.shimo.v2+json, text/plain, */*',
    'X-Requested-With': 'SOS 2.0',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': `shimo_sid=${SHIMO_SID}`
  };

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      redirect: 'follow'
    });

    console.log(`状态码: ${response.status} ${response.statusText}`);
    
    const contentType = response.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);

    if (response.ok) {
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log('响应不是 JSON 格式:', text.substring(0, 200));
        return;
      }
      
      console.log('响应数据摘要:');
      if (name === '团队空间列表') {
        if (data && Array.isArray(data.spaces)) {
          console.log(`找到团队空间数量: ${data.spaces.length}`);
          data.spaces.forEach((s, i) => {
            console.log(`  ${i + 1}. [${s.guid}] ${s.name} (成员数: ${s.membersCount || 0})`);
          });
        } else if (data && data.spaces) {
          console.log('spaces 字段存在但不是数组:', typeof data.spaces);
          console.log(data.spaces);
        } else {
          console.log('未找到 spaces 字段，完整响应:', JSON.stringify(data, null, 2));
        }
      } else {
        console.log(JSON.stringify(data, null, 2).substring(0, 1000) + (text.length > 1000 ? '...' : ''));
      }
    } else {
      const errorText = await response.text();
      console.error(`请求失败 (HTTP ${response.status}): ${errorText.substring(0, 500)}`);
    }
  } catch (error) {
    console.error(`请求异常: ${error.message}`);
  }
}

async function runDebug() {
  console.log('开始石墨 API 调试...');
  console.log(`当前使用的 shimo_sid: ${SHIMO_SID}`);

  // 1. 先检查登录状态
  await debugRequest('用户信息 (检查登录)', SHIMO_API.ME);

  // 2. 检查团队空间列表
  await debugRequest('团队空间列表', SHIMO_API.SPACE);

  // 3. 检查置顶团队空间列表
  await debugRequest('置顶团队空间列表', SHIMO_API.PINNED_SPACE);

  // 4. 检查团队使用情况 (可选)
  await debugRequest('团队使用情况', SHIMO_API.TEAM_USAGE);
  
  // 5. 合并去重测试
  console.log('\n--- 合并去重测试 ---');
  try {
    const spaceResponse = await fetch(SHIMO_API.SPACE, {
      headers: {
        'Cookie': `shimo_sid=${SHIMO_SID}`,
        'Referer': 'https://shimo.im/desktop',
        'Accept': 'application/nd.shimo.v2+json, text/plain, */*'
      }
    });
    const pinnedResponse = await fetch(SHIMO_API.PINNED_SPACE, {
      headers: {
        'Cookie': `shimo_sid=${SHIMO_SID}`,
        'Referer': 'https://shimo.im/desktop',
        'Accept': 'application/nd.shimo.v2+json, text/plain, */*'
      }
    });
    
    const spaceData = spaceResponse.ok ? await spaceResponse.json() : { spaces: [] };
    const pinnedData = pinnedResponse.ok ? await pinnedResponse.json() : { spaces: [] };
    
    const spacesMap = new Map();
    if (Array.isArray(spaceData.spaces)) {
      spaceData.spaces.forEach(s => { if (s.guid) spacesMap.set(s.guid, s); });
    }
    if (Array.isArray(pinnedData.spaces)) {
      pinnedData.spaces.forEach(s => { if (s.guid) spacesMap.set(s.guid, s); });
    }
    
    console.log(`合并前: 普通空间 ${spaceData.spaces?.length || 0} 个，置顶空间 ${pinnedData.spaces?.length || 0} 个`);
    console.log(`合并后（去重）: ${spacesMap.size} 个团队空间`);
    spacesMap.forEach((s, guid) => {
      console.log(`  - [${guid}] ${s.name}`);
    });
  } catch (error) {
    console.error('合并去重测试失败:', error.message);
  }
}

runDebug().catch(console.error);

