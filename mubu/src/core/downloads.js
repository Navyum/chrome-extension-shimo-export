import { exportState } from './state.js';
import { sanitizePathComponent, sanitizePathSegments } from './utils.js';

const pendingDownloadUrlMap = new Map();
const downloadFilenameOverrides = new Map();
let hooksInitialized = false;

function handleDownloadCreated(downloadItem) {
  const targetPath = pendingDownloadUrlMap.get(downloadItem.url);
  if (targetPath) {
    pendingDownloadUrlMap.delete(downloadItem.url);
    downloadFilenameOverrides.set(downloadItem.id, targetPath);
  }
}

function handleDownloadFilename(downloadItem, suggest) {
  const targetPath = downloadFilenameOverrides.get(downloadItem.id);
  if (targetPath) {
    downloadFilenameOverrides.delete(downloadItem.id);
    suggest({ filename: targetPath, conflictAction: 'uniquify' });
    return;
  }
  suggest();
}

export function initDownloadHooks() {
  if (hooksInitialized) return;
  hooksInitialized = true;

  if (chrome?.downloads?.onCreated) {
    chrome.downloads.onCreated.addListener(handleDownloadCreated);
  }

  if (chrome?.downloads?.onDeterminingFilename) {
    chrome.downloads.onDeterminingFilename.addListener(handleDownloadFilename);
  }
}

export async function saveContentToDisk(exportPayload, file) {
  const relativePath = buildRelativeDownloadPath(file, exportPayload.extension);
  const dataUrl = `data:${exportPayload.mime};charset=utf-8,${encodeURIComponent(exportPayload.content)}`;

  pendingDownloadUrlMap.set(dataUrl, relativePath);

  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: relativePath,
      saveAs: false,
      conflictAction: 'uniquify'
    });
  } catch (error) {
    pendingDownloadUrlMap.delete(dataUrl);
    throw error;
  } finally {
    if (pendingDownloadUrlMap.get(dataUrl) === relativePath) {
      pendingDownloadUrlMap.delete(dataUrl);
    }
  }

  return relativePath;
}

function buildRelativeDownloadPath(file, extension) {
  const segments = [];
  const baseName = `${sanitizePathComponent(file?.title) || '未命名文档'}.${extension}`;

  if (exportState.subfolder) {
    segments.push(...sanitizePathSegments(exportState.subfolder));
  }

  if (file?.folderPath) {
    segments.push(...sanitizePathSegments(file.folderPath));
  }

  segments.push(baseName);
  return segments.filter(Boolean).join('/');
}

