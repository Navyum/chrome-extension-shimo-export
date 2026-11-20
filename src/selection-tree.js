const { buildSelectionTree, normalizeSelection, selectionReason } = require('./selection-model');

function createSelectionTree(container, catalog, onChange) {
  const { root, branches } = buildSelectionTree(catalog);
  const inputs = new Map();
  const counts = new Map();
  let selected = new Set();
  let disabled = false;
  const doc = container.ownerDocument;
  function element(tag, className, text) {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  // 子节点先于父节点计算，避免每个勾选框重复遍历完整目录。
  function count() {
    for (let i = branches.length - 1; i >= 0; i--) {
      let total = 0, available = 0, checked = 0;
      for (const child of branches[i].children) {
        if (child.kind === 'folder') {
          const nested = counts.get(child);
          total += nested.total; available += nested.available; checked += nested.checked;
        } else {
          total++;
          if (!selectionReason(child)) available++;
          if (selected.has(child.selectionId)) checked++;
        }
      }
      counts.set(branches[i], { total, available, checked });
    }
  }
  function sync() {
    for (const [input, node] of inputs) {
      if (node.kind === 'file') {
        input.checked = selected.has(node.selectionId);
        input.disabled = disabled || Boolean(selectionReason(node));
      } else {
        const { available, checked } = counts.get(node);
        input.checked = available > 0 && checked === available;
        input.indeterminate = checked > 0 && checked < available;
        input.disabled = disabled || !available;
      }
    }
  }
  function change(node, checked) {
    const pending = [node];
    while (pending.length) {
      const next = pending.pop();
      if (next.kind === 'folder') {
        for (const child of next.children) pending.push(child);
      }
      else if (!selectionReason(next)) {
        if (checked) selected.add(next.selectionId);
        else selected.delete(next.selectionId);
      }
    }
    count(); sync(); onChange([...selected]);
  }
  function renderChildren(parent, children) {
    let offset = 0;
    const more = element('button', 'selection-more', '显示更多');
    more.type = 'button';
    const append = () => {
      more.remove();
      const fragment = doc.createDocumentFragment();
      for (const node of children.slice(offset, offset + 100)) fragment.appendChild(render(node));
      parent.appendChild(fragment);
      offset += 100;
      if (offset < children.length) parent.appendChild(more);
      sync();
    };
    more.addEventListener('click', append);
    append();
  }
  function render(node) {
    const item = element('li', `selection-item selection-${node.kind}`);
    const row = element('div', 'selection-row');
    item.appendChild(row);
    let children;
    if (node.kind === 'folder') {
      const expand = element('button', 'selection-expand', '▸');
      expand.type = 'button';
      expand.setAttribute('aria-label', `展开或折叠 ${node.title}`);
      expand.setAttribute('aria-expanded', 'false');
      children = element('ul', 'selection-children');
      children.hidden = true;
      let rendered = false;
      expand.addEventListener('click', () => {
        children.hidden = !children.hidden;
        expand.textContent = children.hidden ? '▸' : '▾';
        expand.setAttribute('aria-expanded', String(!children.hidden));
        if (!rendered) { rendered = true; renderChildren(children, node.children); }
      });
      row.appendChild(expand);
    } else row.appendChild(element('span', 'selection-spacer'));
    const label = element('label', 'selection-label');
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.dataset.selectionKey = node.kind === 'file' ? node.selectionId : node.id;
    inputs.set(input, node);
    input.addEventListener('change', () => change(node, input.checked));
    const icon = element('span', `selection-icon selection-icon-${node.kind}`);
    icon.setAttribute('aria-hidden', 'true');
    const title = element('span', 'selection-title', node.title || '无标题');
    title.title = node.title || '无标题';
    label.append(input, icon, title);
    row.appendChild(label);
    const details = node.kind === 'folder' ? `${counts.get(node).total} 个文档` : selectionReason(node);
    if (details) row.appendChild(element('span', 'selection-detail', details));
    if (children) item.appendChild(children);
    return item;
  }
  count();
  container.replaceChildren();
  const list = element('ul', 'selection-tree');
  container.appendChild(list);
  renderChildren(list, root.children);
  return {
    setSelection(ids) { selected = new Set(normalizeSelection(catalog, ids)); count(); sync(); },
    setDisabled(value) { if (disabled !== value) { disabled = value; sync(); } }
  };
}

module.exports = { createSelectionTree };
