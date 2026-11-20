const { REVIEW_URL, estimateManualTimeSaved } = require('./export-success-model');
const { showConfetti } = require('./confetti');

function initExportSuccess(root, browser) {
  const dialog = document.getElementById('export-success');
  const byId = id => document.getElementById(`export-success-${id}`);
  let generation = 0;
  let preferenceVersion = 0;
  let reviewBusy = false;

  function setReviewDismissed(dismissed) {
    byId('review-hint').hidden = dismissed;
    byId('dismiss').hidden = dismissed;
  }
  byId('done').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    generation++;
    dialog.classList.remove('is-celebrating');
    // 提前关闭确认框时，撒花仍持续到原定的五秒结束。
    const confetti = dialog.querySelector('.export-confetti-container');
    if (confetti) document.body.appendChild(confetti);
    const start = root.querySelector('#selection-start');
    if (root.classList.contains('active') && !start.disabled) start.focus({ preventScroll: true });
  });
  window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); });

  async function reviewAction(openStore) {
    if (reviewBusy) return;
    reviewBusy = true;
    const current = generation;
    byId('error').textContent = '';
    byId('rate').disabled = byId('dismiss').disabled = true;
    try {
      if (openStore) await browser.tabs.create({ url: REVIEW_URL });
      await browser.storage.local.set({ ratingDismissed: true });
      preferenceVersion++;
      setReviewDismissed(true);
      if (current === generation && dialog.open) byId('done').focus();
    } catch {
      if (current === generation && dialog.open) {
        byId('error').textContent = openStore
          ? '打开评价页面或保存偏好失败，请稍后重试。'
          : '未能保存评价偏好，请稍后重试。';
      }
    } finally {
      reviewBusy = false;
      byId('rate').disabled = byId('dismiss').disabled = false;
    }
  }
  byId('dismiss').addEventListener('click', () => { void reviewAction(false); });
  byId('rate').addEventListener('click', () => { void reviewAction(true); });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ratingDismissed) {
      preferenceVersion++;
      const restoreFocus = document.activeElement === byId('dismiss');
      setReviewDismissed(Boolean(changes.ratingDismissed.newValue));
      if (dialog.open && restoreFocus && byId('dismiss').hidden) byId('done').focus();
    }
  });

  return async function showExportSuccess(count) {
    const current = ++generation;
    const preference = preferenceVersion;
    setReviewDismissed(true);
    byId('error').textContent = '';
    byId('summary').textContent = `已成功导出 ${count} 篇文档。`;
    const savedTime = estimateManualTimeSaved(count);
    byId('savings').hidden = !savedTime;
    byId('saved-time').textContent = savedTime;
    dialog.classList.remove('is-celebrating');
    if (!dialog.open) dialog.showModal();
    void dialog.offsetWidth;
    dialog.classList.add('is-celebrating');
    showConfetti(dialog);
    try {
      const { ratingDismissed } = await browser.storage.local.get(['ratingDismissed']);
      if (current === generation && preference === preferenceVersion && dialog.open) {
        setReviewDismissed(Boolean(ratingDismissed));
      }
    } catch {
      // 偏好读取失败不阻断成功确认。
    }
  };
}

module.exports = { initExportSuccess };
