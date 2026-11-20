function initAccountPanel(browser) {
  const button = document.getElementById('login-btn');
  const panel = document.getElementById('account-panel');
  const icon = button.querySelector('.login-icon');
  const initial = document.getElementById('account-initial');
  let avatar = document.getElementById('account-avatar');
  const name = document.getElementById('account-name');
  const status = document.getElementById('account-status');
  const retry = document.getElementById('account-retry');
  const login = document.getElementById('account-login');
  const home = document.getElementById('account-home');
  let loading = false;
  function loadAvatar(url) {
    // 每次刷新使用独立图片，旧账号的延迟回调不能覆盖当前头像。
    const image = document.createElement('img');
    image.id = 'account-avatar';
    image.className = 'account-avatar';
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.hidden = true;
    avatar.replaceWith(image);
    avatar = image;
    if (!url) return;
    image.addEventListener('load', () => {
      if (avatar !== image || !image.naturalWidth) return;
      image.hidden = false;
      initial.hidden = true;
    });
    image.addEventListener('error', () => {
      if (avatar !== image) return;
      image.hidden = true;
      initial.hidden = false;
    });
    image.src = url;
  }
  function close(restoreFocus = false) {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }
  async function refresh() {
    if (loading) return;
    loading = true;
    retry.hidden = true;
    name.hidden = login.hidden = home.hidden = initial.hidden = true;
    loadAvatar('');
    icon.hidden = false;
    button.title = '查看石墨账号';
    button.setAttribute('aria-label', button.title);
    status.textContent = '正在获取账号信息…';
    try {
      const response = await browser.runtime.sendMessage({ action: 'getUserInfo' });
      if (!response?.success) {
        login.hidden = false;
        if (response?.status === 401 || response?.status === 403) {
          status.textContent = '登录已失效，请前往石墨登录后重试。';
          return;
        }
        throw new Error('暂时无法获取账号信息，请重试。');
      }
      const displayName = response.data.name || '石墨用户';
      name.textContent = displayName;
      name.hidden = false;
      initial.textContent = Array.from(displayName.trim())[0] || '石';
      initial.hidden = false;
      icon.hidden = true;
      loadAvatar(response.data.avatarUrl);
      button.title = `石墨账号：${displayName}`;
      button.setAttribute('aria-label', button.title);
      home.hidden = false;
      status.textContent = '已登录石墨文档';
    } catch (error) {
      status.textContent = '暂时无法获取账号信息，请重试。';
      login.hidden = false;
    } finally {
      loading = false;
      retry.hidden = false;
    }
  }
  button.addEventListener('click', () => {
    if (!panel.hidden) { close(); return; }
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.focus();
    void refresh();
  });
  retry.addEventListener('click', refresh);
  async function open(url) {
    try { await browser.tabs.create({ url }); close(true); }
    catch (error) { status.textContent = '无法打开页面，请重试。'; }
  }
  login.addEventListener('click', () => open('https://shimo.im/loginByPassword?from=home'));
  home.addEventListener('click', () => open('https://shimo.im/desktop'));
  document.addEventListener('click', event => {
    if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); }
  });
  panel.addEventListener('focusout', event => {
    if (event.relatedTarget && !panel.contains(event.relatedTarget) && event.relatedTarget !== button) close();
  });
  void refresh();
}

module.exports = { initAccountPanel };
