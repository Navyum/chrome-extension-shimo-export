export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function sanitizePathComponent(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  return name
    .replace(/[\\/<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
}

export function sanitizePathSegments(pathString = '') {
  if (!pathString) return [];
  return pathString
    .split(/[\\/]+/)
    .map(segment => sanitizePathComponent(segment))
    .filter(Boolean);
}

