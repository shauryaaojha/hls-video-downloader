// HLS Video Downloader - Popup Script
// Memory optimized

let streams = {};
let selectedQualities = {};

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  loadStreams();
  setupEventListeners();
  setupMessageListener();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', loadStreams);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('clearBtn').addEventListener('click', clearAllStreams);
}

// Setup message listener for real-time updates
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STREAM_DETECTED') {
      loadStreams();
    } else if (message.type === 'PLAYLIST_PARSED') {
      loadStreams();
    } else if (message.type === 'DOWNLOAD_PROGRESS') {
      updateProgress(message.streamId, message.progress);
    } else if (message.type === 'DOWNLOAD_COMPLETED') {
      onDownloadCompleted(message.streamId);
    } else if (message.type === 'DOWNLOAD_ERROR') {
      onDownloadError(message.streamId, message.error);
    }
  });
}

// Load streams from background
function loadStreams() {
  chrome.runtime.sendMessage({ type: 'GET_STREAMS' }, (response) => {
    if (response && response.streams) {
      streams = response.streams;
      renderStreams();
      updateStreamCount();
    }
  });
}

// Render streams list
function renderStreams() {
  const streamsList = document.getElementById('streamsList');
  const emptyState = document.getElementById('emptyState');

  const streamIds = Object.keys(streams);

  if (streamIds.length === 0) {
    streamsList.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  streamsList.classList.remove('hidden');

  streamsList.innerHTML = '';

  // Memory optimization: Limit rendered streams to prevent excessive DOM
  const MAX_RENDERED_STREAMS = 20;
  const streamsToRender = streamIds.slice(0, MAX_RENDERED_STREAMS);

  if (streamIds.length > MAX_RENDERED_STREAMS) {
    console.log(`Showing ${MAX_RENDERED_STREAMS} of ${streamIds.length} streams`);
  }

  streamsToRender.forEach(streamId => {
    const stream = streams[streamId];
    const card = createStreamCard(stream);
    streamsList.appendChild(card);
  });
}

// Create stream card element
function createStreamCard(stream) {
  const card = document.createElement('div');
  card.className = 'stream-card';
  card.dataset.streamId = stream.id;

  // Initialize selected quality
  if (!selectedQualities[stream.id] && stream.qualities.length > 0) {
    selectedQualities[stream.id] = 0; // Select best quality by default
  }

  card.innerHTML = `
    <div class="stream-header">
      <div class="stream-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      </div>
      <div class="stream-info">
        <div class="stream-title">${escapeHtml(stream.tabTitle || 'Unknown')}</div>
        <div class="stream-url">${escapeHtml(truncateUrl(stream.url))}</div>
      </div>
      <div class="stream-status ${stream.status}">
        <span class="status-dot"></span>
        ${getStatusText(stream.status)}
      </div>
    </div>
    
    ${stream.qualities.length > 0 ? `
      <div class="quality-selector">
        <label class="quality-label">Select Quality</label>
        <div class="quality-options">
          ${stream.qualities.map((quality, index) => `
            <div class="quality-option ${index === selectedQualities[stream.id] ? 'selected' : ''}" 
                 data-stream-id="${stream.id}" 
                 data-quality-index="${index}">
              ${quality.resolution}
              ${quality.bandwidth ? `<br><small>${formatBandwidth(quality.bandwidth)}</small>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <div class="progress-container hidden" id="progress-${stream.id}">
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      <div class="progress-text">
        <span class="progress-status">Downloading...</span>
        <span class="progress-percentage">0%</span>
      </div>
    </div>
    
    <div class="stream-actions">
      <button class="btn-primary" data-stream-id="${stream.id}" id="download-${stream.id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"></path>
          <path d="M7 10L12 15L17 10"></path>
          <path d="M12 15V3"></path>
        </svg>
        Download
      </button>
    </div>
  `;

  // Add event listeners
  const qualityOptions = card.querySelectorAll('.quality-option');
  qualityOptions.forEach(option => {
    option.addEventListener('click', handleQualitySelect);
  });

  const downloadBtn = card.querySelector(`#download-${stream.id}`);
  downloadBtn.addEventListener('click', () => handleDownload(stream.id));

  return card;
}

// Handle quality selection
function handleQualitySelect(event) {
  const streamId = event.currentTarget.dataset.streamId;
  const qualityIndex = parseInt(event.currentTarget.dataset.qualityIndex);

  // Update selected quality
  selectedQualities[streamId] = qualityIndex;

  // Update UI
  const card = document.querySelector(`[data-stream-id="${streamId}"]`);
  const options = card.querySelectorAll('.quality-option');
  options.forEach(opt => opt.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

// Handle download
function handleDownload(streamId) {
  const qualityIndex = selectedQualities[streamId] || 0;

  // Disable button
  const btn = document.getElementById(`download-${streamId}`);
  btn.disabled = true;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 6V12L16 14"></path>
    </svg>
    Starting...
  `;

  // Show progress container
  const progressContainer = document.getElementById(`progress-${streamId}`);
  if (progressContainer) {
    progressContainer.classList.remove('hidden');
  }

  // Send download request
  chrome.runtime.sendMessage({
    type: 'DOWNLOAD_STREAM',
    streamId: streamId,
    qualityIndex: qualityIndex
  });
}

// Update download progress
function updateProgress(streamId, progress) {
  const progressContainer = document.getElementById(`progress-${streamId}`);
  if (!progressContainer) return;

  const progressFill = progressContainer.querySelector('.progress-fill');
  const progressPercentage = progressContainer.querySelector('.progress-percentage');
  const progressStatus = progressContainer.querySelector('.progress-status');

  progressFill.style.width = `${progress.progress}%`;
  progressPercentage.textContent = `${progress.progress}%`;
  progressStatus.textContent = `Downloading ${progress.downloaded}/${progress.total} segments`;
}

// Handle download completion
function onDownloadCompleted(streamId) {
  const btn = document.getElementById(`download-${streamId}`);
  if (btn) {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999"></path>
        <path d="M22 4L12 14.01L9 11.01"></path>
      </svg>
      Completed
    `;
    btn.disabled = true;
  }
}

// Handle download error
function onDownloadError(streamId, error) {
  const btn = document.getElementById(`download-${streamId}`);
  if (btn) {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      Error
    `;
    btn.disabled = false;

    // Show error in progress
    const progressContainer = document.getElementById(`progress-${streamId}`);
    if (progressContainer) {
      const progressStatus = progressContainer.querySelector('.progress-status');
      progressStatus.textContent = `Error: ${error}`;
      progressStatus.style.color = '#EF4444';
    }
  }
}

// Clear all streams
function clearAllStreams() {
  if (confirm('Clear all detected streams?')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_STREAMS' }, () => {
      streams = {};
      selectedQualities = {};
      renderStreams();
      updateStreamCount();
    });
  }
}

// Open settings page
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Update stream count
function updateStreamCount() {
  const count = Object.keys(streams).length;
  document.getElementById('streamCount').textContent = `${count} stream${count !== 1 ? 's' : ''}`;
}

// Get status text
function getStatusText(status) {
  const statusMap = {
    'detected': 'Detected',
    'downloading': 'Downloading',
    'completed': 'Completed',
    'error': 'Error'
  };
  return statusMap[status] || status;
}

// Format bandwidth
function formatBandwidth(bandwidth) {
  const mbps = (bandwidth / 1000000).toFixed(1);
  return `${mbps} Mbps`;
}

// Truncate URL
function truncateUrl(url) {
  if (url.length > 50) {
    return url.substring(0, 47) + '...';
  }
  return url;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Memory optimization: Cleanup on window unload
window.addEventListener('beforeunload', () => {
  // Clear references to help garbage collection
  streams = {};
  selectedQualities = {};
});
