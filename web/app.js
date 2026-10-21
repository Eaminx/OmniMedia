/**
 * OMNI MEDIA PRO - Next.js Ultra Glossy Frontend Engine
 * Connects Vercel-style UI with Python backend, supporting Channel Avatars, Video Thumbnails,
 * and Individual Video Item Actions (Pause, Show in Folder, Remove, Retry).
 */

const state = {
  activeTab: 'tab-single',
  outputDir: '',
  qualities: [],
  singleItem: null,
  scannedItems: [],
  currentChannel: null,
  selectedChannelFilter: 'Both (Videos & Shorts)',
  tableSearchQuery: '',
  isPaused: false,
  pollTimer: null,
  collapsedBatches: new Set(),
  downloadHistory: [],
  historyFilterQuery: '',
  currentPollInterval: 600,
  lastCompletedCount: undefined,
  shutdownModalTriggered: false,
  shutdownTimerId: null,
  sniffedUrl: '',
  settings: {
    container_format: 'mp4',
    download_subtitles: false,
    subtitle_langs: 'en,bn',
    embed_metadata: true,
    rate_limit_mb: 0.0,
    clipboard_monitor: true,
    organize_subfolders: false,
    auto_shutdown_on_finish: false
  }
};

const el = {};
let pendingDuplicateAction = null;
let activeContextInput = null;

function initElements() {
  el.navButtons = document.querySelectorAll('.nav-link');
  el.stageViews = document.querySelectorAll('.stage-view');
  el.sidebar = document.querySelector('.sidebar');
  el.btnToggleSidebar = document.getElementById('btnToggleSidebar');
  el.sidebarFolderPath = document.getElementById('sidebarFolderPath');
  el.diagFolderPath = document.getElementById('diagFolderPath');
  el.sidebarQueueCount = document.getElementById('sidebarQueueCount');

  // History & Vault
  el.historySearchInput = document.getElementById('historySearchInput');
  el.btnClearHistory = document.getElementById('btnClearHistory');
  el.btnOpenHistoryFolder = document.getElementById('btnOpenHistoryFolder');
  el.historyContainer = document.getElementById('historyContainer');

  // Engine Preferences
  el.prefContainerFormat = document.getElementById('prefContainerFormat');
  el.prefRateLimit = document.getElementById('prefRateLimit');
  el.prefEmbedMetadata = document.getElementById('prefEmbedMetadata');
  el.prefDownloadSubtitles = document.getElementById('prefDownloadSubtitles');
  el.prefSubtitleLangs = document.getElementById('prefSubtitleLangs');
  el.subtitlesLangWrap = document.getElementById('subtitlesLangWrap');
  el.prefClipboardMonitor = document.getElementById('prefClipboardMonitor');
  el.prefOrganizeSubfolders = document.getElementById('prefOrganizeSubfolders');
  el.prefAutoShutdown = document.getElementById('prefAutoShutdown');
  el.queueAutoShutdownToggle = document.getElementById('queueAutoShutdownToggle');
  el.diagYtdlp = document.getElementById('diagYtdlp');
  el.btnUpdateYtdlp = document.getElementById('btnUpdateYtdlp');
  el.btnSavePreferences = document.getElementById('btnSavePreferences');

  // Top Metrics Ribbon
  el.ribbonActiveCount = document.getElementById('ribbonActiveCount');
  el.ribbonQueueCount = document.getElementById('ribbonQueueCount');
  el.ribbonSpeed = document.getElementById('ribbonSpeed');
  el.ribbonCompleted = document.getElementById('ribbonCompleted');
  el.ribbonEngineText = document.getElementById('ribbonEngineText');
  el.btnAboutEaminx = document.getElementById('btnAboutEaminx');
  el.aboutModal = document.getElementById('aboutModal');
  el.btnCloseAboutModal = document.getElementById('btnCloseAboutModal');
  el.btnCopyAllLinks = document.getElementById('btnCopyAllLinks');

  // Single Downloader & Trimmer
  el.singleUrlInput = document.getElementById('singleUrlInput');
  el.btnPasteSingle = document.getElementById('btnPasteSingle');
  el.detectedPlatformBadge = document.getElementById('detectedPlatformBadge');
  el.btnInspectSingle = document.getElementById('btnInspectSingle');
  el.inspectSpinner = document.getElementById('inspectSpinner');
  el.singleResultCard = document.getElementById('singleResultCard');
  el.singleThumbImg = document.getElementById('singleThumbImg');
  el.singleTypeBadge = document.getElementById('singleTypeBadge');
  el.singleDurationBadge = document.getElementById('singleDurationBadge');
  el.singlePlatformTag = document.getElementById('singlePlatformTag');
  el.singleVideoTitle = document.getElementById('singleVideoTitle');
  el.singleUploader = document.getElementById('singleUploader');
  el.singleContentType = document.getElementById('singleContentType');
  el.singleQualitySelect = document.getElementById('singleQualitySelect');
  el.btnDownloadSingleNow = document.getElementById('btnDownloadSingleNow');
  el.btnQueueSingle = document.getElementById('btnQueueSingle');
  el.btnSaveThumbnail = document.getElementById('btnSaveThumbnail');
  el.btnCopyDirectLink = document.getElementById('btnCopyDirectLink');
  el.chkEnableTrimmer = document.getElementById('chkEnableTrimmer');
  el.trimmerInputsRow = document.getElementById('trimmerInputsRow');
  el.trimStartTime = document.getElementById('trimStartTime');
  el.trimEndTime = document.getElementById('trimEndTime');

  // Floating Clipboard Sniffer & Shutdown Modal
  el.clipboardSnifferBanner = document.getElementById('clipboardSnifferBanner');
  el.snifferPlatformBadge = document.getElementById('snifferPlatformBadge');
  el.snifferUrlText = document.getElementById('snifferUrlText');
  el.btnSnifferInspect = document.getElementById('btnSnifferInspect');
  el.btnSnifferQuickQueue = document.getElementById('btnSnifferQuickQueue');
  el.btnSnifferDismiss = document.getElementById('btnSnifferDismiss');
  el.shutdownModal = document.getElementById('shutdownModal');
  el.shutdownCountdownNum = document.getElementById('shutdownCountdownNum');
  el.shutdownProgressBar = document.getElementById('shutdownProgressBar');
  el.btnCancelShutdown = document.getElementById('btnCancelShutdown');
  el.btnShutDownNow = document.getElementById('btnShutDownNow');

  // Channel Scraper
  el.channelUrlInput = document.getElementById('channelUrlInput');
  el.btnPasteChannel = document.getElementById('btnPasteChannel');
  el.btnScanChannel = document.getElementById('btnScanChannel');
  el.channelSpinner = document.getElementById('channelSpinner');
  el.filterPills = document.querySelectorAll('.glossy-pill');
  el.channelLimitSelect = document.getElementById('channelLimitSelect');

  el.channelProfileHero = document.getElementById('channelProfileHero');
  el.channelAvatarImg = document.getElementById('channelAvatarImg');
  el.channelProfileTitle = document.getElementById('channelProfileTitle');
  el.channelProfilePlatform = document.getElementById('channelProfilePlatform');
  el.channelProfileHandle = document.getElementById('channelProfileHandle');
  el.channelDiscoveredCount = document.getElementById('channelDiscoveredCount');
  el.btnHeroSelectAll = document.getElementById('btnHeroSelectAll');
  el.btnHeroQueueAll = document.getElementById('btnHeroQueueAll');

  el.btnSelectAll = document.getElementById('btnSelectAll');
  el.btnDeselectAll = document.getElementById('btnDeselectAll');
  el.btnSelectOnlyShorts = document.getElementById('btnSelectOnlyShorts');
  el.btnSelectOnlyVideos = document.getElementById('btnSelectOnlyVideos');
  el.tableFilterInput = document.getElementById('tableFilterInput');
  el.channelCountSummary = document.getElementById('channelCountSummary');
  el.scannedCardsContainer = document.getElementById('scannedCardsContainer');
  el.batchCustomNameInput = document.getElementById('batchCustomNameInput');
  el.channelBatchQualitySelect = document.getElementById('channelBatchQualitySelect');
  el.cbChannelSkipDuplicates = document.getElementById('cbChannelSkipDuplicates');
  el.btnAddScannedToQueue = document.getElementById('btnAddScannedToQueue');
  el.btnQueueSelectedText = document.getElementById('btnQueueSelectedText');

  // Bulk Links
  el.bulkTextarea = document.getElementById('bulkTextarea');
  el.btnPasteBulk = document.getElementById('btnPasteBulk');
  el.btnImportTxt = document.getElementById('btnImportTxt');
  el.btnDeduplicateBulk = document.getElementById('btnDeduplicateBulk');
  el.cbBulkSkipDuplicates = document.getElementById('cbBulkSkipDuplicates');
  el.bulkUrlCount = document.getElementById('bulkUrlCount');
  el.bulkQualitySelect = document.getElementById('bulkQualitySelect');
  el.btnQueueBulk = document.getElementById('btnQueueBulk');

  // Queue
  el.batchesContainer = document.getElementById('batchesContainer');
  el.btnPauseQueue = document.getElementById('btnPauseQueue');
  el.btnClearCompleted = document.getElementById('btnClearCompleted');
  el.btnOpenFolderQueue = document.getElementById('btnOpenFolderQueue');

  // Diagnostics & Cookies
  el.diagFfmpeg = document.getElementById('diagFfmpeg');
  el.diagPython = document.getElementById('diagPython');
  el.diagCookiesStatus = document.getElementById('diagCookiesStatus');
  el.logTerminal = document.getElementById('logTerminal');
  el.btnClearLogs = document.getElementById('btnClearLogs');
  el.btnChangeFolder = document.getElementById('btnChangeFolder');
  el.btnOpenFolder = document.getElementById('btnOpenFolder');
  el.btnChangeFolderDiag = document.getElementById('btnChangeFolderDiag');
  el.btnOpenFolderDiag = document.getElementById('btnOpenFolderDiag');

  el.btnAutoImportCookies = document.getElementById('btnAutoImportCookies');
  el.btnOpenChromeExtension = document.getElementById('btnOpenChromeExtension');
  el.btnImportCookies = document.getElementById('btnImportCookies');
  el.btnRemoveCookies = document.getElementById('btnRemoveCookies');
  el.btnShowCookieHelp = document.getElementById('btnShowCookieHelp');
  el.cookieActiveBadge = document.getElementById('cookieActiveBadge');

  // In-App YouTube Login & Auth
  el.btnRibbonSignIn = document.getElementById('btnRibbonSignIn');
  el.authDot = document.getElementById('authDot');
  el.authRibbonText = document.getElementById('authRibbonText');
  el.btnSignInYouTube = document.getElementById('btnSignInYouTube');
  el.btnModalSignInYouTube = document.getElementById('btnModalSignInYouTube');
  el.btnCaptureCookies = document.getElementById('btnCaptureCookies');
  el.btnSignOutYouTube = document.getElementById('btnSignOutYouTube');

  // Cookie Modal
  el.cookieHelpModal = document.getElementById('cookieHelpModal');
  el.btnCloseCookieModal = document.getElementById('btnCloseCookieModal');
  el.btnOpenExtLocally = document.getElementById('btnOpenExtLocally');
  el.btnOpenExtEditor = document.getElementById('btnOpenExtEditor');
  el.btnModalAutoImport = document.getElementById('btnModalAutoImport');
  el.btnModalImportCookies = document.getElementById('btnModalImportCookies');

  // Duplicate Modal
  el.duplicateModal = document.getElementById('duplicateModal');
  el.duplicateModalTitle = document.getElementById('duplicateModalTitle');
  el.duplicateModalMessage = document.getElementById('duplicateModalMessage');
  el.duplicateListContainer = document.getElementById('duplicateListContainer');
  el.btnCloseDuplicateModal = document.getElementById('btnCloseDuplicateModal');
  el.btnCancelDuplicateModal = document.getElementById('btnCancelDuplicateModal');
  el.btnSkipDuplicatesAction = document.getElementById('btnSkipDuplicatesAction');
  el.btnAddAllDuplicatesAction = document.getElementById('btnAddAllDuplicatesAction');

  // Custom Right-Click Context Menu
  el.customContextMenu = document.getElementById('customContextMenu');
  el.ctxMenuPaste = document.getElementById('ctxMenuPaste');
  el.ctxMenuCopy = document.getElementById('ctxMenuCopy');
  el.ctxMenuCut = document.getElementById('ctxMenuCut');
  el.ctxMenuSelectAll = document.getElementById('ctxMenuSelectAll');
  el.ctxMenuClear = document.getElementById('ctxMenuClear');
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showDuplicateModal(title, message, duplicates, onSkip, onAddAll) {
  if (!el.duplicateModal) return;
  el.duplicateModalTitle.textContent = title;
  el.duplicateModalMessage.textContent = message;

  let itemsHtml = '';
  duplicates.forEach(d => {
    const title = d.existing ? d.existing.title : (d.title || d.url);
    const status = d.existing ? d.existing.status : 'In Queue';
    itemsHtml += `
      <div class="duplicate-preview-item">
        <span class="dup-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
        <span class="dup-status">${escapeHtml(status)}</span>
      </div>
    `;
  });
  el.duplicateListContainer.innerHTML = itemsHtml;
  el.duplicateModal.style.display = 'flex';

  pendingDuplicateAction = { onSkip, onAddAll };
}

function hideDuplicateModal() {
  if (el.duplicateModal) el.duplicateModal.style.display = 'none';
  pendingDuplicateAction = null;
}

function switchTab(tabId) {
  state.activeTab = tabId;
  el.navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  el.stageViews.forEach(view => {
    view.classList.toggle('active', view.id === tabId);
  });
  if (tabId === 'tab-history') {
    loadAndRenderHistory();
  }
}

function detectPlatformFrontend(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return 'generic';
}

function updateDetectedPlatformBadge(url) {
  const plat = detectPlatformFrontend(url);
  el.detectedPlatformBadge.className = `auto-plat-chip ${plat}`;
  el.detectedPlatformBadge.innerHTML = `<span class="chip-txt">${plat === 'generic' ? 'AUTO DETECT' : plat.toUpperCase()}</span>`;
}

async function initializeApp() {
  initElements();
  setupEventListeners();

  if (window.pywebview && window.pywebview.api) {
    onApiReady();
  } else {
    window.addEventListener('pywebviewready', onApiReady);
  }
}

function hideAppLoadingScreen() {
  const splash = document.getElementById('appSplashScreen');
  if (!splash || splash._hidden) return;
  splash._hidden = true;
  const statusTxt = document.getElementById('splashStatusText');
  if (statusTxt) statusTxt.textContent = 'Engine Ready';
  
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 450);
  }, 280);
}

