# ⚡ OmniMedia Pro - Multi-Platform Bulk Media Downloader (NEXUS Edition)

An ultra-modern, high-performance desktop application for downloading videos, Shorts, audio, and entire channels in bulk from **YouTube, TikTok, Instagram, and Facebook** with **GPU-accelerated Glassmorphism UI**, **yt-dlp**, and bundled **FFmpeg v7.1**.

---

## 🎨 Modern UI Design (Discord / Vercel Aesthetic)
- **Glassmorphism & Neon Glow**: Deep canvas with specular highlights, glowing borders, and vibrant gradient accents.
- **Left Sidebar Navigation**: Fast 1-click tab switching between Single Downloader, Channel Scraper, Batch URLs, Queue, Download History, and Settings.
- **Hardware-Accelerated Web Engine**: Renders natively using Windows Edge WebView2 runtime (60+ FPS, in-place smart DOM reconciliation, zero UI stutter).
- **Native OS Dialogs**: Replaces legacy dialogs with 100% native Windows folder and file pickers via PyWebView.

---

## 🌟 Core Features & Enhancements

### 1. 📺 Channel & Profile Bulk Scraper
- Enter any YouTube Channel URL (e.g. `https://www.youtube.com/@ChannelName`), Playlist, or TikTok/Instagram profile.
- **Filter Tabs**:
  - `Both (Videos & Shorts)`
  - `Videos Only`
  - `Shorts Only`
- **Interactive Multi-Select Table**:
  - `Select All` / `Deselect All` / `Only Shorts` / `Only Videos`
  - Checkbox per item for custom cherry-picking
  - Live title search filter & badge indicators
  - Automatic duplicate checker to avoid re-downloading existing media!

### 2. 🎯 Single Media Downloader
- Inspect any URL to preview the **16:9 High-Res Thumbnail**, Title, Channel/Creator, Duration badge, and Content Type.
- Quality picker: Best Available (up to 4K/8K 60FPS), 1440p, 1080p, 720p, 480p, or Audio Only (Lossless MP3 320kbps / M4A).
- Extract Direct Stream Links for external downloaders (IDM, VLC, Browser).

### 3. 📋 Batch URLs List
- Paste multiple links directly (one per line) or import from `.txt` files with 1-click deduplication.

### 4. 🚀 Queue & Download Manager
- Background multi-threaded engine with thread-safe Pause/Resume and Cancel controls.
- Adaptive Polling: dynamically throttles CPU usage when queue is idle.
- Real-time download progress bar with:
  - Live Download Speed (`MB/s`)
  - ETA Timer
  - Downloaded bytes / Total bytes
  - Percentage
- "Show in Folder" button to locate individual completed files instantly.

### 5. 🗄️ Download History Vault
- Automatic persistent record of all completed downloads saved in local profile.
- Search and filter past downloads by title, platform, or format.
- Open file location or remove records with a single click.

### 6. ✂️ Video Section Trimmer (NEW)
- Download only a specific time section of long videos/podcasts (e.g. `05:30` to `12:45`) without downloading the entire file.
- Keyframe-accurate trimming powered by yt-dlp and FFmpeg.

### 7. 📋 Smart Clipboard Sniffer (NEW)
- Real-time clipboard watcher that auto-detects copied media links from YouTube, TikTok, Instagram, and Facebook.
- Sleek floating banner gives 1-click options to **Inspect & Preview** or **Quick Add to Queue** without manual pasting.

### 8. ⚡ Auto-Shutdown PC on Queue Completion (NEW)
- Leave long overnight batch downloads without worry.
- Automatically initiates Windows PC shutdown with a 60-second cancelable countdown modal when all queue jobs are finished.

### 9. 🖼️ Save HD Thumbnail Asset (NEW)
- Dedicated 1-click button on single inspection cards to save original max-resolution cover images directly to disk.

### 10. 📁 Smart Channel & Creator Sub-Folders (NEW)
- Automatically creates dedicated sub-folders per channel/creator (e.g. `Downloads/OmniMedia_Downloads/CreatorName/`) to keep massive media libraries neatly organized.

### 11. 🎵 Lossless & Hi-Res Audio Suite (NEW)
- Expanded audio codecs: **FLAC Lossless**, **WAV Uncompressed**, **AAC 256k**, **Lossless MP3 320k**, and **M4A**.

### 12. 🔄 In-App 1-Click yt-dlp Engine Updater (NEW)
- Update yt-dlp to the latest upstream release directly inside Settings with 1 click to maintain compatibility against YouTube player algorithm updates.

### 13. 🔐 Zero-Config FFmpeg & Secure Credential Vault (NEW)
- Automatically bundles FFmpeg v7.1 via `imageio-ffmpeg` — no Windows PATH setup required!
- In-App YouTube Login & 1-click Chrome Extension cookie sync to unlock age-restricted, members-only, and 4K/8K 60FPS videos.
- Credentials and session cookies are securely isolated in `%LOCALAPPDATA%`, preventing accidental git or archive leaks.

---

## 🚀 How to Run

### Method 1: Double-Click Launcher
Double-click **`run.bat`** in this folder.

### Method 2: Command Line
```powershell
python main.py
```

---

## 🔨 How to Build Standalone `.exe`
Run:
```powershell
python build_exe.py
```
Your portable standalone executable will be generated in `dist/OmniMedia_Pro.exe`.
This single file bundles the entire Python runtime, WebView2 integration, yt-dlp, FFmpeg v7.1, and all assets so you can share it directly with anyone.
