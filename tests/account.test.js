const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAvatarUrl } = require('../src/account-model');
const { harness } = require('./background-harness');

test('石墨账号 avatar 字段通过后台传递给 popup，不丢失头像地址', async () => {
  const h = await harness({}, async url => {
    assert.equal(url, 'https://shimo.im/lizard-api/users/me');
    return { ok: true, json: async () => ({ id: 1, name: '测试', avatar: '//assets.shimonote.com/avatar.png' }) };
  });
  const response = await h.request('getUserInfo');
  assert.equal(response.success, true);
  assert.equal(response.data.avatarUrl, 'https://assets.shimonote.com/avatar.png');
});

test('头像缺失时回退，地址支持HTTPS、协议相对与站内路径，拒绝非图片网络协议', () => {
  for (const value of [null, undefined, '', '  ', {}, 'javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.test/a.png']) {
    assert.equal(normalizeAvatarUrl(value), '');
  }
  assert.equal(normalizeAvatarUrl(' https://assets.shimonote.com/a.png '), 'https://assets.shimonote.com/a.png');
  assert.equal(normalizeAvatarUrl('/avatar/a.png'), 'https://shimo.im/avatar/a.png');
});

const { avatarRequestRule, createAvatarRequestSetup } = require('../src/avatar-request');

test('头像来源头仅作用于当前扩展发往指定CDN的HTTPS图片请求', () => {
  for (const origin of ['chrome-extension://test-id/', 'moz-extension://test-uuid/']) {
    const rule = avatarRequestRule(origin);
    assert.deepEqual(rule.condition, {
      urlFilter: '|https://oavatar.shimonote.com/',
      initiatorDomains: [new URL(origin).hostname],
      resourceTypes: ['image']
    });
    assert.deepEqual(rule.action.requestHeaders, [{ header: 'Referer', operation: 'set', value: 'https://shimo.im/' }]);
  }
});

test('并发账号查询等待同一头像规则安装，失败后可以重试', async () => {
  let attempts = 0;
  let release;
  const setup = createAvatarRequestSetup({
    runtime: { getURL: () => 'chrome-extension://test-id/' },
    declarativeNetRequest: { updateSessionRules: async () => {
      attempts++;
      if (attempts === 1) throw new Error('规则安装失败');
      return new Promise(resolve => { release = resolve; });
    } }
  });
  await assert.rejects(setup(), /规则安装失败/);
  const one = setup(), two = setup();
  assert.equal(one, two);
  assert.equal(attempts, 2);
  release();
  await Promise.all([one, two]);
  await setup();
  assert.equal(attempts, 2);
});
