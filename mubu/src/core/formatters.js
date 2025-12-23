import { EXPORT_FORMATS, MUBU_API } from './constants.js';

export function buildExportPayload(definition, exportType, fileMeta = {}) {
  const format = EXPORT_FORMATS[exportType] || EXPORT_FORMATS.md;
  let content = '';

  switch (exportType) {
    case 'opml':
      content = definitionToOpml(definition, fileMeta);
      break;
    case 'json':
      content = JSON.stringify(definition, null, 2);
      break;
    case 'mm':
      content = definitionToFreemind(definition, fileMeta);
      break;
    case 'html':
      content = definitionToHtml(definition, fileMeta);
      break;
    default:
      content = definitionToMarkdown(definition);
  }

  if (!content.endsWith('\n')) {
    content += '\n';
  }

  return {
    content,
    extension: format.extension,
    mime: format.mime
  };
}

function definitionToMarkdown(definition) {
  const nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
  if (!nodes.length) return '';

  const lines = [];

  const traverse = (items, depth) => {
    items.forEach(node => {
      const indent = '  '.repeat(depth);
      const bulletPrefix = `${indent}- `;
      const continuationPrefix = `${indent}  `;
      const notePrefix = `${'  '.repeat(depth + 1)}> `;

      const parts = buildNodeContentParts(node);
      appendMarkdownLines(lines, bulletPrefix, continuationPrefix, parts[0] ?? '(空)');
      parts.slice(1).forEach(part => {
        appendMarkdownLines(lines, continuationPrefix, continuationPrefix, part);
      });

      if (node.note) {
        const note = htmlToFormattedMarkdown(node.note);
        if (note) {
          appendMarkdownLines(lines, notePrefix, notePrefix, note);
        }
      }

      if (Array.isArray(node.children) && node.children.length) {
        traverse(node.children, depth + 1);
      }
    });
  };

  traverse(nodes, 0);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function buildNodeContentParts(node = {}) {
  const parts = [];
  const headingLevel = (Number.isInteger(node.heading) && node.heading > 0)
    ? Math.min(6, node.heading)
    : 0;
  const textContent = htmlToFormattedMarkdown(node.text);

  if (textContent) {
    parts.push(headingLevel ? `${'#'.repeat(headingLevel)} ${textContent}` : textContent);
  } else if (headingLevel) {
    parts.push(`${'#'.repeat(headingLevel)} (空)`);
  }

  const images = extractImageListFromNode(node);
  if (images.length) {
    const altBase = sanitizeMarkdownText(htmlToPlainText(node.text) || 'image');
    images.forEach((img, index) => {
      const imageMarkdown = buildImageMarkdown(img, `${altBase || 'image'}-${index + 1}`);
      if (imageMarkdown) {
        parts.push(imageMarkdown);
      }
    });
  }

  if (!parts.length) {
    parts.push('(空)');
  }

  return parts;
}

function extractImageListFromNode(node = {}) {
  const images = [];
  if (node.image && typeof node.image === 'object') {
    images.push(node.image);
  }
  if (Array.isArray(node.images)) {
    node.images.forEach(image => {
      if (image && typeof image === 'object') {
        images.push(image);
      }
    });
  }
  if (Array.isArray(node.imageList)) {
    node.imageList.forEach(image => {
      if (image && typeof image === 'object') {
        images.push(image);
      }
    });
  }
  return images;
}

function normalizeMubuImageUrl(uri = '') {
  if (!uri || typeof uri !== 'string') {
    return '';
  }
  return uri.startsWith('http')
    ? uri
    : `${MUBU_API.IMAGE_HOST}${uri.replace(/^\/+/, '')}`;
}

function buildImageMarkdown(image = {}, fallbackAlt = 'image') {
  const normalizedUri = normalizeMubuImageUrl(image.uri || image.url);
  if (!normalizedUri) {
    return '';
  }

  const width = Number(image.w || image.width);
  const widthSuffix = Number.isFinite(width) && width > 0
    ? `${normalizedUri.includes('?') ? '&' : '?'}x-tos-process=image/resize,w_${Math.round(width)}`
    : '';

  const alt = sanitizeMarkdownText(image.alt || image.name || fallbackAlt) || 'image';
  return `![${alt}](${normalizedUri}${widthSuffix})`;
}

function sanitizeMarkdownText(text = '') {
  return (text || '')
    .replace(/\r|\n/g, ' ')
    .replace(/[\[\]\(\)`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendMarkdownLines(lines, firstPrefix, continuationPrefix, content) {
  const value = (content === undefined || content === null || content === '') ? '(空)' : String(content);
  const fragments = value.split('\n');
  fragments.forEach((fragment, index) => {
    const prefix = index === 0 ? firstPrefix : continuationPrefix;
    lines.push(`${prefix}${fragment}`.trimEnd());
  });
}

function definitionToOpml(definition, fileMeta = {}) {
  const nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
  const rawTitle = typeof fileMeta?.title === 'string' ? fileMeta.title.trim() : '';
  const opmlTitle = escapeXml(rawTitle || 'Mubu Export');
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    `  <head><title>${opmlTitle}</title></head>`,
    '  <body>'
  ];

  const traverse = (items, depth) => {
    items.forEach(node => {
      const indent = '  '.repeat(depth + 1);
      const text = escapeXml(htmlToPlainText(node.text) || '空节点');
      lines.push(`${indent}<outline text="${text}">`);

      if (node.note) {
        const note = escapeXml(htmlToPlainText(node.note));
        if (note) {
          lines.push(`${indent}  <note>${note}</note>`);
        }
      }

      if (Array.isArray(node.children) && node.children.length) {
        traverse(node.children, depth + 1);
      }

      lines.push(`${indent}</outline>`);
    });
  };

  traverse(nodes, 0);
  lines.push('  </body>', '</opml>');
  return lines.join('\n');
}

function definitionToFreemind(definition, fileMeta = {}) {
  const nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
  const rootTitle = sanitizeFreemindAttribute(fileMeta?.title || 'Mubu 导出');
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<map version="1.0.1">',
    `  <node TEXT="${rootTitle}" ID="root">`
  ];

  let autoId = 0;
  const generateNodeId = rawId => {
    if (rawId && typeof rawId === 'string') {
      const normalized = rawId.replace(/[^A-Za-z0-9_-]/g, '_');
      if (normalized) {
        return normalized;
      }
    }
    autoId += 1;
    return `mubu_${autoId}`;
  };

  const buildNoteHtml = node => {
    const noteParts = [];
    const noteText = htmlToPlainText(node?.note);
    if (noteText) {
      noteParts.push(noteText);
    }
    const imageLinks = extractImageListFromNode(node)
      .map(image => normalizeMubuImageUrl(image?.uri || image?.url))
      .filter(Boolean);
    if (imageLinks.length) {
      noteParts.push(['图片链接：', ...imageLinks].join('\n'));
    }
    if (!noteParts.length) {
      return '';
    }
    const merged = noteParts.join('\n\n');
    const paragraphs = merged
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length)
      .map(line => `<p>${escapeXml(line)}</p>`)
      .join('');
    return paragraphs || `<p>${escapeXml(merged.trim())}</p>`;
  };

  const traverse = (items, depth) => {
    items.forEach(node => {
      const indent = '  '.repeat(depth);
      const text = sanitizeFreemindAttribute(htmlToPlainText(node?.text) || '空节点');
      const foldedAttr = node?.collapsed ? ' FOLDED="true"' : '';
      const nodeId = generateNodeId(node?.id);
      lines.push(`${indent}<node TEXT="${text}" ID="${nodeId}"${foldedAttr}>`);

      const noteHtml = buildNoteHtml(node);
      if (noteHtml) {
        lines.push(`${indent}  <richcontent TYPE="NOTE"><html><head></head><body>${noteHtml}</body></html></richcontent>`);
      }

      if (Array.isArray(node?.children) && node.children.length) {
        traverse(node.children, depth + 1);
      }

      lines.push(`${indent}</node>`);
    });
  };

  if (nodes.length) {
    traverse(nodes, 2);
  }

  lines.push('  </node>', '</map>');
  return lines.join('\n');
}

function sanitizeFreemindAttribute(value = '') {
  const safe = (value || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return escapeXml(safe || '空节点');
}

function definitionToHtml(definition, fileMeta = {}) {
  const nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
  const title = escapeXml((fileMeta?.title || 'Mubu 导出').trim() || 'Mubu 导出');
  const exportedAt = escapeXml(new Date().toLocaleString());
  const lines = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    `  <title>${title}</title>`,
    '  <style>',
    '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; margin: 24px; background: #f7f7fb; color: #1f2933; }',
    '    header { margin-bottom: 24px; }',
    '    h1 { margin: 0 0 4px; font-size: 1.8rem; }',
    '    .meta { margin: 0; color: #6b7280; font-size: 0.9rem; }',
    '    ul.node-list { list-style: none; padding-left: 18px; margin-left: 0; }',
    '    ul.node-list li { background: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08); }',
    '    .node-heading { margin: 0 0 6px; color: #0f172a; }',
    '    .node-text { font-weight: 500; margin-bottom: 4px; }',
    '    .node-note { margin-top: 8px; padding-left: 12px; border-left: 3px solid #edf2ff; color: #475569; }',
    '    .node-note p { margin: 4px 0; }',
    '    .node-images { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; }',
    '    .node-images img { max-width: 200px; border-radius: 6px; border: 1px solid #e2e8f0; }',
    '    .node-images figcaption { font-size: 0.8rem; color: #6b7280; text-align: center; margin-top: 4px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <header>',
    `    <h1>${title}</h1>`,
    `    <p class="meta">导出时间：${exportedAt}</p>`,
    '  </header>'
  ];

  if (nodes.length) {
    renderNodeList(nodes, 0);
  } else {
    lines.push('  <p>暂无内容。</p>');
  }

  lines.push('</body>', '</html>');
  return lines.join('\n');

  function renderNodeList(items, depth) {
    const indent = '  '.repeat(depth + 1);
    lines.push(`${indent}<ul class="node-list depth-${depth}">`);
    items.forEach(node => {
      lines.push(`${indent}  <li>`);
      renderNodeBlock(node, depth + 2);
      if (Array.isArray(node?.children) && node.children.length) {
        renderNodeList(node.children, depth + 1);
      }
      lines.push(`${indent}  </li>`);
    });
    lines.push(`${indent}</ul>`);
  }

  function renderNodeBlock(node, depth) {
    const indent = '  '.repeat(depth);
    const headingLevel = (Number.isInteger(node?.heading) && node.heading > 0)
      ? Math.min(6, node.heading)
      : 0;
    const textValue = formatTextForHtml(htmlToPlainText(node?.text) || '空节点');
    const tagName = headingLevel ? `h${headingLevel}` : 'div';
    const className = headingLevel ? 'node-heading' : 'node-text';
    lines.push(`${indent}<${tagName} class="${className}">${textValue}</${tagName}>`);

    const noteText = htmlToPlainText(node?.note);
    if (noteText) {
      lines.push(`${indent}<div class="node-note"><strong>备注：</strong><p>${formatTextForHtml(noteText)}</p></div>`);
    }

    const images = extractImageListFromNode(node)
      .map(image => ({
        src: normalizeMubuImageUrl(image?.uri || image?.url),
        alt: image?.alt || image?.name || htmlToPlainText(node?.text) || 'image'
      }))
      .filter(image => image.src);

    if (images.length) {
      lines.push(`${indent}<div class="node-images">`);
      images.forEach(image => {
        const safeAlt = escapeXml((image.alt || 'image').trim() || 'image');
        lines.push(`${indent}  <figure>`);
        lines.push(`${indent}    <img src="${image.src}" alt="${safeAlt}" loading="lazy" />`);
        lines.push(`${indent}    <figcaption>${safeAlt}</figcaption>`);
        lines.push(`${indent}  </figure>`);
      });
      lines.push(`${indent}</div>`);
    }
  }
}

function formatTextForHtml(value = '') {
  if (!value) return '';
  return escapeXml(value).replace(/\r?\n/g, '<br />');
}

function htmlToFormattedMarkdown(input = '') {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let html = input.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/(p|div|h\d)>/gi, '\n');
  html = html.replace(/<li[^>]*>/gi, '\n- ');
  html = transformSpanMarkup(html);

  html = wrapSimpleTags(html, ['strong', 'b'], content => wrapWithMarkers(content, '**'));
  html = wrapSimpleTags(html, ['em', 'i'], content => wrapWithMarkers(content, '*'));
  html = wrapSimpleTags(html, ['code'], content => (content.trim() ? `\`${content.trim()}\`` : content));
  html = wrapSimpleTags(html, ['u'], content => (content.trim() ? `<u>${content.trim()}</u>` : content));
  html = wrapSimpleTags(html, ['s', 'del', 'strike'], content => wrapWithMarkers(content, '~~'));

  html = html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner = '') => {
    const cleaned = inner.trim();
    return cleaned ? `\n\`\`\`\n${cleaned}\n\`\`\`\n` : '';
  });

  html = html.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href = '', inner = '') => {
    const label = inner.trim() || href;
    const safeHref = (href || '').replace(/\)/g, '\\)');
    return safeHref ? `[${label}](${safeHref})` : label;
  });

  html = html.replace(/<img[^>]*>/gi, match => convertInlineImageTag(match));

  html = stripDisallowedTags(html);

  return decodeHtmlEntities(html)
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trimEnd())
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n')
    .trim();
}

