import { MUBU_API } from './constants.js';
import { getAbortSignal } from './task-controller.js';
import { sanitizePathComponent } from './utils.js';

export async function fetchAllDocuments(jwtToken) {
  const folders = new Map();
  const documents = new Map();
  let rootRelation = null;
  let start = '';
  let guard = 0;

  while (true) {
    guard += 1;
    if (guard > 50) {
      break;
    }

    const data = await requestMubuJson(MUBU_API.LIST, jwtToken, { start });

    if (!rootRelation && data.root_relation) {
      rootRelation = data.root_relation;
    }

    (Array.isArray(data.folders) ? data.folders : []).forEach(folder => {
      folders.set(folder.id, folder);
    });

    (Array.isArray(data.documents) ? data.documents : []).forEach(doc => {
      documents.set(doc.id, doc);
    });

    const hasMore = data.hasMore ?? data.has_more ?? false;
    const nextStart = data.nextStart ?? data.next_start ?? data.next ?? '';
    if (!hasMore || !nextStart || nextStart === start) {
      break;
    }
    start = nextStart;
  }

  const { files, folderCount, seenIds } = buildFlatDocumentList(rootRelation, folders, documents);

  for (const doc of documents.values()) {
    if (!seenIds.has(doc.id)) {
      files.push({
        id: doc.id,
        title: doc.name || '未命名文档',
        type: doc.type,
        folderPath: '',
        localPath: ''
      });
    }
  }

  return { files, folderCount };
}

export async function fetchDocumentDefinition(docId, jwtToken) {
  const data = await requestMubuJson(MUBU_API.DOC_DETAIL, jwtToken, {
    docId,
    password: '',
    isFromDocDir: true
  });

  const definitionString = data?.definition || '{"nodes": []}';
  try {
    return JSON.parse(definitionString);
  } catch (error) {
    return { nodes: [] };
  }
}

export async function getJwtTokenOrThrow() {
  const cookie = await chrome.cookies.get({
    url: MUBU_API.HOME_PAGE,
    name: 'Jwt-Token'
  });
  const token = (cookie && cookie.value ? cookie.value.trim() : '');
  if (!token) {
    throw new Error(`未检测到 Jwt-Token，请先在 ${MUBU_API.HOME_PAGE} 登录账号后重试。`);
  }
  return token;
}

async function requestMubuJson(url, jwtToken, payload) {
  const response = await makeMubuRequest(url, jwtToken, payload);
  if (!response.ok) {
    throw new Error(`接口请求失败: HTTP ${response.status}`);
  }

  const result = await response.json();
  if (typeof result.code !== 'undefined' && result.code !== 0) {
    const msg = result.msg || result.message || `接口返回 code=${result.code}`;
    throw new Error(msg);
  }

  return result.data || {};
}

function makeMubuRequest(url, jwtToken, payload = {}) {
  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Origin': MUBU_API.HOME_PAGE,
    'Referer': MUBU_API.HOME_PAGE,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'jwt-token': jwtToken
  };

  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
    credentials: 'include',
    signal: getAbortSignal()
  });
}

function buildFlatDocumentList(rootRelation, folderMap, docMap) {
  const files = [];
  const seenIds = new Set();
  let folderCount = 0;

  const walk = (relationInput, currentPath) => {
    const relation = parseRelation(relationInput);
    if (!relation.length) {
      return;
    }

    relation.forEach(item => {
      if (item.type === 'folder') {
        const folder = folderMap.get(item.id);
        if (!folder) return;

        folderCount += 1;
        const folderName = sanitizePathComponent(folder.name || `文件夹${folderCount}`) || `folder-${folderCount}`;
        const nextPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        walk(folder.relation, nextPath);
      } else {
        const doc = docMap.get(item.id);
        if (!doc || seenIds.has(doc.id)) {
          return;
        }
        seenIds.add(doc.id);
        files.push({
          id: doc.id,
          title: doc.name || '未命名文档',
          type: doc.type,
          folderPath: currentPath || '',
          localPath: ''
        });
      }
    });
  };

  if (rootRelation) {
    walk(rootRelation, '');
  }

  return { files, folderCount, seenIds };
}

function parseRelation(relationInput) {
  if (!relationInput) return [];
  if (Array.isArray(relationInput)) return relationInput;
  try {
    return JSON.parse(relationInput);
  } catch (error) {
    return [];
  }
}

