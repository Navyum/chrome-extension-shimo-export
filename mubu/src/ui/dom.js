export const domRefs = {
  exportTypeSelect: null,
  getInfoBtn: null,
  fileInfoDiv: null,
  totalFilesSpan: null,
  folderCountSpan: null,
  startBtn: null,
  pauseBtn: null,
  retrySection: null,
  retryFailedBtn: null,
  failedList: null,
  progressBar: null,
  progressFill: null,
  progressText: null,
  statusDiv: null,
  logContainer: null,
  resetBtn: null,
  settingsBtn: null,
  loginBtn: null,
  sponsorBtn: null,
  sponsorModal: null,
  sponsorModalClose: null,
  mainContainer: null,
  selectContainer: null,
  selectIcon: null,
  selectTrigger: null,
  selectOptionsList: null,
  selectLabel: null
};

export function cacheDomElements() {
  domRefs.exportTypeSelect = document.getElementById('exportType');
  domRefs.getInfoBtn = document.getElementById('getInfo');
  domRefs.fileInfoDiv = document.getElementById('fileInfo');
  domRefs.totalFilesSpan = document.getElementById('totalFiles');
  domRefs.folderCountSpan = document.getElementById('folderCount');
  domRefs.startBtn = document.getElementById('startExport');
  domRefs.pauseBtn = document.getElementById('pauseExport');
  domRefs.retrySection = document.getElementById('retrySection');
  domRefs.retryFailedBtn = document.getElementById('retryFailedBtn');
  domRefs.failedList = document.getElementById('failedList');
  domRefs.progressBar = document.getElementById('progressBar');
  domRefs.progressFill = document.getElementById('progressFill');
  domRefs.progressText = document.getElementById('progressText');
  domRefs.statusDiv = document.getElementById('status');
  domRefs.logContainer = document.getElementById('logContainer');
  domRefs.resetBtn = document.getElementById('reset-btn');
  domRefs.settingsBtn = document.getElementById('settings-btn');
  domRefs.loginBtn = document.getElementById('login-btn');
  domRefs.sponsorBtn = document.getElementById('sponsor-btn');
  domRefs.sponsorModal = document.getElementById('sponsorModal');
  domRefs.sponsorModalClose = document.getElementById('sponsorModalClose');
  domRefs.mainContainer = document.querySelector('.container');
  domRefs.selectContainer = document.querySelector('.select-container');
  domRefs.selectIcon = document.getElementById('exportTypeIcon');
  domRefs.selectTrigger = document.getElementById('exportTypeTrigger');
  domRefs.selectOptionsList = document.getElementById('exportTypeOptions');
  domRefs.selectLabel = document.getElementById('exportTypeLabel');
}

