# HLS Video Downloader

A powerful Chrome/Edge browser extension for detecting and downloading HLS (.m3u8) video streams with a premium, modern UI.

## ✨ Features

- **🎯 Automatic HLS Detection** - Automatically detects HLS streams (.m3u8) on any webpage
- **📊 Multiple Quality Options** - Choose from all available quality variants
- **⚡ Fast Downloads** - Parallel segment downloading for maximum speed
- **🎨 Premium UI** - Beautiful dark mode interface with glassmorphism effects
- **📦 Segment Merging** - Automatically merges TS segments into a single file
- **⚙️ Customizable Settings** - Configure default quality, concurrent downloads, and more
- **🔔 Real-time Notifications** - Get notified when new streams are detected
- **📈 Progress Tracking** - Monitor download progress in real-time

## 🚀 Installation

### From Source (Developer Mode)

1. **Download the extension**
   - Download or clone this repository to your computer

2. **Open Chrome/Edge Extensions**
   - Navigate to `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
   - Enable **Developer mode** (toggle in top-right corner)

3. **Load the extension**
   - Click **Load unpacked**
   - Select the `hls_downloader` folder
   - The extension icon should appear in your browser toolbar

## 📖 Usage

1. **Navigate to a video page**
   - Visit any website with HLS video streams
   - The extension will automatically detect .m3u8 files

2. **View detected streams**
   - Click the extension icon in your toolbar
   - All detected streams appear in the popup

3. **Select quality & download**
   - Choose your preferred quality from available options
   - Click the **Download** button
   - Monitor progress in real-time

4. **Manage downloads**
   - Downloads appear in your browser's download manager
   - Files are saved as `.ts` format (compatible with most video players)

## ⚙️ Settings

Access settings by clicking the gear icon in the popup or right-clicking the extension icon and selecting "Options".

- **Default Quality** - Set preferred video quality (Best, 1080p, 720p, etc.)
- **Concurrent Downloads** - Number of segments to download simultaneously (1-10)
- **Auto Download** - Automatically start downloads when streams are detected
- **Show Notifications** - Toggle in-page notifications for stream detection

## 🎨 UI Screenshots

The extension features a premium dark mode interface with:
- Glassmorphism effects
- Vibrant purple-to-indigo gradients
- Smooth animations and transitions
- Responsive design

## 🛠️ Technical Details

### Architecture
- **Manifest V3** - Latest Chrome extension standard
- **Service Worker** - Background processing for stream detection
- **Content Scripts** - In-page monitoring of network requests
- **Chrome Storage API** - Settings and stream persistence

### HLS Processing
1. Detects .m3u8 playlist files via web request monitoring
2. Parses master playlists to extract quality variants
3. Downloads media playlists to get segment lists
4. Fetches TS segments in parallel
5. Merges segments into single file
6. Triggers browser download

## ⚠️ Known Limitations

- **CORS Restrictions** - Some streams with strict CORS policies may not be downloadable
- **DRM Protected Content** - Encrypted/DRM-protected streams are not supported
- **Browser Support** - Designed for Chromium-based browsers (Chrome, Edge, Brave)
- **File Format** - Downloads are in `.ts` format (widely compatible but may need conversion for some uses)

## 🔧 Development

### File Structure
```
hls_downloader/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for HLS detection
├── content.js            # Content script for page monitoring
├── popup.html            # Popup interface
├── popup.css             # Popup styles
├── popup.js              # Popup logic
├── options.html          # Settings page
├── options.css           # Settings styles
├── options.js            # Settings logic
├── icons/                # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md             # This file
```

### Testing
1. Load extension in developer mode
2. Navigate to HLS test streams (e.g., https://test-streams.mux.dev/)
3. Verify stream detection
4. Test download functionality
5. Check console for errors

## 📝 License

This project is provided as-is for educational and personal use.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 💡 Tips

- For best results, use on sites with non-DRM protected HLS streams
- Higher concurrent downloads = faster but more resource intensive
- Some video players can play `.ts` files directly (VLC, MPV, etc.)
- For MP4 conversion, use tools like FFmpeg

## 🐛 Troubleshooting

**Extension not detecting streams?**
- Refresh the page after installing the extension
- Check if the site uses HLS (look for .m3u8 in Network tab)
- Some sites load streams dynamically - wait for video to start playing

**Download fails or incomplete?**
- Check browser console for errors
- Verify you have write permissions
- Try a different quality option
- Check if stream has CORS restrictions

**UI not loading correctly?**
- Clear browser cache
- Reload the extension
- Check browser console for errors

## 📞 Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Made with ❤️ for the open web**