// Global safety timeout to ensure splash never hangs
setTimeout(hideAppLoadingScreen, 3500);

async function onApiReady() {
  try {
    const info = await window.pywebview.api.get_info();
    state.outputDir = info.output_dir;
    state.qualities = info.qualities || [];

    updateFolderPath(state.outputDir);

    if (el.diagPython) el.diagPython.textContent = info.python_version;
    if (el.diagYtdlp && info.ytdlp_version) {
      el.diagYtdlp.textContent = `v${info.ytdlp_version}`;
    }
    if (el.diagFfmpeg) {
      el.diagFfmpeg.textContent = info.ffmpeg_available ? 'Bundled v7.1 Active' : 'Not Found';
      el.diagFfmpeg.className = info.ffmpeg_available ? 'text-green' : 'text-crimson';
    }
    updateCookiesUi(Boolean(info.has_cookies), Boolean(info.is_signed_in));

    if (info.settings) {
      state.settings = Object.assign(state.settings, info.settings);
      applySettingsToUi(state.settings);
    }

    populateQualityDropdowns(state.qualities);
    startQueuePolling(600);
    showToast('OmniMedia Pro engine connected', 'success');
    hideAppLoadingScreen();
  } catch (err) {
    console.error('API Init error:', err);
    hideAppLoadingScreen();
  }
}

function applySettingsToUi(s) {
  if (el.prefContainerFormat) el.prefContainerFormat.value = s.container_format || 'mp4';
  if (el.prefRateLimit) el.prefRateLimit.value = String(s.rate_limit_mb || 0);
  if (el.prefEmbedMetadata) el.prefEmbedMetadata.checked = Boolean(s.embed_metadata !== false);
  if (el.prefDownloadSubtitles) {
    el.prefDownloadSubtitles.checked = Boolean(s.download_subtitles);
    if (el.subtitlesLangWrap) {
      el.subtitlesLangWrap.style.display = s.download_subtitles ? 'block' : 'none';
    }
  }
  if (el.prefSubtitleLangs) el.prefSubtitleLangs.value = s.subtitle_langs || 'en,bn';
  if (el.prefClipboardMonitor) el.prefClipboardMonitor.checked = Boolean(s.clipboard_monitor !== false);
  if (el.prefOrganizeSubfolders) el.prefOrganizeSubfolders.checked = Boolean(s.organize_subfolders);
  if (el.prefAutoShutdown) el.prefAutoShutdown.checked = Boolean(s.auto_shutdown_on_finish);
  if (el.queueAutoShutdownToggle) el.queueAutoShutdownToggle.checked = Boolean(s.auto_shutdown_on_finish);
}

async function handleSavePreferences() {
  const newSettings = {
    container_format: el.prefContainerFormat ? el.prefContainerFormat.value : 'mp4',
    rate_limit_mb: el.prefRateLimit ? parseFloat(el.prefRateLimit.value) : 0.0,
    embed_metadata: el.prefEmbedMetadata ? el.prefEmbedMetadata.checked : true,
    download_subtitles: el.prefDownloadSubtitles ? el.prefDownloadSubtitles.checked : false,
    subtitle_langs: el.prefSubtitleLangs ? el.prefSubtitleLangs.value.trim() : 'en,bn',
    clipboard_monitor: el.prefClipboardMonitor ? el.prefClipboardMonitor.checked : true,
    organize_subfolders: el.prefOrganizeSubfolders ? el.prefOrganizeSubfolders.checked : false,
    auto_shutdown_on_finish: el.prefAutoShutdown ? el.prefAutoShutdown.checked : false
  };
  state.settings = Object.assign(state.settings, newSettings);
  if (el.queueAutoShutdownToggle) el.queueAutoShutdownToggle.checked = state.settings.auto_shutdown_on_finish;
  try {
    const res = await window.pywebview.api.save_settings(newSettings);
    if (res && res.success) {
      showToast('Engine preferences saved successfully!', 'success');
    } else {
      showToast('Failed to save preferences', 'error');
    }
  } catch (e) {
    showToast(`Error saving preferences: ${e}`, 'error');
  }
}

// Sound Chime Generator for completion using Web Audio API
function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (e) {}
}

