# Changelog

## Version 1.0.2 - 2026-01-09

### 🎯 Major Improvement
- **Smart Deduplication**: Fixed issue where 100+ duplicate streams were detected
  - Implemented URL fingerprinting to identify unique videos
  - Only show master playlists when available
  - Automatically remove duplicate media playlists
  - Filter out repeated playlist fetches during video playback

### 🔧 Technical Changes
- Added `getUrlFingerprint()` function for URL comparison
- Added `isSimilarUrl()` for detecting duplicate streams
- Added `removeDuplicateMediaPlaylists()` to clean up redundant entries
- Track detected URLs with `Set` for fast lookup
- Prefer master playlists over individual quality variants

**Result**: Now shows **1 stream per video** instead of 100+

---


## Version 1.0.1 - 2026-01-09

### 🐛 Bug Fixes
- **Critical Fix**: Replaced `URL.createObjectURL()` with `FileReader` for blob conversion
  - `URL.createObjectURL()` is not available in Manifest V3 service worker context
  - Downloads now use base64 data URLs instead
  - Fixes "URL.createObjectURL is not a function" error

### 🔧 Technical Changes
- Refactored `downloadStream()` function in `background.js`
- Added `FileReader.readAsDataURL()` for blob-to-base64 conversion
- Improved error handling in segment download loop

---

## Version 1.0.0 - 2026-01-09

### ✨ Initial Release

**Features:**
- 🎯 Automatic HLS stream detection (.m3u8 files)
- 📊 Multiple quality variant selection
- ⚡ Parallel segment downloading
- 📈 Real-time download progress tracking
- 🎨 Premium dark mode UI with glassmorphism
- ⚙️ Customizable settings (quality, concurrent downloads, auto-download)
- 🔔 In-page notifications for stream detection
- 📦 Automatic segment merging

**Architecture:**
- Manifest V3 compliant
- Service worker for background processing
- Content scripts for page monitoring
- Chrome Storage API for persistence
- Web Request API for stream detection

**UI Components:**
- Modern popup interface
- Settings/options page
- Progress indicators
- Quality selector
- Empty state handling

**Documentation:**
- Complete README with installation guide
- TESTING.md with test procedures
- QUICKSTART.md for immediate use
- Detailed walkthrough artifact

**Browser Support:**
- Chrome ✅
- Edge ✅
- Brave ✅
- Firefox ❌ (Manifest V3 differences)

**File Size:** ~65KB total
**Lines of Code:** ~800+ lines
