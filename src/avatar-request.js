const AVATAR_RULE_ID = 1101;

function avatarRequestRule(extensionURL) {
  return {
    id: AVATAR_RULE_ID,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'Referer', operation: 'set', value: 'https://shimo.im/' }]
    },
    condition: {
      urlFilter: '|https://oavatar.shimonote.com/',
      initiatorDomains: [new URL(extensionURL).hostname],
      resourceTypes: ['image']
    }
  };
}

function createAvatarRequestSetup(browser) {
  let ready;
  return () => {
    if (!ready) {
      ready = browser.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [AVATAR_RULE_ID],
        addRules: [avatarRequestRule(browser.runtime.getURL(''))]
      }).catch(error => {
        ready = null;
        throw error;
      });
    }
    return ready;
  };
}

module.exports = { avatarRequestRule, createAvatarRequestSetup };