async function handleSaveThumbnail() {
  if (!state.singleItem || !state.singleItem.thumbnail) {
    showToast('Please inspect a media link first', 'warning');
    return;
  }
  showToast('Saving High-Res Thumbnail...', 'info');
  try {
    const res = await window.pywebview.api.save_thumbnail(state.singleItem.thumbnail, state.singleItem.title);
    if (res && res.success) {
      showToast(`Saved Thumbnail: ${res.filename}`, 'success');
    } else {
      showToast(`Error: ${res.error || 'Failed to save thumbnail'}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err}`, 'error');
  }
}

async function handleUpdateYtdlp() {
  if (!el.btnUpdateYtdlp) return;
  el.btnUpdateYtdlp.disabled = true;
  el.btnUpdateYtdlp.textContent = 'Updating...';
  showToast('Checking and upgrading yt-dlp core engine...', 'info');
  try {
    const res = await window.pywebview.api.update_ytdlp_engine();
    if (res && res.success) {
      showToast(res.message || 'yt-dlp upgrade initiated in background!', 'success');
    } else {
      showToast('Failed to update yt-dlp', 'error');
    }
  } catch (err) {
    showToast(`Update error: ${err}`, 'error');
  } finally {
    setTimeout(() => {
      if (el.btnUpdateYtdlp) {
        el.btnUpdateYtdlp.disabled = false;
        el.btnUpdateYtdlp.textContent = '🔄 Update';
      }
    }, 4000);
  }
}

function showSnifferBanner(url, platform) {
  state.sniffedUrl = url;
  if (!el.clipboardSnifferBanner) return;
  if (el.snifferPlatformBadge) el.snifferPlatformBadge.textContent = (platform || 'MEDIA').toUpperCase();
  if (el.snifferUrlText) el.snifferUrlText.textContent = url;
  el.clipboardSnifferBanner.style.display = 'flex';
}

function triggerShutdownCountdown() {
  if (state.shutdownModalTriggered) return;
  state.shutdownModalTriggered = true;
  let remaining = 60;

  if (el.shutdownModal) el.shutdownModal.style.display = 'flex';
  if (el.shutdownCountdownNum) el.shutdownCountdownNum.textContent = `${remaining}s`;
  if (el.shutdownProgressBar) el.shutdownProgressBar.style.width = '100%';

  playCompletionChime();

  if (state.shutdownTimerId) clearInterval(state.shutdownTimerId);
  state.shutdownTimerId = setInterval(async () => {
    remaining--;
    if (el.shutdownCountdownNum) el.shutdownCountdownNum.textContent = `${remaining}s`;
    if (el.shutdownProgressBar) el.shutdownProgressBar.style.width = `${(remaining / 60) * 100}%`;

    if (remaining <= 0) {
      clearInterval(state.shutdownTimerId);
      state.shutdownTimerId = null;
      if (window.pywebview && window.pywebview.api) {
        await window.pywebview.api.trigger_system_shutdown(0);
      }
    }
  }, 1000);
}

async function cancelShutdownCountdown() {
  if (state.shutdownTimerId) {
    clearInterval(state.shutdownTimerId);
    state.shutdownTimerId = null;
  }
  state.shutdownModalTriggered = false;
  if (el.shutdownModal) el.shutdownModal.style.display = 'none';
  if (window.pywebview && window.pywebview.api) {
    await window.pywebview.api.cancel_system_shutdown();
  }
  showToast('Auto-Shutdown cancelled', 'info');
}

async function handleImmediateShutdown() {
  if (state.shutdownTimerId) {
    clearInterval(state.shutdownTimerId);
    state.shutdownTimerId = null;
  }
  if (window.pywebview && window.pywebview.api) {
    await window.pywebview.api.trigger_system_shutdown(0);
  }
}

async function loadAndRenderHistory() {
  if (!el.historyContainer) return;
  setupHistoryDelegation();
  try {
    const list = await window.pywebview.api.get_download_history();
    state.downloadHistory = list || [];
    renderHistoryCards();
  } catch (err) {
    console.error('History load error:', err);
  }
}

function showInstantMissingTooltip(btn, text = 'File Moved or Deleted') {
  const oldBubble = btn.querySelector('.instant-tooltip-bubble');
  if (oldBubble) oldBubble.remove();

  const bubble = document.createElement('div');
  bubble.className = 'instant-tooltip-bubble';
  bubble.innerHTML = `
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span>${text}</span>
  `;
  btn.appendChild(bubble);

  if (btn._tooltipTimer) clearTimeout(btn._tooltipTimer);
  btn._tooltipTimer = setTimeout(() => {
    bubble.remove();
  }, 2800);
}

function markHistoryItemMissing(id) {
  const card = el.historyContainer.querySelector(`.video-queue-item[data-history-id="${id}"]`);
  if (!card) return;
  card.querySelectorAll('.btn-history-folder, .btn-history-play').forEach(b => {
    b.dataset.exists = 'false';
    b.classList.add('missing-file');
    const span = b.querySelector('span');
    if (span) span.textContent = 'Missing';
  });
  const pill = card.querySelector('.item-status-pill');
  if (pill) {
    pill.className = 'item-status-pill completed pill-missing';
    pill.textContent = 'File Missing';
  }
}

function renderHistoryCards() {
  if (!el.historyContainer) return;
  const q = (state.historyFilterQuery || '').toLowerCase();
  const filtered = state.downloadHistory.filter(item => {
    if (!q) return true;
    return (item.title || '').toLowerCase().includes(q) || (item.quality || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    el.historyContainer.innerHTML = `
      <div class="empty-queue-tile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <h3>${state.downloadHistory.length === 0 ? 'No completed downloads yet' : 'No matching downloads found'}</h3>
        <p>${state.downloadHistory.length === 0 ? 'Downloaded videos will automatically appear in this history vault.' : 'Try a different search keyword.'}</p>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(item => {
    const thumbUrl = item.thumbnail || 'assets/OmniMedia.png';
    const isMissing = item.file_exists === false;
    const playTitle = isMissing ? 'File Moved or Deleted' : 'Play video file in default player';
    const folderTitle = isMissing ? 'File Moved or Deleted' : 'Open and highlight file in Windows Explorer';
    const missingClass = isMissing ? 'missing-file' : '';

    html += `
      <div class="video-queue-item" data-history-id="${item.id}">
        <div class="item-thumb-mini btn-history-play ${missingClass}" data-id="${item.id}" data-exists="${isMissing ? 'false' : 'true'}" title="${playTitle}" style="cursor: pointer;">
          ${thumbUrl ? `<img src="${thumbUrl}" alt="Thumb" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='assets/OmniMedia.png';">` : `<img src="assets/OmniMedia.png" alt="Thumb">`}
          <span class="mini-duration">${item.duration_str || '00:00'}</span>
        </div>
        <div class="item-content">
          <div class="item-header-line">
            <span class="plat-grid-item ${(item.platform || 'yt')}" style="padding:1px 6px;font-size:0.62rem;display:inline-flex;">${(item.platform || 'YT').toUpperCase()}</span>
            <span class="item-title-text btn-history-play ${missingClass}" data-id="${item.id}" data-exists="${isMissing ? 'false' : 'true'}" title="${playTitle}" style="cursor: pointer;">${escapeHtml(item.title)}</span>
            <span class="item-status-pill completed ${isMissing ? 'pill-missing' : ''}">${isMissing ? 'File Missing' : 'Completed'}</span>
          </div>
          <div class="item-meta-row" style="margin-top: 6px;">
            <span>Quality: ${escapeHtml(item.quality || 'Best')}</span>
            <span>Size: ${item.size || 'Saved'} • Completed: ${item.timestamp || 'Recently'}</span>
          </div>
        </div>
        <div class="item-actions-cluster">
          <button class="item-btn-tool btn-history-play ${missingClass}" data-id="${item.id}" data-exists="${isMissing ? 'false' : 'true'}" title="${playTitle}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
            <span>${isMissing ? 'Missing' : 'Play'}</span>
          </button>
          <button class="item-btn-tool btn-history-folder ${missingClass}" data-id="${item.id}" data-exists="${isMissing ? 'false' : 'true'}" title="${folderTitle}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>Folder</span>
          </button>
          <button class="item-btn-tool danger btn-history-del" data-id="${item.id}" title="Delete from history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;
  });
  el.historyContainer.innerHTML = html;
}

function setupHistoryDelegation() {
  if (!el.historyContainer || el.historyContainer._delegated) return;
  el.historyContainer._delegated = true;

  // Instant hover tooltip for missing files
  el.historyContainer.addEventListener('mouseenter', e => {
    const btn = e.target.closest('.missing-file');
    if (btn) {
      showInstantMissingTooltip(btn, 'File Moved or Deleted');
    }
  }, true);

  el.historyContainer.addEventListener('click', async e => {
    // 1. Play / Open File directly
    const playBtn = e.target.closest('.btn-history-play');
    if (playBtn) {
      e.stopPropagation();
      e.preventDefault();
      const id = playBtn.dataset.id;
      const isMissing = playBtn.dataset.exists === 'false';

      if (isMissing) {
        showInstantMissingTooltip(playBtn, 'File Moved or Deleted');
        showToast('Cannot open: File Moved or Deleted from disk', 'error');
        return;
      }

      const res = await window.pywebview.api.open_history_file(id);
      if (res && res.success) {
        showToast('Opening video in media player...', 'success');
      } else {
        markHistoryItemMissing(id);
        showInstantMissingTooltip(playBtn, 'File Moved or Deleted');
        showToast('Cannot open: File Moved or Deleted from disk', 'error');
      }
      return;
    }

    // 2. Open Containing Folder in Explorer
    const folderBtn = e.target.closest('.btn-history-folder');
    if (folderBtn) {
      e.stopPropagation();
      e.preventDefault();
      const id = folderBtn.dataset.id;
      const isMissing = folderBtn.dataset.exists === 'false';

      if (isMissing) {
        showInstantMissingTooltip(folderBtn, 'File Moved or Deleted');
        showToast('Cannot open: File Moved or Deleted from disk', 'error');
        return;
      }

      const res = await window.pywebview.api.open_history_folder(id);
      if (res && res.success) {
        showToast('Opened file in Windows Explorer', 'success');
      } else {
        markHistoryItemMissing(id);
        showInstantMissingTooltip(folderBtn, 'File Moved or Deleted');
        showToast('Cannot open: File Moved or Deleted from disk', 'error');
      }
      return;
    }

    // 3. Delete from History
    const delBtn = e.target.closest('.btn-history-del');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.id;
      const ok = await window.pywebview.api.delete_history_item(id);
      if (ok) {
        state.downloadHistory = state.downloadHistory.filter(h => h.id !== id);
        renderHistoryCards();
        showToast('Item removed from history', 'info');
      }
      return;
    }
  });
}

function updateFolderPath(path) {
  state.outputDir = path;
  if (el.sidebarFolderPath) el.sidebarFolderPath.textContent = path;
  if (el.diagFolderPath) el.diagFolderPath.textContent = path;
}

function populateQualityDropdowns(qualities) {
  const selects = [el.singleQualitySelect, el.channelBatchQualitySelect, el.bulkQualitySelect];
  selects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    qualities.forEach(q => {
      const opt = document.createElement('option');
      opt.value = q;
      opt.textContent = q;
      sel.appendChild(opt);
    });
  });
}

async function getClipboardText() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) return text.trim();
    }
  } catch (e) {
    // fallback
  }
  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.read_clipboard) {
      const pyText = await window.pywebview.api.read_clipboard();
      if (pyText && pyText.trim()) return pyText.trim();
    }
  } catch (e) {
    // fallback
  }
  return '';
}

async function writeClipboardText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}

  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.write_clipboard) {
      const ok = await window.pywebview.api.write_clipboard(text);
      if (ok) return true;
    }
  } catch (e) {}

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch (e) {}

  return false;
}

