// HLS Video Downloader - Background Service Worker
// Optimized for minimal memory consumption

// Store for detected HLS streams
let detectedStreams = {};
let downloadProgress = {};
let detectedUrls = new Set(); // Track URLs to prevent duplicates

// Memory optimization: Stream limits
const MAX_STREAMS = 50; // Maximum number of streams to keep
const STREAM_TIMEOUT = 3600000; // Auto-remove streams older than 1 hour (in ms)
const PROGRESS_CLEANUP_TIMEOUT = 300000; // Cleanup download progress after 5 minutes

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
        const url = details.url;
        // Only detect m3u8 files, and prefer master playlists
        if (url.includes('.m3u8') && !url.includes('.ts')) {
            // Skip chunklist and segment-specific playlists
            if (url.includes('chunklist') || url.includes('/media_') || url.match(/\d+\.m3u8$/)) {
                console.log('Skipping segment playlist:', url);
                return;
            }
            detectHLSStream(details);
        }
    },
    { urls: ["<all_urls>"] }
);

// Detect and store HLS stream
async function detectHLSStream(details) {
    const url = details.url;
    const tabId = details.tabId;

    // Create a fingerprint for deduplication
    const urlFingerprint = getUrlFingerprint(url);

    // Check if we've already detected this stream (or a very similar one)
    if (detectedUrls.has(urlFingerprint)) {
        console.log('Duplicate stream detected, ignoring:', url);
        return;
    }

    // Check if this is a duplicate based on existing streams
    for (const existingStream of Object.values(detectedStreams)) {
        if (isSimilarUrl(existingStream.url, url)) {
            console.log('Similar stream already exists, ignoring:', url);
            return;
        }
    }

    // Mark this URL as detected
    detectedUrls.add(urlFingerprint);

    const streamId = generateStreamId();

    // Get tab info
    try {
        const tab = await chrome.tabs.get(tabId);

        const stream = {
            id: streamId,
            url: url,
            tabUrl: tab.url,
            tabTitle: tab.title,
            timestamp: Date.now(),
            status: 'detected',
            qualities: [],
            fingerprint: urlFingerprint
        };

        // Store stream
        detectedStreams[streamId] = stream;

        // Parse playlist to get qualities
        parsePlaylist(streamId, url);

        // Memory optimization: Enforce stream limit
        enforceStreamLimit();

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
            stream.isMaster = true;

            // Remove any duplicate media playlists from the same source
            removeDuplicateMediaPlaylists(url);
        } else {
            // Media playlist (single quality)
            // Check if there's already a master playlist for this video
            const hasMaster = Object.values(detectedStreams).some(s =>
                s.isMaster && s.id !== streamId && isSimilarUrl(s.url, url)
            );

            if (hasMaster) {
                // Don't keep this media playlist, we have the master
                delete detectedStreams[streamId];
                detectedUrls.delete(stream.fingerprint);
                console.log('Removed media playlist, master exists:', url);
                return;
            }

            stream.qualities = [{
                resolution: 'Unknown',
                bandwidth: 0,
                url: url,
                type: 'media'
            }];
            stream.type = 'media';
            stream.isMaster = false;
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

// Remove duplicate media playlists when we find a master
function removeDuplicateMediaPlaylists(masterUrl) {
    const toRemove = [];

    for (const [id, stream] of Object.entries(detectedStreams)) {
        if (!stream.isMaster && isSimilarUrl(stream.url, masterUrl)) {
            toRemove.push(id);
        }
    }

    toRemove.forEach(id => {
        const stream = detectedStreams[id];
        detectedUrls.delete(stream.fingerprint);
        delete detectedStreams[id];
    });

    if (toRemove.length > 0) {
        console.log(`Removed ${toRemove.length} media playlists, master found`);
        chrome.storage.local.set({ streams: detectedStreams });
        chrome.action.setBadgeText({ text: Object.keys(detectedStreams).length.toString() });
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

// Get URL fingerprint for deduplication
function getUrlFingerprint(url) {
    try {
        const urlObj = new URL(url);
        // Use pathname without query params and file extensions for fingerprint
        let path = urlObj.pathname;

        // Remove common HLS file patterns that change frequently
        path = path.replace(/\/chunklist.*\.m3u8.*$/, '/playlist.m3u8');
        path = path.replace(/\/media_.*\.m3u8.*$/, '/media.m3u8');
        path = path.replace(/\/\d+\.m3u8/, '/index.m3u8');
        path = path.replace(/\/[a-z0-9]+_\d+\.m3u8/i, '/quality.m3u8');

        return urlObj.origin + path;
    } catch (e) {
        return url;
    }
}

// Check if two URLs are similar (same video, different quality/chunk)
function isSimilarUrl(url1, url2) {
    const fingerprint1 = getUrlFingerprint(url1);
    const fingerprint2 = getUrlFingerprint(url2);
    return fingerprint1 === fingerprint2;
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
        detectedUrls.clear(); // Clear URL fingerprints too
        chrome.storage.local.set({ streams: {} });
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ success: true });
    } else if (message.type === 'GET_PROGRESS') {
        sendResponse({ progress: downloadProgress[message.streamId] || {} });
    }

    return true; // Keep channel open for async response
});

