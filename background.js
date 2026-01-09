// HLS Video Downloader - Background Service Worker

// Store for detected HLS streams
let detectedStreams = {};
let downloadProgress = {};

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('HLS Video Downloader installed');
    // Initialize storage
    chrome.storage.local.set({
        streams: {},
        settings: {
            defaultQuality: 'best',
            autoDownload: false,
            concurrentDownloads: 3
        }
    });
});

// Listen for web requests to detect .m3u8 files
chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.url.includes('.m3u8')) {
            detectHLSStream(details);
        }
    },
    { urls: ["<all_urls>"] }
);

// Detect and store HLS stream
async function detectHLSStream(details) {
    const streamId = generateStreamId();
    const tabId = details.tabId;

    // Get tab info
    try {
        const tab = await chrome.tabs.get(tabId);

        const stream = {
            id: streamId,
            url: details.url,
            tabUrl: tab.url,
            tabTitle: tab.title,
            timestamp: Date.now(),
            status: 'detected',
            qualities: []
        };

        // Store stream
        detectedStreams[streamId] = stream;

        // Parse playlist to get qualities
        parsePlaylist(streamId, details.url);

        // Update storage
        chrome.storage.local.set({ streams: detectedStreams });

        // Notify popup if open
        chrome.runtime.sendMessage({
            type: 'STREAM_DETECTED',
            stream: stream
        }).catch(() => {
            // Popup not open, ignore
        });

        // Show badge
        chrome.action.setBadgeText({ text: Object.keys(detectedStreams).length.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#8B5CF6' });

    } catch (error) {
        console.error('Error processing HLS stream:', error);
    }
}

// Parse HLS playlist to extract qualities
async function parsePlaylist(streamId, url) {
    try {
        const response = await fetch(url);
        const playlistText = await response.text();

        const stream = detectedStreams[streamId];
        if (!stream) return;

        // Parse master playlist
        if (playlistText.includes('#EXT-X-STREAM-INF')) {
            // Master playlist with multiple qualities
            const qualities = parseM3U8Master(playlistText, url);
            stream.qualities = qualities;
            stream.type = 'master';
        } else {
            // Media playlist (single quality)
            stream.qualities = [{
                resolution: 'Unknown',
                bandwidth: 0,
                url: url,
                type: 'media'
            }];
            stream.type = 'media';
        }

        // Update storage
        chrome.storage.local.set({ streams: detectedStreams });

        // Notify popup
        chrome.runtime.sendMessage({
            type: 'PLAYLIST_PARSED',
            streamId: streamId,
            qualities: stream.qualities
        }).catch(() => { });

    } catch (error) {
        console.error('Error parsing playlist:', error);
    }
}

// Parse master playlist
function parseM3U8Master(content, baseUrl) {
    const lines = content.split('\n');
    const qualities = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXT-X-STREAM-INF')) {
            // Extract resolution and bandwidth
            const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);

            // Next line should be the URL
            const urlLine = lines[i + 1]?.trim();
            if (urlLine && !urlLine.startsWith('#')) {
                const playlistUrl = resolveUrl(baseUrl, urlLine);

                qualities.push({
                    resolution: resolutionMatch ? resolutionMatch[1] : 'Unknown',
                    bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0,
                    url: playlistUrl,
                    type: 'variant'
                });
            }
        }
    }

    // Sort by bandwidth (quality)
    qualities.sort((a, b) => b.bandwidth - a.bandwidth);

    return qualities;
}

// Resolve relative URLs
function resolveUrl(baseUrl, relativeUrl) {
    if (relativeUrl.startsWith('http')) {
        return relativeUrl;
    }

    const base = new URL(baseUrl);
    if (relativeUrl.startsWith('/')) {
        return `${base.origin}${relativeUrl}`;
    } else {
        const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
        return `${base.origin}${basePath}${relativeUrl}`;
    }
}

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STREAMS') {
        sendResponse({ streams: detectedStreams });
    } else if (message.type === 'DOWNLOAD_STREAM') {
        downloadStream(message.streamId, message.qualityIndex);
        sendResponse({ success: true });
    } else if (message.type === 'CLEAR_STREAMS') {
        detectedStreams = {};
        chrome.storage.local.set({ streams: {} });
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ success: true });
    } else if (message.type === 'GET_PROGRESS') {
        sendResponse({ progress: downloadProgress[message.streamId] || {} });
    }

    return true; // Keep channel open for async response
});

// Download HLS stream
async function downloadStream(streamId, qualityIndex) {
    const stream = detectedStreams[streamId];
    if (!stream) {
        console.error('Stream not found:', streamId);
        return;
    }

    const quality = stream.qualities[qualityIndex];
    if (!quality) {
        console.error('Quality not found:', qualityIndex);
        return;
    }

    // Initialize progress
    downloadProgress[streamId] = {
        status: 'downloading',
        progress: 0,
        total: 0,
        downloaded: 0
    };

    // Notify popup
    chrome.runtime.sendMessage({
        type: 'DOWNLOAD_STARTED',
        streamId: streamId
    }).catch(() => { });

    try {
        // Fetch media playlist
        const response = await fetch(quality.url);
        const playlistText = await response.text();

        // Parse segments
        const segments = parseMediaPlaylist(playlistText, quality.url);

        downloadProgress[streamId].total = segments.length;

        // Download segments
        const segmentData = [];
        for (let i = 0; i < segments.length; i++) {
            const segmentUrl = segments[i];

            try {
                const segmentResponse = await fetch(segmentUrl);
                const segmentBlob = await segmentResponse.blob();
                segmentData.push(segmentBlob);

                downloadProgress[streamId].downloaded = i + 1;
                downloadProgress[streamId].progress = Math.round(((i + 1) / segments.length) * 100);

                // Notify popup of progress
                chrome.runtime.sendMessage({
                    type: 'DOWNLOAD_PROGRESS',
                    streamId: streamId,
                    progress: downloadProgress[streamId]
                }).catch(() => { });

            } catch (error) {
                console.error('Error downloading segment:', error);
            }
        }

        // Merge segments into single blob
        const mergedBlob = new Blob(segmentData, { type: 'video/mp2t' });

        // Create download URL
        const downloadUrl = URL.createObjectURL(mergedBlob);

        // Trigger download
        const filename = `${stream.tabTitle || 'video'}_${quality.resolution}.ts`;

        chrome.downloads.download({
            url: downloadUrl,
            filename: sanitizeFilename(filename),
            saveAs: true
        }, (downloadId) => {
            if (downloadId) {
                downloadProgress[streamId].status = 'completed';

                chrome.runtime.sendMessage({
                    type: 'DOWNLOAD_COMPLETED',
                    streamId: streamId
                }).catch(() => { });
            }
        });

    } catch (error) {
        console.error('Error downloading stream:', error);
        downloadProgress[streamId].status = 'error';
        downloadProgress[streamId].error = error.message;

        chrome.runtime.sendMessage({
            type: 'DOWNLOAD_ERROR',
            streamId: streamId,
            error: error.message
        }).catch(() => { });
    }
}

// Parse media playlist for segments
function parseMediaPlaylist(content, baseUrl) {
    const lines = content.split('\n');
    const segments = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            segments.push(resolveUrl(baseUrl, trimmed));
        }
    }

    return segments;
}

// Generate unique stream ID
function generateStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Sanitize filename
function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9_\-\.]/gi, '_').substring(0, 200);
}