function setupEventListeners() {
  el.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      if (el.sidebar) el.sidebar.classList.remove('mobile-open');
    });
  });

  // Mobile sidebar toggle
  if (el.btnToggleSidebar && el.sidebar) {
    el.btnToggleSidebar.addEventListener('click', () => {
      el.sidebar.classList.toggle('mobile-open');
    });
  }

  const changeFolderHandler = async () => {
    const newPath = await window.pywebview.api.choose_folder();
    if (newPath) {
      updateFolderPath(newPath);
      showToast('Destination directory updated', 'success');
    }
  };
  const openFolderHandler = async () => {
    await window.pywebview.api.open_folder();
  };

  el.btnChangeFolder.addEventListener('click', changeFolderHandler);
  el.btnChangeFolderDiag.addEventListener('click', changeFolderHandler);
  el.btnOpenFolder.addEventListener('click', openFolderHandler);
  el.btnOpenFolderDiag.addEventListener('click', openFolderHandler);
  el.btnOpenFolderQueue.addEventListener('click', openFolderHandler);

  // Single Downloader Input & Paste
  if (el.btnPasteSingle) {
    el.btnPasteSingle.addEventListener('click', async () => {
      const text = await getClipboardText();
      if (text) {
        el.singleUrlInput.value = text;
        updateDetectedPlatformBadge(text);
        showToast('Pasted URL from clipboard', 'info');
        el.singleUrlInput.focus();
      } else {
        showToast('Clipboard is empty or contains no URL', 'warning');
      }
    });
  }

  el.singleUrlInput.addEventListener('input', e => {
    updateDetectedPlatformBadge(e.target.value);
  });
  el.btnInspectSingle.addEventListener('click', handleInspectSingle);
  el.singleUrlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleInspectSingle();
  });
  el.btnDownloadSingleNow.addEventListener('click', handleDownloadSingle);
  el.btnQueueSingle.addEventListener('click', handleDownloadSingle);
  if (el.btnSaveThumbnail) {
    el.btnSaveThumbnail.addEventListener('click', handleSaveThumbnail);
  }
  if (el.chkEnableTrimmer) {
    el.chkEnableTrimmer.addEventListener('change', e => {
      if (el.trimmerInputsRow) {
        el.trimmerInputsRow.style.display = e.target.checked ? 'flex' : 'none';
      }
    });
  }
  if (el.btnCopyDirectLink) {
    el.btnCopyDirectLink.addEventListener('click', handleCopyDirectLink);
  }

  // Channel Scraper Filters & Paste
  if (el.btnPasteChannel) {
    el.btnPasteChannel.addEventListener('click', async () => {
      const text = await getClipboardText();
      if (text) {
        el.channelUrlInput.value = text;
        showToast('Pasted Channel URL from clipboard', 'info');
        el.channelUrlInput.focus();
      } else {
        showToast('Clipboard is empty or contains no URL', 'warning');
      }
    });
  }

  el.filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      el.filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedChannelFilter = pill.dataset.filter;
    });
  });

  el.btnScanChannel.addEventListener('click', handleScanChannel);
  el.channelUrlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleScanChannel();
  });

  // Hero Actions on Scanned Channel
  el.btnHeroSelectAll.addEventListener('click', () => setAllScannedSelection(true));
  el.btnHeroQueueAll.addEventListener('click', handleAddScannedToQueue);

  // Channel Selection Toolbar
  el.btnSelectAll.addEventListener('click', () => setAllScannedSelection(true));
  el.btnDeselectAll.addEventListener('click', () => setAllScannedSelection(false));
  el.btnSelectOnlyShorts.addEventListener('click', () => setTypeScannedSelection(true));
  el.btnSelectOnlyVideos.addEventListener('click', () => setTypeScannedSelection(false));
  el.tableFilterInput.addEventListener('input', e => {
    state.tableSearchQuery = e.target.value.toLowerCase();
    renderScannedCards();
  });
  el.btnAddScannedToQueue.addEventListener('click', handleAddScannedToQueue);

  // Bulk Links & Paste
  if (el.btnPasteBulk) {
    el.btnPasteBulk.addEventListener('click', async () => {
      const text = await getClipboardText();
      if (text) {
        const cur = el.bulkTextarea.value.trim();
        if (cur) {
          el.bulkTextarea.value = cur + '\n' + text;
        } else {
          el.bulkTextarea.value = text;
        }
        updateBulkCount();
        showToast('Pasted links into bulk editor', 'info');
        el.bulkTextarea.focus();
      } else {
        showToast('Clipboard is empty or contains no URL', 'warning');
      }
    });
  }

  el.bulkTextarea.addEventListener('input', updateBulkCount);
  el.btnImportTxt.addEventListener('click', handleImportTxt);
  if (el.btnDeduplicateBulk) el.btnDeduplicateBulk.addEventListener('click', handleDeduplicateBulk);
  el.btnQueueBulk.addEventListener('click', handleQueueBulk);

  // Queue Controls
  el.btnPauseQueue.addEventListener('click', handleTogglePauseQueue);
  el.btnClearCompleted.addEventListener('click', async () => {
    await window.pywebview.api.clear_completed();
    showToast('Cleared finished and cancelled downloads', 'success');
    pollQueueStatus();
  });

  // History Controls
  if (el.historySearchInput) {
    el.historySearchInput.addEventListener('input', e => {
      state.historyFilterQuery = e.target.value.toLowerCase();
      renderHistoryCards();
    });
  }
  if (el.btnClearHistory) {
    el.btnClearHistory.addEventListener('click', async () => {
      await window.pywebview.api.clear_download_history();
      state.downloadHistory = [];
      renderHistoryCards();
      showToast('Cleared all completed download history', 'info');
    });
  }
  if (el.btnOpenHistoryFolder) {
    el.btnOpenHistoryFolder.addEventListener('click', async () => {
      await window.pywebview.api.open_folder();
      showToast('Opening download destination folder', 'info');
    });
  }

  // Engine Preferences Controls
  if (el.btnSavePreferences) {
    el.btnSavePreferences.addEventListener('click', handleSavePreferences);
  }
  if (el.prefDownloadSubtitles) {
    el.prefDownloadSubtitles.addEventListener('change', e => {
      if (el.subtitlesLangWrap) {
        el.subtitlesLangWrap.style.display = e.target.checked ? 'block' : 'none';
      }
    });
  }
  if (el.btnUpdateYtdlp) {
    el.btnUpdateYtdlp.addEventListener('click', handleUpdateYtdlp);
  }
  if (el.queueAutoShutdownToggle) {
    el.queueAutoShutdownToggle.addEventListener('change', e => {
      state.settings.auto_shutdown_on_finish = e.target.checked;
      if (el.prefAutoShutdown) el.prefAutoShutdown.checked = e.target.checked;
      showToast(`Auto-Shutdown on completion: ${e.target.checked ? 'ENABLED' : 'DISABLED'}`, 'info');
    });
  }
  if (el.prefAutoShutdown) {
    el.prefAutoShutdown.addEventListener('change', e => {
      state.settings.auto_shutdown_on_finish = e.target.checked;
      if (el.queueAutoShutdownToggle) el.queueAutoShutdownToggle.checked = e.target.checked;
    });
  }

  // Smart Clipboard Sniffer Actions
  if (el.btnSnifferInspect) {
    el.btnSnifferInspect.addEventListener('click', () => {
      if (state.sniffedUrl) {
        el.singleUrlInput.value = state.sniffedUrl;
        updateDetectedPlatformBadge(state.sniffedUrl);
        switchTab('tab-single');
        handleInspectSingle();
      }
      if (el.clipboardSnifferBanner) el.clipboardSnifferBanner.style.display = 'none';
    });
  }
  if (el.btnSnifferQuickQueue) {
    el.btnSnifferQuickQueue.addEventListener('click', async () => {
      if (state.sniffedUrl) {
        const quality = el.singleQualitySelect ? el.singleQualitySelect.value : 'Best Available (Up to 4K/8K)';
        const payload = [{
          url: state.sniffedUrl,
          title: state.sniffedUrl,
          thumbnail: 'assets/OmniMedia.png',
          is_short: false,
          duration_str: '00:00'
        }];
        showQueueLoadingPlaceholder(state.sniffedUrl);
        switchTab('tab-queue');
        startQueuePolling(250);
        pollQueueStatus();

        await window.pywebview.api.add_items_to_queue(payload, quality, null, 'Clipboard Sniffer Batch', false);
        showToast('Sniffed media added directly to queue!', 'success');
        pollQueueStatus();
      }
      if (el.clipboardSnifferBanner) el.clipboardSnifferBanner.style.display = 'none';
    });
  }
  if (el.btnSnifferDismiss) {
    el.btnSnifferDismiss.addEventListener('click', () => {
      if (el.clipboardSnifferBanner) el.clipboardSnifferBanner.style.display = 'none';
    });
  }

  // Shutdown Countdown Modal Actions
  if (el.btnCancelShutdown) {
    el.btnCancelShutdown.addEventListener('click', cancelShutdownCountdown);
  }
  if (el.btnShutDownNow) {
    el.btnShutDownNow.addEventListener('click', handleImmediateShutdown);
  }

  // Diagnostics
  el.btnClearLogs.addEventListener('click', () => {
    if (el.logTerminal) el.logTerminal.textContent = 'Logs reset.\n';
  });

  // In-App YouTube Sign-In & Cookie Session
  const handleSignInClick = async () => {
    showToast('Launching integrated YouTube sign-in window...', 'info');
    try {
      const res = await window.pywebview.api.open_youtube_login();
      if (res && res.message) {
        showToast(res.message, res.success ? 'info' : 'error');
      }
    } catch (e) {
      showToast(`Sign-in launch error: ${e}`, 'error');
    }
  };

  if (el.btnRibbonSignIn) el.btnRibbonSignIn.addEventListener('click', handleSignInClick);
  if (el.btnSignInYouTube) el.btnSignInYouTube.addEventListener('click', handleSignInClick);
  if (el.btnModalSignInYouTube) el.btnModalSignInYouTube.addEventListener('click', handleSignInClick);

  if (el.btnCaptureCookies) {
    el.btnCaptureCookies.addEventListener('click', async () => {
      showToast('Syncing active YouTube session cookies...', 'info');
      try {
        const res = await window.pywebview.api.capture_active_cookies();
        if (res && res.success) {
          showToast(res.message, 'success');
          updateCookiesUi(true, true);
          if (el.cookieHelpModal) el.cookieHelpModal.style.display = 'none';
        } else {
          showToast(res.error || 'No active session detected', 'error');
        }
      } catch (e) {
        showToast(`Capture error: ${e}`, 'error');
      }
    });
  }

  if (el.btnSignOutYouTube) {
    el.btnSignOutYouTube.addEventListener('click', async () => {
      try {
        const ok = await window.pywebview.api.sign_out_youtube();
        if (ok) {
          showToast('Signed out of YouTube session', 'info');
          updateCookiesUi(false, false);
        }
      } catch (e) {
        showToast(`Sign-out error: ${e}`, 'error');
      }
    });
  }

  // Cookies & VIP Extension Management
  const handleAutoExtract = async () => {
    showToast('Attempting 1-click cookie import from Chrome...', 'info');
    try {
      const res = await window.pywebview.api.auto_import_cookies('chrome');
      if (res && res.success) {
        showToast(res.message, 'success');
        updateCookiesUi(true, true);
        if (el.cookieHelpModal) el.cookieHelpModal.style.display = 'none';
      } else {
        showToast(res.error || 'Failed to extract cookies', 'error');
        if (el.cookieHelpModal) el.cookieHelpModal.style.display = 'flex';
      }
    } catch (e) {
      showToast(`Auto-import error: ${e}`, 'error');
    }
  };

  if (el.btnAutoImportCookies) el.btnAutoImportCookies.addEventListener('click', handleAutoExtract);
  if (el.btnModalAutoImport) el.btnModalAutoImport.addEventListener('click', handleAutoExtract);

  if (el.btnOpenChromeExtension) {
    el.btnOpenChromeExtension.addEventListener('click', () => {
      window.pywebview.api.open_extension_store('cookies_locally');
      showToast('Opening Chrome Web Store extension page in browser...', 'info');
    });
  }
  if (el.btnOpenExtLocally) {
    el.btnOpenExtLocally.addEventListener('click', () => {
      window.pywebview.api.open_extension_store('cookies_locally');
      showToast('Opening Chrome Web Store extension page in browser...', 'info');
    });
  }
  if (el.btnOpenExtEditor) {
    el.btnOpenExtEditor.addEventListener('click', () => {
      window.pywebview.api.open_extension_store('cookie_editor_chrome');
      showToast('Opening Cookie-Editor store page in browser...', 'info');
    });
  }

  if (el.btnImportCookies) el.btnImportCookies.addEventListener('click', handleImportCookies);
  if (el.btnModalImportCookies) el.btnModalImportCookies.addEventListener('click', handleImportCookies);
  if (el.btnRemoveCookies) el.btnRemoveCookies.addEventListener('click', handleRemoveCookies);
  if (el.btnShowCookieHelp) el.btnShowCookieHelp.addEventListener('click', () => {
    if (el.cookieHelpModal) el.cookieHelpModal.style.display = 'flex';
  });
  if (el.btnCloseCookieModal) el.btnCloseCookieModal.addEventListener('click', () => {
    if (el.cookieHelpModal) el.cookieHelpModal.style.display = 'none';
  });

  // Duplicate Modal Listeners
  if (el.btnCloseDuplicateModal) el.btnCloseDuplicateModal.addEventListener('click', hideDuplicateModal);
  if (el.btnCancelDuplicateModal) el.btnCancelDuplicateModal.addEventListener('click', hideDuplicateModal);
  if (el.btnSkipDuplicatesAction) {
    el.btnSkipDuplicatesAction.addEventListener('click', () => {
      if (pendingDuplicateAction && pendingDuplicateAction.onSkip) {
        pendingDuplicateAction.onSkip();
      }
      hideDuplicateModal();
    });
  }
  if (el.btnAddAllDuplicatesAction) {
    el.btnAddAllDuplicatesAction.addEventListener('click', () => {
      if (pendingDuplicateAction && pendingDuplicateAction.onAddAll) {
        pendingDuplicateAction.onAddAll();
      }
      hideDuplicateModal();
    });
  }

  // About Eaminx Modal Listeners
  if (el.btnAboutEaminx && el.aboutModal) {
    el.btnAboutEaminx.addEventListener('click', (e) => {
      e.preventDefault();
      el.aboutModal.style.display = 'flex';
    });
  }
  if (el.btnCloseAboutModal && el.aboutModal) {
    el.btnCloseAboutModal.addEventListener('click', () => {
      el.aboutModal.style.display = 'none';
    });
  }
  if (el.aboutModal) {
    el.aboutModal.addEventListener('click', (e) => {
      if (e.target === el.aboutModal) {
        el.aboutModal.style.display = 'none';
      }
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.aboutModal && el.aboutModal.style.display !== 'none') {
      el.aboutModal.style.display = 'none';
    }
  });

  // About Eaminx External Link Cards
  document.querySelectorAll('.about-link-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = card.dataset.url;
      if (url) {
        await window.pywebview.api.open_external_url(url);
        const title = card.querySelector('.about-link-title')?.textContent || 'link';
        showToast(`Opening ${title} in browser...`, 'info');
      }
    });
  });

  // Copy All Links
  if (el.btnCopyAllLinks) {
    el.btnCopyAllLinks.addEventListener('click', async (e) => {
      e.stopPropagation();
      const linksText = `Eaminx Community & Social Links:\n\nDiscord: https://discord.gg/wD7wfnfeFY\nWhatsApp: https://wa.me/+8801567997403\nTelegram: https://t.me/Eaminx\nTelegram Group: https://t.me/eaminxcorp\nWebsite: https://eaminx.com/`;
      const ok = await writeClipboardText(linksText);
      if (ok) {
        showToast('Copied all Eaminx links to clipboard!', 'success');
      }
    });
  }

  // Right-Click Context Menu on Inputs & Textareas
  document.addEventListener('contextmenu', e => {
    const target = e.target.closest('input[type="text"], textarea');
    if (target && el.customContextMenu) {
      e.preventDefault();
      activeContextInput = target;

      const menu = el.customContextMenu;
      menu.style.display = 'flex';

      const menuWidth = 190;
      const menuHeight = 180;
      let x = e.clientX;
      let y = e.clientY;

      if (x + menuWidth > window.innerWidth) {
        x = Math.max(10, window.innerWidth - menuWidth - 12);
      }
      if (y + menuHeight > window.innerHeight) {
        y = Math.max(10, window.innerHeight - menuHeight - 12);
      }

      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
    } else {
      hideContextMenu();
    }
  });

  function hideContextMenu() {
    if (el.customContextMenu) {
      el.customContextMenu.style.display = 'none';
    }
  }

  document.addEventListener('click', e => {
    if (el.customContextMenu && !el.customContextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideContextMenu();
  });

  if (el.ctxMenuPaste) {
    el.ctxMenuPaste.addEventListener('click', async () => {
      hideContextMenu();
      if (!activeContextInput) return;
      const text = await getClipboardText();
      if (!text) {
        showToast('Clipboard is empty or contains no readable text', 'warning');
        return;
      }
      const start = activeContextInput.selectionStart ?? activeContextInput.value.length;
      const end = activeContextInput.selectionEnd ?? activeContextInput.value.length;
      const val = activeContextInput.value;
      activeContextInput.value = val.substring(0, start) + text + val.substring(end);
      activeContextInput.selectionStart = activeContextInput.selectionEnd = start + text.length;
      activeContextInput.dispatchEvent(new Event('input', { bubbles: true }));
      activeContextInput.focus();
      showToast('Pasted from clipboard', 'info');
    });
  }

  if (el.ctxMenuCopy) {
    el.ctxMenuCopy.addEventListener('click', async () => {
      hideContextMenu();
      if (!activeContextInput) return;
      const selected = activeContextInput.value.substring(
        activeContextInput.selectionStart,
        activeContextInput.selectionEnd
      );
      const textToCopy = selected || activeContextInput.value;
      if (textToCopy) {
        await writeClipboardText(textToCopy);
        showToast('Copied to clipboard', 'info');
      } else {
        showToast('Nothing to copy', 'warning');
      }
    });
  }

  if (el.ctxMenuCut) {
    el.ctxMenuCut.addEventListener('click', async () => {
      hideContextMenu();
      if (!activeContextInput) return;
      const start = activeContextInput.selectionStart;
      const end = activeContextInput.selectionEnd;
      if (start !== end) {
        const textToCut = activeContextInput.value.substring(start, end);
        await writeClipboardText(textToCut);
        activeContextInput.value = activeContextInput.value.substring(0, start) + activeContextInput.value.substring(end);
        activeContextInput.selectionStart = activeContextInput.selectionEnd = start;
        activeContextInput.dispatchEvent(new Event('input', { bubbles: true }));
        showToast('Cut to clipboard', 'info');
      } else if (activeContextInput.value) {
        await writeClipboardText(activeContextInput.value);
        activeContextInput.value = '';
        activeContextInput.dispatchEvent(new Event('input', { bubbles: true }));
        showToast('Cut to clipboard', 'info');
      }
      activeContextInput.focus();
    });
  }

  if (el.ctxMenuSelectAll) {
    el.ctxMenuSelectAll.addEventListener('click', () => {
      hideContextMenu();
      if (!activeContextInput) return;
      activeContextInput.select();
      activeContextInput.focus();
    });
  }

  if (el.ctxMenuClear) {
    el.ctxMenuClear.addEventListener('click', () => {
      hideContextMenu();
      if (!activeContextInput) return;
      activeContextInput.value = '';
      activeContextInput.dispatchEvent(new Event('input', { bubbles: true }));
      activeContextInput.focus();
      showToast('Cleared input', 'info');
    });
  }
}

