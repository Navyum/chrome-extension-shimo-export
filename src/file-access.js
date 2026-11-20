// 原文件下载与在线文档转换使用不同接口，下载标记不能代表转换权限。
function isOriginalDownloadFile(file) {
  return Boolean(file?.isCloudFile || file?.nodeType === 3 || ['pdf', 'zip'].includes(file?.type) || file?.subType);
}

function hasDownloadRestriction(file) {
  return isOriginalDownloadFile(file) && file.downloadable === false;
}

module.exports = { isOriginalDownloadFile, hasDownloadRestriction };
