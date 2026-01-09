# Changelog

## Version 1.0.4 - 2026-01-09

### 🐛 Critical Fix
- **Fixed Playback Gaps**: Reverted to `.ts` output format to prevent audio/video breaks
  - TS segments are designed to be concatenatable without gaps
  - MP4 requires proper remuxing (mux.js) which browser can't do efficiently
  - Simple concatenation + MP4 label caused timing issues (PTS/DTS problems)

### 📝 Documentation
- Added FFmpeg conversion guide in README
- Explained why TS format is used
- Command for MP4 conversion: `ffmpeg -i video.ts -c copy video.mp4`

### 🎯 Technical Details
- Blob MIME type: `video/mp4` → `video/mp2t` (reverted)
- File extension: `.mp4` → `.ts` (reverted)
- Added comments explaining TS format choice

**Result**: Seamless playback without gaps! Use FFmpeg for MP4 if needed.

---


## Version 1.0.3 - 2026-01-09

### ✨ Major Features
- **MP4 Output**: Downloads now save as `.mp4` instead of `.ts` for universal player compatibility
- **Master Playlist Only**: Automatically skips segment-specific playlists (chunklist, media_*, numbered playlists)
- **Better Detection**: Enhanced filtering to show only complete videos, not individual segments

### 🔧 Technical Changes
- Skip URLs containing `chunklist`, `/media_*`, or `[number].m3u8` patterns
- Changed blob MIME type from `video/mp2t` to `video/mp4`
- Improved URL fingerprinting with more pattern matching
- Filter at web request level for better performance

**Result**: Clean master playlist detection + MP4 files that play everywhere! 🎬

---


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