async function handleImportCookies() {
  try {
    const res = await window.pywebview.api.choose_cookies_file();
    if (res && res.success) {
      showToast(res.message, 'success');
      updateCookiesUi(true, true);
      if (el.cookieHelpModal) el.cookieHelpModal.style.display = 'none';
    } else if (res && res.error && res.error !== 'No file selected') {
      showToast(`Cookies error: ${res.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err}`, 'error');
  }
}

async function handleRemoveCookies() {
  try {
    const ok = await window.pywebview.api.remove_cookies();
    if (ok) {
      showToast('cookies.txt removed', 'info');
      updateCookiesUi(false, false);
    }
  } catch (err) {
    showToast(`Error: ${err}`, 'error');
  }
}

function updateCookiesUi(hasCookies, isSignedIn) {
  const signed = Boolean(isSignedIn);
  const active = Boolean(hasCookies || signed);

  // Update Ribbon Auth Chip
  if (el.authDot) {
    el.authDot.className = active ? 'auth-dot active' : 'auth-dot';
  }
  if (el.authRibbonText) {
    el.authRibbonText.textContent = signed ? 'Signed In (VIP)' : (active ? 'Cookies Active' : 'Sign In to YouTube');
  }
  if (el.btnRibbonSignIn) {
    el.btnRibbonSignIn.title = active ? 'YouTube session active (VIP 4K Unlocked)' : 'Sign into YouTube to unlock restricted / 4K videos';
  }

  // Update Settings Tab
  if (el.cookieActiveBadge) {
    if (signed) {
      el.cookieActiveBadge.textContent = '✅ Signed In (VIP 4K/8K Unlocked)';
      el.cookieActiveBadge.style.color = '#10b981';
      if (el.btnSignOutYouTube) el.btnSignOutYouTube.style.display = 'inline-flex';
      if (el.btnRemoveCookies) el.btnRemoveCookies.style.display = 'inline-flex';
    } else if (active) {
      el.cookieActiveBadge.textContent = '✅ VIP Unlocked (cookies.txt Active)';
      el.cookieActiveBadge.style.color = '#10b981';
      if (el.btnSignOutYouTube) el.btnSignOutYouTube.style.display = 'none';
      if (el.btnRemoveCookies) el.btnRemoveCookies.style.display = 'inline-flex';
    } else {
      el.cookieActiveBadge.textContent = 'Guest Mode';
      el.cookieActiveBadge.style.color = '#38bdf8';
      if (el.btnSignOutYouTube) el.btnSignOutYouTube.style.display = 'none';
      if (el.btnRemoveCookies) el.btnRemoveCookies.style.display = 'none';
    }
  }

  if (el.diagCookiesStatus) {
    if (signed) {
      el.diagCookiesStatus.textContent = 'YouTube Signed In (Active)';
      el.diagCookiesStatus.className = 'text-green';
    } else if (active) {
      el.diagCookiesStatus.textContent = 'cookies.txt Loaded (Active)';
      el.diagCookiesStatus.className = 'text-green';
    } else {
      el.diagCookiesStatus.textContent = 'Shield Active (Guest Mode)';
      el.diagCookiesStatus.className = 'text-cyan';
    }
  }
}

// ==========================================
// TAB 1: SINGLE DOWNLOADER
// ==========================================
async function handleInspectSingle() {
  const url = el.singleUrlInput.value.trim();
  if (!url) {
    showToast('Please paste a video link', 'error');
    return;
  }

  el.inspectSpinner.classList.add('active');
  el.btnInspectSingle.disabled = true;
  el.ribbonEngineText.textContent = 'Inspecting video metadata...';

  try {
    const res = await window.pywebview.api.inspect_url(url);
    if (!res.success) {
      showToast(res.error || 'Failed to inspect link', 'error');
      return;
    }

    state.singleItem = res;
    el.singleVideoTitle.textContent = res.title;
    el.singleUploader.textContent = res.uploader || 'Creator';
    el.singleDurationBadge.textContent = res.duration_str;
    el.singleThumbImg.src = res.thumbnail || 'assets/OmniMedia.png';
    el.singlePlatformTag.textContent = res.platform.toUpperCase();

    if (res.is_playlist) {
      el.singleTypeBadge.textContent = 'PLAYLIST';
      el.singleContentType.textContent = `YouTube Playlist (${res.playlist_count || (res.entries ? res.entries.length : 0)} items)`;
    } else if (res.is_short) {
      el.singleTypeBadge.textContent = res.platform === 'tiktok' ? 'TIKTOK' : (res.platform === 'instagram' ? 'REEL' : 'SHORT');
      el.singleContentType.textContent = 'Short-Form Content';
    } else {
      el.singleTypeBadge.textContent = 'VIDEO';
      el.singleContentType.textContent = 'Standard Video';
    }

    el.singleResultCard.style.display = 'flex';
    showToast(`Loaded metadata from ${res.platform.toUpperCase()}`, 'success');
  } catch (err) {
    showToast(`Inspect error: ${err}`, 'error');
  } finally {
    el.inspectSpinner.classList.remove('active');
    el.btnInspectSingle.disabled = false;
    el.ribbonEngineText.textContent = 'Engine Ready';
  }
}

async function handleDownloadSingle() {
  if (!state.singleItem) return;
  const quality = el.singleQualitySelect.value;
  const url = state.singleItem.url;

  // Check if item is already in queue or downloaded
  const checkRes = await window.pywebview.api.check_duplicates([url]);
  if (checkRes && checkRes.has_duplicates) {
    const dup = checkRes.duplicates[0];
    showDuplicateModal(
      'Duplicate Media Detected',
      `"${state.singleItem.title}" is already in your download queue or completed list (${dup.existing.status}). Do you want to add it again?`,
      checkRes.duplicates,
      () => {}, // Cancel/Skip
      async () => {
        await executeDownloadSingle(quality);
      }
    );
    return;
  }

  await executeDownloadSingle(quality);
}

async function executeDownloadSingle(quality) {
  let payload = [];
  let batchTitle = '';

  let timeRange = null;
  if (el.chkEnableTrimmer && el.chkEnableTrimmer.checked) {
    const sTime = el.trimStartTime ? el.trimStartTime.value.trim() : '00:00';
    const eTime = el.trimEndTime ? el.trimEndTime.value.trim() : '00:00';
    if (sTime && eTime && sTime !== eTime) {
      timeRange = `${sTime}-${eTime}`;
      showToast(`Trimmer active: ${sTime} to ${eTime}`, 'info');
    }
  }

  if (state.singleItem.is_playlist && state.singleItem.entries && state.singleItem.entries.length > 0) {
    payload = state.singleItem.entries.map(e => ({
      url: e.url,
      title: e.title,
      thumbnail: e.thumbnail || 'assets/OmniMedia.png',
      is_short: false,
      duration_str: e.duration_str || '00:00',
      uploader: state.singleItem.uploader || ''
    }));
    batchTitle = `PLAYLIST: ${state.singleItem.title.substring(0, 35)} (${payload.length} items)`;
  } else {
    payload = [{
      url: state.singleItem.url,
      title: state.singleItem.title,
      thumbnail: state.singleItem.thumbnail || 'assets/OmniMedia.png',
      is_short: state.singleItem.is_short,
      duration_str: state.singleItem.duration_str,
      time_range: timeRange,
      uploader: state.singleItem.uploader || ''
    }];
    batchTitle = `${state.singleItem.platform.toUpperCase()}: ${state.singleItem.title.substring(0, 30)}`;
  }

  const customOpts = {
    organize_subfolders: Boolean(state.settings.organize_subfolders)
  };

  showQueueLoadingPlaceholder(state.singleItem.title);
  switchTab('tab-queue');
  startQueuePolling(250);
  pollQueueStatus();

  const res = await window.pywebview.api.add_items_to_queue(payload, quality, null, batchTitle, false, customOpts);
  if (res.success) {
    showToast(`Added to Download Queue: ${state.singleItem.title}`, 'success');
    pollQueueStatus();
  }
}

async function handleCopyDirectLink() {
  if (!state.singleItem) {
    showToast('Please inspect a video first', 'warning');
    return;
  }
  const quality = el.singleQualitySelect ? el.singleQualitySelect.value : 'Best Available';
  const origHtml = el.btnCopyDirectLink.innerHTML;
  el.btnCopyDirectLink.disabled = true;
  el.btnCopyDirectLink.innerHTML = `<span class="loader-circle active" style="width:13px;height:13px;display:inline-block;"></span> <span>Extracting...</span>`;

  showToast(`Extracting direct stream link (${quality})...`, 'info');

  try {
    const res = await window.pywebview.api.get_direct_download_link(state.singleItem.url, quality);
    if (res && res.success && res.url) {
      const ok = await writeClipboardText(res.url);
      if (ok) {
        showToast('Direct stream link copied to clipboard! (Ready for IDM / VLC / Browser)', 'success');
      } else {
        showToast('Direct link extracted, but clipboard write failed', 'warning');
      }
    } else {
      showToast(res && res.error ? res.error : 'Failed to extract direct download link', 'error');
    }
  } catch (err) {
    showToast(`Extraction error: ${err}`, 'error');
  } finally {
    el.btnCopyDirectLink.disabled = false;
    el.btnCopyDirectLink.innerHTML = origHtml;
  }
}

// ==========================================
// TAB 2: CHANNEL SCRAPER WITH AVATAR LOGO
// ==========================================
async function handleScanChannel() {
  const url = el.channelUrlInput.value.trim();
  if (!url) {
    showToast('Please enter a channel or profile URL', 'error');
    return;
  }

  const limitVal = el.channelLimitSelect.value;
  const maxResults = limitVal === 'All Available' ? null : parseInt(limitVal, 10);

  el.channelSpinner.classList.add('active');
  el.btnScanChannel.disabled = true;
  el.ribbonEngineText.textContent = `Scanning channel feed...`;

  try {
    const res = await window.pywebview.api.scan_channel(url, state.selectedChannelFilter, maxResults);
    if (!res.success) {
      showToast(res.error || 'Scan failed', 'error');
      return;
    }

    state.scannedItems = res.items || [];
    state.currentChannel = res.channel || {};

    const ch = state.currentChannel;
    el.channelProfileTitle.textContent = ch.title || 'Channel';
    el.channelProfileHandle.textContent = ch.handle || (url.includes('@') ? '@' + url.split('@')[1] : `@${(ch.title || 'user').toLowerCase().replace(/\s+/g, '')}`);
    el.channelProfilePlatform.textContent = (ch.platform || 'YOUTUBE').toUpperCase();
    el.channelDiscoveredCount.textContent = `${state.scannedItems.length} Videos Discovered`;

    // Render Channel Avatar Logo
    if (ch.avatar) {
      el.channelAvatarImg.src = ch.avatar;
    } else {
      el.channelAvatarImg.src = 'assets/OmniMedia.png';
    }
    el.channelProfileHero.style.display = 'flex';

    el.batchCustomNameInput.value = `${ch.title || 'Channel'} Batch (${state.scannedItems.length} items)`;

    renderScannedCards();
    showToast(`Discovered ${state.scannedItems.length} videos from ${ch.title}!`, 'success');
  } catch (err) {
    showToast(`Scan error: ${err}`, 'error');
  } finally {
    el.channelSpinner.classList.remove('active');
    el.btnScanChannel.disabled = false;
    el.ribbonEngineText.textContent = 'Engine Ready';
  }
}

function renderScannedCards() {
  const q = state.tableSearchQuery;
  const filtered = state.scannedItems.filter(it => {
    if (!q) return true;
    return it.title.toLowerCase().includes(q) || it.id.toLowerCase().includes(q);
  });

  const shortsCount = state.scannedItems.filter(it => it.is_short).length;
  const videosCount = state.scannedItems.length - shortsCount;
  const selectedCount = state.scannedItems.filter(it => it.selected).length;

  el.channelCountSummary.textContent = `Scanned: ${state.scannedItems.length} (${videosCount} Videos, ${shortsCount} Shorts) | Selected: ${selectedCount}`;
  el.btnQueueSelectedText.textContent = `Download Selected (${selectedCount})`;
  el.btnAddScannedToQueue.disabled = selectedCount === 0;

  if (filtered.length === 0) {
    el.scannedCardsContainer.innerHTML = `
      <div class="empty-feed-placeholder">
        ${state.scannedItems.length === 0 ? 'Enter a URL above and click "Scan Feed".' : 'No videos match your search filter.'}
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(it => {
    const realIdx = state.scannedItems.indexOf(it);
    const plat = (it.platform || 'youtube').toUpperCase();
    const typeLabel = it.is_short ? (plat === 'TIKTOK' ? 'TIKTOK' : (plat === 'INSTAGRAM' ? 'REEL' : 'SHORT')) : 'VIDEO';
    const thumbUrl = it.thumbnail || (it.platform === 'youtube' && it.id ? `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg` : 'assets/OmniMedia.png');

    html += `
      <div class="scanned-video-row">
        <input type="checkbox" data-idx="${realIdx}" ${it.selected ? 'checked' : ''} class="item-cb custom-checkbox">
        <div class="scanned-thumb-box">
          ${thumbUrl ? `<img src="${thumbUrl}" alt="Thumb" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='assets/OmniMedia.png';">` : `<img src="assets/OmniMedia.png" alt="Thumb">`}
          <span class="scanned-duration-chip">${it.duration_str}</span>
        </div>
        <div class="scanned-info-cell">
          <div class="scanned-top-line">
            <span class="chip-mini-badge ${typeClass}">${typeLabel}</span>
            <span class="scanned-title-txt" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</span>
          </div>
          <div class="scanned-sub-line">
            <span>ID: ${it.id}</span> • <span>Platform: ${plat}</span>
          </div>
        </div>
      </div>
    `;
  });

  el.scannedCardsContainer.innerHTML = html;

  if (!el.scannedCardsContainer._delegated) {
    el.scannedCardsContainer._delegated = true;
    el.scannedCardsContainer.addEventListener('change', e => {
      const cb = e.target.closest('.item-cb');
      if (cb) {
        const idx = parseInt(cb.dataset.idx, 10);
        if (!isNaN(idx) && state.scannedItems[idx]) {
          state.scannedItems[idx].selected = cb.checked;
          updateScannedCounts();
        }
      }
    });
  }
}

function updateScannedCounts() {
  const selectedCount = state.scannedItems.filter(it => it.selected).length;
  const shortsCount = state.scannedItems.filter(it => it.is_short).length;
  const videosCount = state.scannedItems.length - shortsCount;
  el.channelCountSummary.textContent = `Scanned: ${state.scannedItems.length} (${videosCount} Videos, ${shortsCount} Shorts) | Selected: ${selectedCount}`;
  el.btnQueueSelectedText.textContent = `Download Selected (${selectedCount})`;
  el.btnAddScannedToQueue.disabled = selectedCount === 0;
}

function setAllScannedSelection(select) {
  state.scannedItems.forEach(it => it.selected = select);
  if (el.scannedCardsContainer) {
    el.scannedCardsContainer.querySelectorAll('.item-cb').forEach(cb => {
      cb.checked = select;
    });
  }
  updateScannedCounts();
}

function setTypeScannedSelection(wantShorts) {
  state.scannedItems.forEach(it => {
    it.selected = (it.is_short === wantShorts);
  });
  if (el.scannedCardsContainer) {
    el.scannedCardsContainer.querySelectorAll('.item-cb').forEach(cb => {
      const idx = parseInt(cb.dataset.idx, 10);
      if (!isNaN(idx) && state.scannedItems[idx]) {
        cb.checked = state.scannedItems[idx].selected;
      }
    });
  }
  updateScannedCounts();
}

async function handleAddScannedToQueue() {
  const selected = state.scannedItems.filter(it => it.selected);
  if (selected.length === 0) return;

  const quality = el.channelBatchQualitySelect.value;
  const batchTitle = el.batchCustomNameInput.value.trim() || `Channel Batch (${selected.length} items)`;
  const batchId = `batch_${Date.now()}`;
  const skipDuplicates = el.cbChannelSkipDuplicates ? el.cbChannelSkipDuplicates.checked : true;

  const urls = selected.map(it => it.url);

  // If user disabled auto-skip, check if duplicates exist and prompt
  if (!skipDuplicates) {
    const checkRes = await window.pywebview.api.check_duplicates(urls);
    if (checkRes && checkRes.has_duplicates) {
      showDuplicateModal(
        'Duplicate Videos Warning',
        `${checkRes.duplicate_count} of ${selected.length} selected videos are already in your download queue or completed list. How would you like to proceed?`,
        checkRes.duplicates,
        async () => {
          await executeQueueScanned(selected, quality, batchTitle, batchId, true);
        },
        async () => {
          await executeQueueScanned(selected, quality, batchTitle, batchId, false);
        }
      );
      return;
    }
  }

  await executeQueueScanned(selected, quality, batchTitle, batchId, skipDuplicates);
}

async function executeQueueScanned(selected, quality, batchTitle, batchId, skipDuplicates) {
  const payload = selected.map(it => ({
    url: it.url,
    title: it.title,
    thumbnail: it.thumbnail || (it.platform === 'youtube' && it.id ? `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg` : ''),
    is_short: it.is_short,
    duration_str: it.duration_str
  }));

  showQueueLoadingPlaceholder(batchTitle);
  switchTab('tab-queue');
  startQueuePolling(250);
  pollQueueStatus();

  const res = await window.pywebview.api.add_items_to_queue(payload, quality, batchId, batchTitle, skipDuplicates);
  if (res.success) {
    if (res.skipped_count > 0) {
      showToast(`Queued ${res.count} videos into "${batchTitle}" (auto-skipped ${res.skipped_count} duplicates)!`, 'success');
    } else {
      showToast(`Queued ${res.count} videos into "${batchTitle}"!`, 'success');
    }
    pollQueueStatus();
  }
}

// ==========================================
// TAB 3: BULK URLS
// ==========================================
function updateBulkCount() {
  const lines = el.bulkTextarea.value.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('http://') || l.startsWith('https://'));
  el.bulkUrlCount.textContent = `${lines.length} URLs detected`;
}

function handleDeduplicateBulk() {
  const lines = el.bulkTextarea.value.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const unique = [];
  const seen = new Set();
  lines.forEach(l => {
    if (!seen.has(l)) {
      seen.add(l);
      unique.push(l);
    }
  });

  const removed = lines.length - unique.length;
  el.bulkTextarea.value = unique.join('\n');
  updateBulkCount();
  if (removed > 0) {
    showToast(`Removed ${removed} duplicate lines from text list!`, 'success');
  } else {
    showToast('No duplicate lines found in textbox.', 'info');
  }
}

async function handleImportTxt() {
  const content = await window.pywebview.api.choose_txt_file();
  if (content) {
    el.bulkTextarea.value = content;
    updateBulkCount();
    showToast('Imported URLs from file', 'success');
  }
}

async function handleQueueBulk() {
  const lines = el.bulkTextarea.value.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('http://') || l.startsWith('https://'));

  if (lines.length === 0) {
    showToast('No valid URLs found in textarea', 'error');
    return;
  }

  const quality = el.bulkQualitySelect.value;
  const batchId = `bulk_${Date.now()}`;
  const batchTitle = `Bulk Links (${lines.length} videos)`;
  const skipDuplicates = el.cbBulkSkipDuplicates ? el.cbBulkSkipDuplicates.checked : true;

  if (!skipDuplicates) {
    const checkRes = await window.pywebview.api.check_duplicates(lines);
    if (checkRes && checkRes.has_duplicates) {
      showDuplicateModal(
        'Duplicate URLs Warning',
        `${checkRes.duplicate_count} of ${lines.length} links are already in your queue or downloaded. What would you like to do?`,
        checkRes.duplicates,
        async () => {
          await executeQueueBulk(lines, quality, batchTitle, batchId, true);
        },
        async () => {
          await executeQueueBulk(lines, quality, batchTitle, batchId, false);
        }
      );
      return;
    }
  }

  await executeQueueBulk(lines, quality, batchTitle, batchId, skipDuplicates);
}

async function executeQueueBulk(lines, quality, batchTitle, batchId, skipDuplicates) {
  const payload = lines.map(url => ({
    url,
    title: '',
    thumbnail: '',
    is_short: url.includes('/shorts/') || url.includes('/reel/') || url.includes('tiktok.com'),
    duration_str: '00:00'
  }));

  showQueueLoadingPlaceholder(`Bulk URLs Batch (${lines.length} items)`);
  el.bulkTextarea.value = '';
  updateBulkCount();
  switchTab('tab-queue');
  startQueuePolling(250);
  pollQueueStatus();

  const res = await window.pywebview.api.add_items_to_queue(payload, quality, batchId, batchTitle, skipDuplicates);
  if (res.success) {
    if (res.skipped_count > 0) {
      showToast(`Added ${res.count} URLs into queue (skipped ${res.skipped_count} duplicates)!`, 'success');
    } else {
      showToast(`Added ${res.count} URLs into queue!`, 'success');
    }
    pollQueueStatus();
  }
}

// ==========================================
// TAB 4: QUEUE POLLING & INDIVIDUAL VIDEO ACTIONS
// (Pause, Show in Folder, Remove, Retry)
// ==========================================
let isPollingActive = false;
let pollTimeoutId = null;

function startQueuePolling(intervalMs = 800) {
  if (pollTimeoutId) clearTimeout(pollTimeoutId);
  state.currentPollInterval = intervalMs;
  scheduleNextPoll(intervalMs);
}

function scheduleNextPoll(delayMs) {
  if (pollTimeoutId) clearTimeout(pollTimeoutId);
  pollTimeoutId = setTimeout(pollQueueStatus, delayMs);
}

async function pollQueueStatus() {
  if (isPollingActive) {
    scheduleNextPoll(state.currentPollInterval || 1000);
    return;
  }
  isPollingActive = true;
  try {
    const data = await window.pywebview.api.get_queue_status();
    if (!data) {
      scheduleNextPoll(2000);
      return;
    }

    state.isPaused = data.is_paused;
    if (el.btnPauseQueue) el.btnPauseQueue.textContent = state.isPaused ? 'Resume Queue' : 'Pause Queue';

    if (el.ribbonActiveCount) el.ribbonActiveCount.textContent = data.active_count;
    if (el.ribbonQueueCount) el.ribbonQueueCount.textContent = `${data.queued_count} items`;
    if (el.ribbonSpeed) el.ribbonSpeed.textContent = data.total_speed_str;
    if (el.ribbonCompleted) el.ribbonCompleted.textContent = data.completed_count;
    if (el.sidebarQueueCount) el.sidebarQueueCount.textContent = data.active_count + data.queued_count;

    if (el.ribbonEngineText) {
      if (data.active_count > 0) {
        el.ribbonEngineText.textContent = `Downloading ${data.active_count} files (${data.total_speed_str})`;
      } else {
        el.ribbonEngineText.textContent = data.queued_count > 0 ? 'Queue active...' : 'Engine Ready';
      }
    }

    renderBatches(data.batches || []);

    // Completion sound alert
    if (state.lastCompletedCount !== undefined && data.completed_count > state.lastCompletedCount) {
      playCompletionChime();
      showToast(`Download finished! (${data.completed_count} total completed)`, 'success');
    }
    state.lastCompletedCount = data.completed_count;

    // Check Auto-Shutdown condition (all downloads finished)
    const isAutoShutdownEnabled = Boolean(
      state.settings.auto_shutdown_on_finish ||
      (el.queueAutoShutdownToggle && el.queueAutoShutdownToggle.checked)
    );
    if (isAutoShutdownEnabled && data.total_items > 0 && data.active_count === 0 && data.queued_count === 0 && !state.shutdownModalTriggered) {
      triggerShutdownCountdown();
    }

    // Smart Clipboard URL Sniffer Check
    if (state.settings.clipboard_monitor !== false && (!state.lastSniffTime || Date.now() - state.lastSniffTime > 2200)) {
      state.lastSniffTime = Date.now();
      try {
        const sniffRes = await window.pywebview.api.check_clipboard_for_media();
        if (sniffRes && sniffRes.has_media && sniffRes.url) {
          showSnifferBanner(sniffRes.url, sniffRes.platform);
        }
      } catch (e) {}
    }

    if (data.has_cookies !== undefined || data.is_signed_in !== undefined) {
      updateCookiesUi(Boolean(data.has_cookies), Boolean(data.is_signed_in));
    }

    // Terminal log display with smart scroll (does not hijack manual scroll up)
    if (data.logs && el.logTerminal) {
      const isScrolledToBottom = (el.logTerminal.scrollHeight - el.logTerminal.scrollTop - el.logTerminal.clientHeight) < 45;
      el.logTerminal.textContent = data.logs.join('\n');
      if (isScrolledToBottom) {
        el.logTerminal.scrollTop = el.logTerminal.scrollHeight;
      }
    }

    // Adaptive polling: relax when queue is completely idle
    const hasActivity = (data.active_count > 0 || data.queued_count > 0);
    const targetInterval = hasActivity ? 800 : 2500;
    state.currentPollInterval = targetInterval;
    scheduleNextPoll(targetInterval);
  } catch (err) {
    scheduleNextPoll(2500);
  } finally {
    isPollingActive = false;
  }
}

function renderItemActionButtons(it) {
  let actionButtons = `
    <div class="item-actions-cluster">
      <button class="item-btn-tool btn-item-folder" data-id="${it.id}" title="Show in Folder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span>Folder</span>
      </button>
  `;

  if (it.status === 'Downloading') {
    actionButtons += `
      <button class="item-btn-tool btn-item-pause" data-id="${it.id}" title="Pause Video">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <span>Pause</span>
      </button>
    `;
  } else if (it.status === 'Paused') {
    actionButtons += `
      <button class="item-btn-tool btn-item-pause" data-id="${it.id}" title="Resume Video">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
        <span>Resume</span>
      </button>
    `;
  } else if (it.status === 'Error' || it.status === 'Cancelled') {
    actionButtons += `
      <button class="item-btn-tool btn-item-retry" data-id="${it.id}" title="Retry Download">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        <span>Retry</span>
      </button>
    `;
  }

  actionButtons += `
      <button class="item-btn-tool danger btn-item-remove" data-id="${it.id}" title="Remove Video">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span>Remove</span>
      </button>
    </div>
  `;
  return actionButtons;
}

function getItemStatText(it) {
  if (it.status === 'Downloading') {
    return `Speed: ${it.speed || '...'} • ETA: ${it.eta || '--:--'} • ${it.downloaded} / ${it.total}`;
  } else if (it.status === 'Completed') {
    return `Size: ${it.total !== 'Unknown' && it.total !== '0 B' ? it.total : it.downloaded}`;
  } else if (it.status === 'Merging') {
    return 'Merging video & audio streams...';
  } else {
    return `${it.downloaded} / ${it.total}`;
  }
}

function renderSingleItemHtml(it) {
  const statusClass = it.status.toLowerCase();
  const thumbUrl = it.thumbnail || (it.platform === 'youtube' && it.id ? `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg` : 'assets/OmniMedia.png');
  return `
    <div class="video-queue-item" data-item-id="${it.id}" data-status="${it.status}">
      <div class="item-thumb-mini">
        ${thumbUrl ? `<img src="${thumbUrl}" alt="Thumb" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='assets/OmniMedia.png';">` : `<img src="assets/OmniMedia.png" alt="Thumb">`}
        <span class="mini-duration">${it.duration_str}</span>
      </div>
      <div class="item-content">
        <div class="item-header-line">
          <span class="plat-grid-item ${(it.platform || 'yt')}" style="padding:1px 6px;font-size:0.62rem;display:inline-flex;">${(it.platform || 'YT').toUpperCase()}</span>
          <span class="item-title-text" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</span>
          <span class="item-status-pill ${statusClass}">${it.status} ${it.status === 'Downloading' ? `(${it.progress_pct}%)` : ''}</span>
        </div>

        <div class="item-progress-track">
          <div class="item-progress-bar" style="width: ${it.progress_pct}%;"></div>
        </div>

        <div class="item-meta-row">
          <span>Format: ${escapeHtml(it.quality.split(' (')[0])}</span>
          <span class="item-live-stat">${getItemStatText(it)}</span>
        </div>
      </div>
      ${renderItemActionButtons(it)}
    </div>
  `;
}

function showQueueLoadingPlaceholder(title = 'Preparing media stream...') {
  if (!el.batchesContainer) return;
  state.isAddingToQueue = true;

  if (state.queueAddingSafetyTimer) clearTimeout(state.queueAddingSafetyTimer);
  state.queueAddingSafetyTimer = setTimeout(() => {
    state.isAddingToQueue = false;
    const banner = el.batchesContainer.querySelector('.queue-prep-banner');
    if (banner) banner.remove();
    pollQueueStatus();
  }, 7000);

  const hasExistingBatches = el.batchesContainer.querySelector('.batch-card');
  if (!hasExistingBatches) {
    el.batchesContainer.innerHTML = `
      <div class="queue-loading-tile">
        <div class="queue-spinner-ring"></div>
        <div class="queue-loading-content">
          <h3>Adding to Download Queue...</h3>
          <p class="queue-loading-title">${escapeHtml(title)}</p>
          <div class="queue-loading-track"><div class="queue-loading-shimmer"></div></div>
        </div>
      </div>
    `;
  } else {
    let prepBanner = el.batchesContainer.querySelector('.queue-prep-banner');
    if (!prepBanner) {
      el.batchesContainer.insertAdjacentHTML('afterbegin', `
        <div class="queue-prep-banner">
          <div class="queue-prep-spinner"></div>
          <span class="queue-prep-text">Adding new download batch to queue...</span>
          <span class="queue-prep-sub">${escapeHtml(title)}</span>
        </div>
      `);
    }
  }
}

function renderBatches(batches) {
  if (!el.batchesContainer) return;
  setupQueueDelegation();

  if (!batches || batches.length === 0) {
    if (state.isAddingToQueue) {
      return;
    }
    el.batchesContainer.innerHTML = `
      <div class="empty-queue-tile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
        <h3>Download queue is empty</h3>
        <p>Add some videos, shorts, or scrape a channel to watch live downloads here.</p>
      </div>
    `;
    return;
  }

  // Active batches exist: clear pending loader flags
  state.isAddingToQueue = false;
  if (state.queueAddingSafetyTimer) clearTimeout(state.queueAddingSafetyTimer);

  const loadingTile = el.batchesContainer.querySelector('.queue-loading-tile');
  if (loadingTile) loadingTile.remove();
  const prepBanner = el.batchesContainer.querySelector('.queue-prep-banner');
  if (prepBanner) prepBanner.remove();
  const emptyTile = el.batchesContainer.querySelector('.empty-queue-tile');
  if (emptyTile) emptyTile.remove();

  const batchIdsSet = new Set(batches.map(b => b.batch_id));

  // Remove batch cards that no longer exist
  el.batchesContainer.querySelectorAll('.batch-card').forEach(card => {
    const bId = card.dataset.batch;
    if (!batchIdsSet.has(bId)) {
      card.remove();
    }
  });

  batches.forEach(batch => {
    let batchCard = el.batchesContainer.querySelector(`.batch-card[data-batch="${batch.batch_id}"]`);
    const isCollapsed = state.collapsedBatches.has(batch.batch_id);
    const hasActiveJobs = batch.downloading > 0 || batch.queued > 0;
    const subText = `${batch.total} Total Videos • ${batch.completed} Completed • ${batch.downloading} Downloading • ${batch.queued} Queued`;

    if (!batchCard) {
      // First time rendering this batch: create it
      const collapseClass = isCollapsed ? 'batch-card collapsed' : 'batch-card';
      const itemsHtml = batch.items.map(it => renderSingleItemHtml(it)).join('');
      const cardHtml = `
        <div class="${collapseClass}" data-batch="${batch.batch_id}">
          <div class="batch-header" data-toggle="${batch.batch_id}">
            <div class="batch-title-group">
              <div class="batch-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div class="batch-titles">
                <h3>${escapeHtml(batch.batch_title)}</h3>
                <span class="batch-sub-txt">${subText}</span>
              </div>
            </div>

            <div class="batch-stats-group">
              <div class="batch-progress-wrapper">
                <div class="mini-progress-bar">
                  <div class="mini-progress-fill" style="width: ${batch.overall_pct}%;"></div>
                </div>
                <span class="batch-pct">${batch.overall_pct}%</span>
              </div>

              <div class="batch-btn-group">
                ${hasActiveJobs ? `<button class="btn-ghost-sm btn-cancel-batch" data-batch="${batch.batch_id}" title="Cancel active downloads in this batch">Cancel</button>` : ''}
                <button class="btn-ghost-sm btn-clear-batch" data-batch="${batch.batch_id}" title="Completely remove this batch from queue">✕ Clear</button>
              </div>

              <svg class="batch-toggle-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>

          <div class="batch-items-container">
            ${itemsHtml}
          </div>
        </div>
      `;
      el.batchesContainer.insertAdjacentHTML('beforeend', cardHtml);
      return;
    }

    // Batch element exists! Update dynamic elements in-place without rebuilding DOM
    const subTxtEl = batchCard.querySelector('.batch-sub-txt');
    if (subTxtEl && subTxtEl.textContent !== subText) subTxtEl.textContent = subText;

    const fillEl = batchCard.querySelector('.mini-progress-fill');
    if (fillEl) fillEl.style.width = `${batch.overall_pct}%`;

    const pctEl = batchCard.querySelector('.batch-pct');
    if (pctEl) pctEl.textContent = `${batch.overall_pct}%`;

    const btnGroup = batchCard.querySelector('.batch-btn-group');
    if (btnGroup) {
      const cancelBtn = btnGroup.querySelector('.btn-cancel-batch');
      if (hasActiveJobs && !cancelBtn) {
        btnGroup.insertAdjacentHTML('afterbegin', `<button class="btn-ghost-sm btn-cancel-batch" data-batch="${batch.batch_id}" title="Cancel active downloads in this batch">Cancel</button>`);
      } else if (!hasActiveJobs && cancelBtn) {
        cancelBtn.remove();
      }
    }

    const itemsContainer = batchCard.querySelector('.batch-items-container');
    if (!itemsContainer) return;

    const currentItemIds = new Set(batch.items.map(it => String(it.id)));
    // Remove items no longer in batch
    itemsContainer.querySelectorAll('.video-queue-item').forEach(itemEl => {
      if (!currentItemIds.has(itemEl.dataset.itemId)) {
        itemEl.remove();
      }
    });

    // Update or insert items
    batch.items.forEach(it => {
      const itemEl = itemsContainer.querySelector(`.video-queue-item[data-item-id="${it.id}"]`);
      if (!itemEl) {
        itemsContainer.insertAdjacentHTML('beforeend', renderSingleItemHtml(it));
        return;
      }

      // Update in-place
      const bar = itemEl.querySelector('.item-progress-bar');
      if (bar) bar.style.width = `${it.progress_pct}%`;

      const pill = itemEl.querySelector('.item-status-pill');
      if (pill) {
        const statusClass = it.status.toLowerCase();
        pill.className = `item-status-pill ${statusClass}`;
        pill.textContent = `${it.status} ${it.status === 'Downloading' ? `(${it.progress_pct}%)` : ''}`;
      }

      const statEl = itemEl.querySelector('.item-live-stat');
      if (statEl) {
        const txt = getItemStatText(it);
        if (statEl.textContent !== txt) statEl.textContent = txt;
      }

      // If status changed, update action buttons
      if (itemEl.dataset.status !== it.status) {
        itemEl.dataset.status = it.status;
        const cluster = itemEl.querySelector('.item-actions-cluster');
        if (cluster) {
          cluster.outerHTML = renderItemActionButtons(it);
        }
      }
    });
  });
}

function setupQueueDelegation() {
  if (el.batchesContainer._delegated) return;
  el.batchesContainer._delegated = true;

  el.batchesContainer.addEventListener('click', async e => {
    // 1. Toggle collapse
    const header = e.target.closest('[data-toggle]');
    if (header && !e.target.closest('button')) {
      const bId = header.dataset.toggle;
      if (state.collapsedBatches.has(bId)) {
        state.collapsedBatches.delete(bId);
      } else {
        state.collapsedBatches.add(bId);
      }
      const card = header.closest('.batch-card');
      if (card) card.classList.toggle('collapsed');
      return;
    }

    // 2. Pause / Resume item
    const pauseBtn = e.target.closest('.btn-item-pause');
    if (pauseBtn) {
      e.stopPropagation();
      const id = parseInt(pauseBtn.dataset.id, 10);
      await window.pywebview.api.toggle_pause_item(id);
      pollQueueStatus();
      return;
    }

    // 3. Folder item
    const folderBtn = e.target.closest('.btn-item-folder');
    if (folderBtn) {
      e.stopPropagation();
      const id = parseInt(folderBtn.dataset.id, 10);
      await window.pywebview.api.open_item_folder(id);
      showToast('Opening download destination folder', 'info');
      return;
    }

    // 4. Retry item
    const retryBtn = e.target.closest('.btn-item-retry');
    if (retryBtn) {
      e.stopPropagation();
      const id = parseInt(retryBtn.dataset.id, 10);
      await window.pywebview.api.retry_item(id);
      showToast(`Retrying item #${id}`, 'info');
      startQueuePolling(600);
      pollQueueStatus();
      return;
    }

    // 5. Remove item
    const removeBtn = e.target.closest('.btn-item-remove');
    if (removeBtn) {
      e.stopPropagation();
      const id = parseInt(removeBtn.dataset.id, 10);
      await window.pywebview.api.remove_item(id);
      showToast(`Removed item #${id}`, 'info');
      pollQueueStatus();
      return;
    }

    // 6. Cancel batch
    const cancelBatchBtn = e.target.closest('.btn-cancel-batch');
    if (cancelBatchBtn) {
      e.stopPropagation();
      const bId = cancelBatchBtn.dataset.batch;
      await window.pywebview.api.cancel_batch(bId, false);
      showToast('Batch downloads cancelled. Click Clear to remove.', 'warning');
      pollQueueStatus();
      return;
    }

    // 7. Clear batch
    const clearBatchBtn = e.target.closest('.btn-clear-batch');
    if (clearBatchBtn) {
      e.stopPropagation();
      const bId = clearBatchBtn.dataset.batch;
      await window.pywebview.api.remove_batch(bId);
      showToast('Batch cleared and removed from queue', 'info');
      pollQueueStatus();
      return;
    }
  });
}

async function handleTogglePauseQueue() {
  const newPaused = await window.pywebview.api.pause_queue(!state.isPaused);
  state.isPaused = newPaused;
  el.btnPauseQueue.textContent = state.isPaused ? 'Resume Queue' : 'Pause Queue';
  showToast(state.isPaused ? 'Queue paused' : 'Queue resumed', 'info');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', initializeApp);
