// HLS Video Downloader - Options Page Script

// Default settings
const defaultSettings = {
    defaultQuality: 'best',
    concurrentDownloads: 3,
    autoDownload: false,
    showNotifications: true
};

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveSettings);

    // Clear history button
    document.getElementById('clearHistory').addEventListener('click', clearHistory);

    // Auto-save on change
    document.getElementById('defaultQuality').addEventListener('change', autoSave);
    document.getElementById('concurrentDownloads').addEventListener('change', autoSave);
    document.getElementById('autoDownload').addEventListener('change', autoSave);
    document.getElementById('showNotifications').addEventListener('change', autoSave);
}

// Load settings from storage
function loadSettings() {
    chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || defaultSettings;

        // Populate form fields
        document.getElementById('defaultQuality').value = settings.defaultQuality || defaultSettings.defaultQuality;
        document.getElementById('concurrentDownloads').value = settings.concurrentDownloads || defaultSettings.concurrentDownloads;
        document.getElementById('autoDownload').checked = settings.autoDownload || false;
        document.getElementById('showNotifications').checked = settings.showNotifications !== false;
    });
}

// Save settings to storage
function saveSettings() {
    const settings = {
        defaultQuality: document.getElementById('defaultQuality').value,
        concurrentDownloads: parseInt(document.getElementById('concurrentDownloads').value),
        autoDownload: document.getElementById('autoDownload').checked,
        showNotifications: document.getElementById('showNotifications').checked
    };

    chrome.storage.local.set({ settings }, () => {
        showSaveStatus('saved');
    });
}

// Auto-save on change
function autoSave() {
    showSaveStatus('saving');
    setTimeout(saveSettings, 500);
}

// Show save status
function showSaveStatus(status) {
    const saveStatus = document.getElementById('saveStatus');

    if (status === 'saving') {
        saveStatus.textContent = 'Saving...';
        saveStatus.className = 'save-status saving';
    } else if (status === 'saved') {
        saveStatus.textContent = '✓ Settings saved';
        saveStatus.className = 'save-status saved';

        // Reset after 2 seconds
        setTimeout(() => {
            saveStatus.textContent = 'Settings auto-saved';
            saveStatus.className = 'save-status';
        }, 2000);
    }
}

// Clear history
function clearHistory() {
    if (confirm('Are you sure you want to clear all stream history?')) {
        chrome.runtime.sendMessage({ type: 'CLEAR_STREAMS' }, () => {
            // Show confirmation
            const saveStatus = document.getElementById('saveStatus');
            saveStatus.textContent = '✓ History cleared';
            saveStatus.className = 'save-status saved';

            setTimeout(() => {
                saveStatus.textContent = 'Settings auto-saved';
                saveStatus.className = 'save-status';
            }, 2000);
        });
    }
}
