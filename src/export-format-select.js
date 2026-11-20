// popup 和设置页共用带图标的格式选择器，原生 select 保留值与 change 事件。
function enhanceSelectInteraction(select) {
  const container = select.closest('.select-container');
  const trigger = container.querySelector('.select-trigger');
  const list = container.querySelector('.select-options');
  const icon = container.querySelector('.select-icon');
  const label = container.querySelector('.select-trigger-text');
  if (!trigger || !list || container.classList.contains('is-enhanced')) return;
  const buttons = [];
  const close = (restoreFocus = false) => {
    const wasOpen = container.classList.contains('is-open');
    container.classList.remove('is-open');
    container.closest('.form-group')?.classList.remove('is-select-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && wasOpen && !trigger.disabled) trigger.focus();
  };
  const sync = () => {
    const option = select.selectedOptions[0];
    label.textContent = option?.textContent.trim() || '导出格式';
    icon.hidden = !option?.dataset.icon;
    if (!icon.hidden) icon.src = option.dataset.icon;
    icon.alt = '';
    container.classList.toggle('has-icon', !icon.hidden);
    container.classList.toggle('has-selection', Boolean(select.value));
    trigger.disabled = select.disabled;
    if (select.disabled) close();
    buttons.forEach(button => {
      const active = button.dataset.value === select.value;
      button.parentElement.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  };
  for (const option of select.options) {
    const li = document.createElement('li');
    li.className = 'select-option-item';
    li.setAttribute('role', 'presentation');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'select-option-button';
    button.dataset.value = option.value;
    button.tabIndex = -1;
    button.setAttribute('role', 'option');
    if (option.dataset.icon) {
      const img = document.createElement('img');
      img.src = option.dataset.icon;
      img.alt = '';
      button.appendChild(img);
    }
    button.appendChild(document.createTextNode(option.textContent.trim()));
    button.addEventListener('click', () => {
      if (select.disabled) return;
      select.value = option.value;
      close(true);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    buttons.push(button);
    li.appendChild(button);
    list.appendChild(li);
  }
  const open = () => {
    if (select.disabled) return;
    container.classList.add('is-open');
    container.closest('.form-group')?.classList.add('is-select-open');
    trigger.setAttribute('aria-expanded', 'true');
    (buttons.find(button => button.dataset.value === select.value) || buttons[0])?.focus();
  };
  trigger.addEventListener('click', () => container.classList.contains('is-open') ? close(true) : open());
  container.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!container.classList.contains('is-open')) { open(); return; }
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
        (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
    if (event.key === 'Tab') close();
  });
  document.addEventListener('click', event => { if (!container.contains(event.target)) close(); });
  container.addEventListener('focusout', event => { if (!container.contains(event.relatedTarget)) close(); });
  select.addEventListener('change', sync);
  select.addEventListener('format-refresh', sync);
  new MutationObserver(sync).observe(select, { attributes: true, attributeFilter: ['disabled'] });
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const labelId = select.labels?.[0]?.id;
  if (labelId) trigger.setAttribute('aria-labelledby', `${labelId} ${label.id}`);
  else trigger.setAttribute('aria-label', '导出格式');
  if (!list.id) list.id = `${select.id || select.dataset.type}-options`;
  trigger.setAttribute('aria-controls', list.id);
  list.setAttribute('aria-label', '导出格式');
  trigger.hidden = false;
  list.hidden = false;
  icon.classList.add('is-visible');
  container.classList.add('is-enhanced');
  sync();
}

module.exports = { enhanceSelectInteraction };