const ALLOWED_INLINE_TAGS = new Set(['mark', 'span', 'u']);

function stripDisallowedTags(input = '') {
  if (!input) return '';
  return input.replace(/<\/?([a-z0-9-]+)(?:[^>]*?)>/gi, (match, tagName = '') => {
    return ALLOWED_INLINE_TAGS.has(tagName.toLowerCase()) ? match : '';
  });
}

function transformSpanMarkup(html = '') {
  if (!html) return '';

  const spanRegex = /<span([^>]*)>([\s\S]*?)<\/span>/gi;
  return html.replace(spanRegex, (match, attrs = '', inner = '') => {
    const classes = extractClassList(attrs);
    const transformedInner = transformSpanMarkup(inner);
    const hasOtherAttributes = hasNonClassAttributes(attrs);

    if (!classes.length && !hasOtherAttributes) {
      return transformedInner;
    }

    if (!classes.length) {
      return match;
    }

    const transformed = applyClassTokens(classes, transformedInner);
    return transformed === transformedInner ? transformedInner : transformed;
  });
}

function wrapSimpleTags(html, tags, formatter) {
  return tags.reduce((acc, tag) => {
    const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    return acc.replace(regex, (_, inner = '') => formatter(inner));
  }, html);
}

function wrapWithMarkers(content, marker) {
  const value = content.trim();
  return value ? `${marker}${value}${marker}` : content;
}

