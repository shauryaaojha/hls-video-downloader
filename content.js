// HLS Video Downloader - Content Script

// Monitor network requests for HLS streams
(function () {
    'use strict';

    // Override fetch to detect HLS requests
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        const url = args[0];

        if (typeof url === 'string' && url.includes('.m3u8')) {
            // Notify background about HLS stream
            chrome.runtime.sendMessage({
                type: 'HLS_DETECTED',
                url: url,
                source: 'fetch'
            }).catch(() => { });
        }

        return originalFetch.apply(this, args);
    };

    // Override XMLHttpRequest to detect HLS requests
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        if (typeof url === 'string' && url.includes('.m3u8')) {
            // Notify background about HLS stream
            chrome.runtime.sendMessage({
                type: 'HLS_DETECTED',
                url: url,
                source: 'xhr'
            }).catch(() => { });
        }

        return originalOpen.call(this, method, url, ...rest);
    };

    // Monitor video elements
    function monitorVideoElements() {
        const videos = document.getElementsByTagName('video');

        for (const video of videos) {
            // Check if video has HLS source
            const src = video.src || video.currentSrc;
            if (src && src.includes('.m3u8')) {
                chrome.runtime.sendMessage({
                    type: 'HLS_DETECTED',
                    url: src,
                    source: 'video-element'
                }).catch(() => { });
            }

            // Check source elements
            const sources = video.getElementsByTagName('source');
            for (const source of sources) {
                const srcUrl = source.src;
                if (srcUrl && srcUrl.includes('.m3u8')) {
                    chrome.runtime.sendMessage({
                        type: 'HLS_DETECTED',
                        url: srcUrl,
                        source: 'source-element'
                    }).catch(() => { });
                }
            }
        }
    }

    // Initial scan
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', monitorVideoElements);
    } else {
        monitorVideoElements();
    }

    // Monitor for dynamically added videos
    const observer = new MutationObserver(() => {
        monitorVideoElements();
    });

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

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
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
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
})();
