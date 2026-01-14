// HLS Video Downloader - Content Script
// Optimized for minimal memory consumption

(function () {
    'use strict';

    // Memory optimization: Track sent URLs to prevent duplicate messages
    const recentlySentUrls = new Set();
    const URL_CACHE_TIMEOUT = 5000; // Clear URL from cache after 5 seconds

    // Memory optimization: Debounce timer for video monitoring
    let monitorDebounceTimer = null;
    const MONITOR_DEBOUNCE_DELAY = 300;

    // Memory optimization: Limit active notifications
    const MAX_NOTIFICATIONS = 2;
    const activeNotifications = [];

    // Memory optimization: Reusable style tag
    let styleElement = null;

    // Helper: Send message with deduplication
    function sendHLSMessage(url, source) {
        if (!url || recentlySentUrls.has(url)) {
            return; // Skip duplicate
        }

        recentlySentUrls.add(url);

        chrome.runtime.sendMessage({
            type: 'HLS_DETECTED',
            url: url,
            source: source
        }).catch(() => { });

        // Clear from cache after timeout
        setTimeout(() => {
            recentlySentUrls.delete(url);
        }, URL_CACHE_TIMEOUT);
    }

    // Override fetch to detect HLS requests
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        const url = args[0];

        if (typeof url === 'string' && url.includes('.m3u8')) {
            sendHLSMessage(url, 'fetch');
        }

        return originalFetch.apply(this, args);
    };

    // Override XMLHttpRequest to detect HLS requests
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        if (typeof url === 'string' && url.includes('.m3u8')) {
            sendHLSMessage(url, 'xhr');
        }

        return originalOpen.call(this, method, url, ...rest);
    };

    // Monitor video elements (debounced)
    function monitorVideoElements() {
        const videos = document.getElementsByTagName('video');

        for (const video of videos) {
            // Check if video has HLS source
            const src = video.src || video.currentSrc;
            if (src && src.includes('.m3u8')) {
                sendHLSMessage(src, 'video-element');
            }

            // Check source elements
            const sources = video.getElementsByTagName('source');
            for (const source of sources) {
                const srcUrl = source.src;
                if (srcUrl && srcUrl.includes('.m3u8')) {
                    sendHLSMessage(srcUrl, 'source-element');
                }
            }
        }
    }

    // Debounced monitor function
    function debouncedMonitor() {
        if (monitorDebounceTimer) {
            clearTimeout(monitorDebounceTimer);
        }
        monitorDebounceTimer = setTimeout(monitorVideoElements, MONITOR_DEBOUNCE_DELAY);
    }

    // Initial scan
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', monitorVideoElements);
    } else {
        monitorVideoElements();
    }

    // Monitor for dynamically added videos (debounced)
    const observer = new MutationObserver(debouncedMonitor);

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Show notification when stream is detected
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'STREAM_DETECTED') {
            showNotification('HLS Stream Detected!');
        }
    });

    function showNotification(text) {
        // Memory optimization: Remove oldest notification if limit reached
        if (activeNotifications.length >= MAX_NOTIFICATIONS) {
            const oldest = activeNotifications.shift();
            if (oldest && oldest.parentNode) {
                oldest.remove();
            }
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.textContent = text;
        notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
      z-index: 999999;
      animation: slideIn 0.3s ease-out;
    `;

        // Memory optimization: Reuse style element instead of creating new ones
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
            document.head.appendChild(styleElement);
        }

        document.body.appendChild(notification);
        activeNotifications.push(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
                const index = activeNotifications.indexOf(notification);
                if (index > -1) {
                    activeNotifications.splice(index, 1);
                }
            }, 300);
        }, 3000);
    }
})();