function convertInlineImageTag(tagHtml) {
  const srcMatch = tagHtml.match(/src\s*=\s*["']([^"']+)["']/i);
  if (!srcMatch) return '';
  const altMatch = tagHtml.match(/alt\s*=\s*["']([^"']*)["']/i);
  const alt = sanitizeMarkdownText(altMatch ? altMatch[1] : 'image') || 'image';
  const src = srcMatch[1];
  return `![${alt}](${src})`;
}

function extractClassList(attrs = '') {
  const match = attrs.match(/class\s*=\s*["']([^"']+)["']/i);
  if (!match) return [];
  return match[1]
    .split(/\s+/)
    .map(cls => cls.trim())
    .filter(Boolean);
}

function hasNonClassAttributes(attrs = '') {
  if (!attrs) return false;
  const withoutClass = attrs.replace(/class\s*=\s*["'][^"']*["']/i, '');
  return withoutClass.trim().length > 0;
}

function applyClassTokens(classes = [], content = '') {
  let result = typeof content === 'string' ? content : '';
  if (!result.trim()) {
    return result;
  }

  if (classes.includes('codespan')) {
    result = `\`${result.trim()}\``;
  }
  if (classes.includes('bold')) {
    result = ` **${result.trim()}** `;
  }
  if (classes.includes('italic')) {
    result = ` *${result.trim()}* `;
  }
  if (classes.includes('underline')) {
    result = ` <u>${result.trim()}</u> `;
  }
  if (classes.includes('strikethrough')) {
    result = ` ~~${result.trim()}~~ `;
  }

  const textColorClass = classes.find(cls => cls.startsWith('text-color-'));
  if (textColorClass) {
    const colorToken = textColorClass.replace('text-color-', '').trim().toLowerCase();
    result = `<span style="color:${tokenToColor(colorToken)};">${result}</span>`;
  }

  const highlightClass = classes.find(cls => cls.startsWith('highlight-'));
  if (highlightClass) {
    const colorToken = highlightClass.replace('highlight-', '').trim().toLowerCase();
    result = `<mark style="background-color:${tokenToHighlightColor(colorToken)};">${result}</mark>`;
  }

  return result;
}

function decodeHtmlEntities(value = '') {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'');
}

function tokenToColor(token) {
  const colorMap = {
    red: '#ef4444',
    orange: '#fb923c',
    yellow: '#fbbf24',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#a855f7',
    pink: '#ec4899',
    gray: '#6b7280',
    grey: '#6b7280',
    black: '#111827'
  };
  return colorMap[token] || token || '#111827';
}

function tokenToHighlightColor(token) {
  const highlightMap = {
    red: '#fde8e8',
    orange: '#ffedd5',
    yellow: '#fef3c7',
    green: '#dcfce7',
    blue: '#dbeafe',
    purple: '#ede9fe',
    pink: '#fce7f3',
    gray: '#f5f5f5',
    grey: '#f5f5f5'
  };
  return highlightMap[token] || '#fff3bf';
}

function htmlToPlainText(input = '') {
  if (!input) return '';
  let text = input;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|h\d)>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n- ');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, '\'');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\r/g, '');
  text = text.replace(/\u00a0/g, ' ');

  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function escapeXml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