// Download HLS stream with memory optimization
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

        // Memory optimization: Process segments in batches
        const BATCH_SIZE = 10; // Process 10 segments at a time
        const allSegmentData = [];

        for (let batchStart = 0; batchStart < segments.length; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, segments.length);
            const batchSegments = segments.slice(batchStart, batchEnd);

            // Download batch
            const batchPromises = batchSegments.map(async (segmentUrl) => {
                try {
                    const segmentResponse = await fetch(segmentUrl);
                    const arrayBuffer = await segmentResponse.arrayBuffer();
                    return new Uint8Array(arrayBuffer);
                } catch (error) {
                    console.error('Error downloading segment:', error);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);

            // Filter out failed downloads and add to collection
            batchResults.forEach(result => {
                if (result) {
                    allSegmentData.push(result);
                }
            });

            // Update progress
            downloadProgress[streamId].downloaded = batchEnd;
            downloadProgress[streamId].progress = Math.round((batchEnd / segments.length) * 100);

            // Notify popup of progress
            chrome.runtime.sendMessage({
                type: 'DOWNLOAD_PROGRESS',
                streamId: streamId,
                progress: downloadProgress[streamId]
            }).catch(() => { });
        }

        // Import mux.js for proper TS to MP4 conversion
        try {
            importScripts('mux.js');
        } catch (e) {
            console.warn('mux.js not loaded, will use simple concatenation');
        }

        // Convert TS segments to MP4 using mux.js
        if (typeof muxjs !== 'undefined') {
            // Proper remuxing with mux.js
            const transmuxer = new muxjs.mp4.Transmuxer();
            const mp4Segments = [];

            transmuxer.on('data', (segment) => {
                // Combine initialization segment and data
                const data = new Uint8Array(segment.initSegment.byteLength + segment.data.byteLength);
                data.set(segment.initSegment, 0);
                data.set(segment.data, segment.initSegment.byteLength);
                mp4Segments.push(data);
            });

            transmuxer.on('done', () => {
                // Memory optimization: Create blob and use object URL instead of base64
                const mergedBlob = new Blob(mp4Segments, { type: 'video/mp4' });
                const objectUrl = URL.createObjectURL(mergedBlob);
                const filename = `${stream.tabTitle || 'video'}_${quality.resolution}.mp4`;

                chrome.downloads.download({
                    url: objectUrl,
                    filename: sanitizeFilename(filename),
                    saveAs: true
                }, (downloadId) => {
                    if (downloadId) {
                        downloadProgress[streamId].status = 'completed';
                        chrome.runtime.sendMessage({
                            type: 'DOWNLOAD_COMPLETED',
                            streamId: streamId
                        }).catch(() => { });

                        // Memory optimization: Cleanup after download starts
                        setTimeout(() => {
                            URL.revokeObjectURL(objectUrl);
                            cleanupDownloadProgress(streamId);
                        }, 5000);
                    }
                });

                // Memory optimization: Clear segment arrays immediately
                mp4Segments.length = 0;
                allSegmentData.length = 0;
            });

            // Feed TS segments to transmuxer
            for (const segment of allSegmentData) {
                transmuxer.push(segment);
            }
            transmuxer.flush();

        } else {
            // Fallback: simple concatenation as TS
            // Memory optimization: Use object URL instead of base64
            const mergedBlob = new Blob(allSegmentData, { type: 'video/mp2t' });
            const objectUrl = URL.createObjectURL(mergedBlob);
            const filename = `${stream.tabTitle || 'video'}_${quality.resolution}.ts`;

            chrome.downloads.download({
                url: objectUrl,
                filename: sanitizeFilename(filename),
                saveAs: true
            }, (downloadId) => {
                if (downloadId) {
                    downloadProgress[streamId].status = 'completed';
                    chrome.runtime.sendMessage({
                        type: 'DOWNLOAD_COMPLETED',
                        streamId: streamId
                    }).catch(() => { });

                    // Memory optimization: Cleanup after download starts
                    setTimeout(() => {
                        URL.revokeObjectURL(objectUrl);
                        cleanupDownloadProgress(streamId);
                    }, 5000);
                }
            });

            // Memory optimization: Clear segment array
            allSegmentData.length = 0;
        }

    } catch (error) {
        console.error('Error downloading stream:', error);
        downloadProgress[streamId].status = 'error';
        downloadProgress[streamId].error = error.message;

        chrome.runtime.sendMessage({
            type: 'DOWNLOAD_ERROR',
            streamId: streamId,
            error: error.message
        }).catch(() => { });

        // Memory optimization: Cleanup on error
        cleanupDownloadProgress(streamId);
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

// Memory optimization: Cleanup download progress
function cleanupDownloadProgress(streamId) {
    if (downloadProgress[streamId]) {
        delete downloadProgress[streamId];
        console.log('Cleaned up download progress for:', streamId);
    }
}

// Memory optimization: Enforce max stream limit
function enforceStreamLimit() {
    const streamIds = Object.keys(detectedStreams);

    if (streamIds.length > MAX_STREAMS) {
        // Sort by timestamp (oldest first)
        streamIds.sort((a, b) => {
            return detectedStreams[a].timestamp - detectedStreams[b].timestamp;
        });

        // Remove oldest streams
        const toRemove = streamIds.slice(0, streamIds.length - MAX_STREAMS);
        toRemove.forEach(id => {
            const stream = detectedStreams[id];
            if (stream) {
                detectedUrls.delete(stream.fingerprint);
            }
            delete detectedStreams[id];
        });

        console.log(`Removed ${toRemove.length} old streams (limit: ${MAX_STREAMS})`);

        // Update storage and badge
        chrome.storage.local.set({ streams: detectedStreams });
        chrome.action.setBadgeText({ text: Object.keys(detectedStreams).length.toString() });
    }
}

// Memory optimization: Remove old streams (older than STREAM_TIMEOUT)
function removeOldStreams() {
    const now = Date.now();
    const toRemove = [];

    for (const [id, stream] of Object.entries(detectedStreams)) {
        if (now - stream.timestamp > STREAM_TIMEOUT) {
            toRemove.push(id);
        }
    }

    toRemove.forEach(id => {
        const stream = detectedStreams[id];
        if (stream) {
            detectedUrls.delete(stream.fingerprint);
        }
        delete detectedStreams[id];
    });

    if (toRemove.length > 0) {
        console.log(`Removed ${toRemove.length} expired streams`);
        chrome.storage.local.set({ streams: detectedStreams });
        chrome.action.setBadgeText({
            text: Object.keys(detectedStreams).length > 0 ? Object.keys(detectedStreams).length.toString() : ''
        });
    }
}

// Memory optimization: Periodic cleanup
setInterval(() => {
    removeOldStreams();

    // Cleanup stale download progress
    const now = Date.now();
    for (const [streamId, progress] of Object.entries(downloadProgress)) {
        if (progress.status === 'completed' || progress.status === 'error') {
            // If completed/errored more than 5 minutes ago, cleanup
            if (!progress.completedTime) {
                progress.completedTime = now;
            } else if (now - progress.completedTime > PROGRESS_CLEANUP_TIMEOUT) {
                cleanupDownloadProgress(streamId);
            }
        }
    }
}, 60000); // Run every minute
