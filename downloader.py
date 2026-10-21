"""
Professional Multi-Platform Download Engine for YouTube, TikTok, Instagram, and Facebook.
Features concurrent multi-threading, individual item pause/resume/remove/open-folder actions.
"""

import os
import re
import time
import queue
import threading
from typing import Dict, Any, Callable, Optional, List
import sys
import shutil
import json
import yt_dlp
import imageio_ffmpeg
from cookie_manager import get_safe_cookie_file

class HistoryManager:
    """Persistent download history manager stored in user AppData profile."""
    def __init__(self, history_file: Optional[str] = None):
        if not history_file:
            profile_dir = os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'OmniMediaPro_WebProfile')
            history_file = os.path.join(profile_dir, 'download_history.json')
        self.history_file = history_file
        self._lock = threading.Lock()
        try:
            os.makedirs(os.path.dirname(self.history_file), exist_ok=True)
        except Exception:
            pass

    def load_history(self) -> List[Dict[str, Any]]:
        with self._lock:
            if not os.path.exists(self.history_file):
                return []
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return []

    def add_entry(self, item: 'DownloadItem'):
        with self._lock:
            entries = []
            if os.path.exists(self.history_file):
                try:
                    with open(self.history_file, 'r', encoding='utf-8') as f:
                        entries = json.load(f)
                except Exception:
                    entries = []

            # Avoid duplicates if re-downloaded
            entries = [e for e in entries if e.get("url") != item.url]

            new_entry = {
                "id": f"hist_{int(time.time() * 1000)}",
                "title": item.title or item.url,
                "url": item.url,
                "platform": item.platform,
                "thumbnail": item.thumbnail or "assets/OmniMedia.png",
                "duration_str": item.duration_str,
                "quality": item.quality_label,
                "size": item.total_str if item.total_str != "0 B" else item.downloaded_str,
                "filepath": item.final_filepath,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            entries.insert(0, new_entry)
            entries = entries[:500]  # Store last 500 records
            try:
                with open(self.history_file, 'w', encoding='utf-8') as f:
                    json.dump(entries, f, indent=2, ensure_ascii=False)
            except Exception:
                pass

    def delete_entry(self, entry_id: str) -> bool:
        with self._lock:
            if not os.path.exists(self.history_file):
                return False
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    entries = json.load(f)
                filtered = [e for e in entries if e.get("id") != entry_id]
                with open(self.history_file, 'w', encoding='utf-8') as f:
                    json.dump(filtered, f, indent=2, ensure_ascii=False)
                return True
            except Exception:
                return False

    def clear_history(self) -> bool:
        with self._lock:
            try:
                with open(self.history_file, 'w', encoding='utf-8') as f:
                    json.dump([], f)
                return True
            except Exception:
                return False

def get_ffmpeg_path() -> Optional[str]:
    """Retrieve bundled ffmpeg path, supporting PyInstaller onefile bundles."""
    if hasattr(sys, '_MEIPASS'):
        meipass = getattr(sys, '_MEIPASS')
        for cand in [
            os.path.join(meipass, "ffmpeg.exe"),
            os.path.join(meipass, "imageio_ffmpeg", "binaries", "ffmpeg-win64-v4.2.2.exe"),
        ]:
            if os.path.exists(cand):
                return cand
        bin_dir = os.path.join(meipass, "imageio_ffmpeg", "binaries")
        if os.path.isdir(bin_dir):
            for fname in os.listdir(bin_dir):
                if "ffmpeg" in fname.lower() and fname.endswith(".exe"):
                    return os.path.join(bin_dir, fname)

    try:
        path = imageio_ffmpeg.get_ffmpeg_exe()
        if os.path.exists(path):
            return path
    except Exception:
        pass

    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    return None

def get_bundled_thumbnail_path() -> str:
    """Resolve project-bundled OmniMedia.png asset path."""
    base_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    cand1 = os.path.join(base_dir, "assets", "OmniMedia.png")
    if os.path.exists(cand1):
        return cand1
    cand2 = os.path.join(base_dir, "web", "assets", "OmniMedia.png")
    if os.path.exists(cand2):
        return cand2
    return ""

def is_playlist_url(url: str) -> bool:
    """Check if given URL points to a playlist feed."""
    clean = (url or "").strip().lower()
    return 'list=' in clean or 'playlist' in clean

def detect_platform(url: str) -> str:
    """Identify content platform from URL."""
    u = url.lower()
    if 'tiktok.com' in u:
        return 'tiktok'
    elif 'instagram.com' in u:
        return 'instagram'
    elif 'facebook.com' in u or 'fb.watch' in u:
        return 'facebook'
    elif 'youtube.com' in u or 'youtu.be' in u:
        return 'youtube'
    return 'generic'

def format_duration(seconds: Optional[int]) -> str:
    if not seconds:
        return "00:00"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

def format_bytes(b: Optional[float]) -> str:
    if not b or b <= 0:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if b < 1024.0:
            return f"{b:.1f} {unit}"
        b /= 1024.0
    return f"{b:.1f} PB"

def format_eta(seconds: Optional[int]) -> str:
    if not seconds or seconds < 0:
        return "--:--"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}h {m}m"
    return f"{m:02d}:{s:02d}"

QUALITY_FORMAT_MAP = {
    "Best Available (Up to 4K/8K)": "bestvideo+bestaudio/best",
    "1080p (Full HD)": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "720p (HD)": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
    "480p": "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
    "Audio Only (Lossless MP3 320k)": "bestaudio/best",
    "Audio Only (M4A)": "bestaudio[ext=m4a]/bestaudio/best",
    "Audio Only (FLAC Lossless)": "bestaudio/best",
    "Audio Only (WAV)": "bestaudio/best",
    "Audio Only (AAC 256k)": "bestaudio/best"
}

class DownloadItem:
    def __init__(
        self,
        item_id: int,
        batch_id: str,
        batch_title: str,
        url: str,
        title: str,
        quality_label: str,
        output_dir: str,
        platform: str,
        thumbnail: str = "",
        is_short: bool = False,
        duration_str: str = "00:00",
        container_format: str = "mp4",
        download_subtitles: bool = False,
        subtitle_langs: str = "en,bn",
        embed_metadata: bool = True,
        rate_limit_bytes: int = 0,
        time_range: Optional[str] = None,
        organize_subfolders: bool = False,
        uploader: str = ""
    ):
        self.id = item_id
        self.batch_id = batch_id
        self.batch_title = batch_title or "Direct Downloads"
        self.url = url
        self.title = title
        self.quality_label = quality_label
        self.output_dir = output_dir
        self.platform = platform
        self.thumbnail = thumbnail
        self.is_short = is_short
        self.duration_str = duration_str
        self.container_format = container_format or "mp4"
        self.download_subtitles = download_subtitles
        self.subtitle_langs = subtitle_langs or "en,bn"
        self.embed_metadata = embed_metadata
        self.rate_limit_bytes = rate_limit_bytes
        self.time_range = time_range
        self.organize_subfolders = organize_subfolders
        self.uploader = uploader

        self.progress: float = 0.0
        self.speed_str: str = ""
        self.speed_bytes: float = 0.0
        self.eta_str: str = ""
        self.downloaded_str: str = "0 B"
        self.total_str: str = "0 B"
        self.status: str = "Queued"  # Queued, Downloading, Merging, Completed, Error, Cancelled, Paused
        self.error_msg: str = ""
        self.is_cancelled: bool = False
        self.is_paused: bool = False
        self.is_in_progress: bool = False
        self.final_filepath: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "batch_title": self.batch_title,
            "url": self.url,
            "title": self.title or self.url,
            "quality": self.quality_label,
            "platform": self.platform,
            "thumbnail": self.thumbnail,
            "is_short": self.is_short,
            "duration_str": self.duration_str,
            "progress": self.progress,
            "progress_pct": int(self.progress * 100),
            "speed": self.speed_str,
            "eta": self.eta_str,
            "downloaded": self.downloaded_str,
            "total": self.total_str,
            "status": self.status,
            "error": self.error_msg,
            "output_dir": self.output_dir,
            "container_format": self.container_format,
            "download_subtitles": self.download_subtitles,
            "time_range": self.time_range,
            "organize_subfolders": self.organize_subfolders,
            "uploader": self.uploader
        }

class DownloadManager:
    def __init__(self, max_concurrent: int = 3):
        self.items: List[DownloadItem] = []
        self._items_lock = threading.Lock()
        self._queue: queue.Queue = queue.Queue()
        self._next_id = 1
        self._is_running = True
        self._is_paused = False
        self.max_concurrent = max_concurrent
        self._workers: List[threading.Thread] = []

        self.ffmpeg_path = get_ffmpeg_path()
        self.log_callback: Optional[Callable[[str], None]] = None
        self.history_manager = HistoryManager()
        self._start_workers()

    def log(self, message: str):
        if self.log_callback:
            self.log_callback(message)

    def _start_workers(self):
        for i in range(self.max_concurrent):
            t = threading.Thread(target=self._worker_loop, daemon=True, name=f"DownloaderWorker-{i+1}")
            t.start()
            self._workers.append(t)

    def add_to_queue(
        self,
        url: str,
        title: str,
        quality_label: str,
        output_dir: str,
        batch_id: str = "batch_default",
        batch_title: str = "Direct Downloads",
        thumbnail: str = "",
        is_short: bool = False,
        duration_str: str = "00:00",
        container_format: str = "mp4",
        download_subtitles: bool = False,
        subtitle_langs: str = "en,bn",
        embed_metadata: bool = True,
        rate_limit_bytes: int = 0,
        time_range: Optional[str] = None,
        organize_subfolders: bool = False,
        uploader: str = ""
    ) -> DownloadItem:
        platform = detect_platform(url)
        with self._items_lock:
            item = DownloadItem(
                item_id=self._next_id,
                batch_id=batch_id,
                batch_title=batch_title,
                url=url,
                title=title,
                quality_label=quality_label,
                output_dir=output_dir,
                platform=platform,
                thumbnail=thumbnail,
                is_short=is_short,
                duration_str=duration_str,
                container_format=container_format,
                download_subtitles=download_subtitles,
                subtitle_langs=subtitle_langs,
                embed_metadata=embed_metadata,
                rate_limit_bytes=rate_limit_bytes,
                time_range=time_range,
                organize_subfolders=organize_subfolders,
                uploader=uploader
            )
            self._next_id += 1
            self.items.append(item)
            self._queue.put(item)
        return item

    def pause_queue(self, paused: bool):
        self._is_paused = paused
        self.log(f"Global queue {'paused' if paused else 'resumed'}.")

    def is_paused(self) -> bool:
        return self._is_paused

    def toggle_pause_item(self, item_id: int) -> bool:
        """Pause or resume an individual item safely without double-queuing."""
        with self._items_lock:
            for item in self.items:
                if item.id == item_id:
                    if item.status == "Downloading":
                        item.is_paused = True
                        item.status = "Paused"
                        self.log(f"Paused item #{item_id}: {item.title}")
                        return True
                    elif item.status == "Paused":
                        item.is_paused = False
                        if item.is_in_progress:
                            # Worker is sleeping in progress_hook loop; unpausing continues immediately
                            item.status = "Downloading"
                            self.log(f"Resumed active item #{item_id}: {item.title}")
                        else:
                            # Item was paused in queue before starting
                            item.status = "Queued"
                            self._queue.put(item)
                            self.log(f"Re-queued item #{item_id}: {item.title}")
                        return False
        return False

    def get_history(self) -> List[Dict[str, Any]]:
        entries = self.history_manager.load_history()
        for item in entries:
            fp = item.get("filepath")
            item["file_exists"] = bool(fp and os.path.exists(fp))
        return entries

    def delete_history_entry(self, entry_id: str) -> bool:
        return self.history_manager.delete_entry(entry_id)

    def clear_history(self) -> bool:
        return self.history_manager.clear_history()

    def cancel_item(self, item_id: int):
        with self._items_lock:
            for item in self.items:
                if item.id == item_id:
                    item.is_cancelled = True
                    item.status = "Cancelled"
                    item.error_msg = "Cancelled by user"
                    self.log(f"Item #{item_id} cancelled.")
                    break

    def remove_item(self, item_id: int):
        with self._items_lock:
            self.items = [it for it in self.items if it.id != item_id]
        self.log(f"Item #{item_id} removed from queue.")

    def retry_item(self, item_id: int):
        with self._items_lock:
            for item in self.items:
                if item.id == item_id:
                    item.is_cancelled = False
                    item.is_paused = False
                    item.status = "Queued"
                    item.progress = 0.0
                    item.error_msg = ""
                    self._queue.put(item)
                    self.log(f"Retrying item #{item_id}: {item.title}")
                    break

    def open_item_folder(self, item_id: int) -> bool:
        target_dir = None
        target_file = None
        with self._items_lock:
            for item in self.items:
                if item.id == item_id:
                    target_dir = item.output_dir
                    target_file = item.final_filepath
                    break
        if target_file and os.path.exists(target_file):
            try:
                import subprocess
                subprocess.Popen(f'explorer /select,"{os.path.normpath(target_file)}"')
                return True
            except Exception:
                pass
        if target_dir and os.path.exists(target_dir):
            try:
                os.startfile(target_dir)
                return True
            except Exception as e:
                self.log(f"Error opening folder: {e}")
        return False

    def cancel_batch(self, batch_id: str, clear_immediately: bool = False):
        if clear_immediately:
            self.remove_batch(batch_id)
            return
        with self._items_lock:
            for item in self.items:
                if item.batch_id == batch_id:
                    item.is_cancelled = True
                    if item.status in ["Queued", "Downloading", "Merging", "Paused"]:
                        item.status = "Cancelled"
                        item.error_msg = "Cancelled by user"
        self.log(f"Batch {batch_id} cancelled.")

    def remove_batch(self, batch_id: str):
        """Immediately stop and purge all items belonging to a batch."""
        with self._items_lock:
            for item in self.items:
                if item.batch_id == batch_id:
                    item.is_cancelled = True
            self.items = [it for it in self.items if it.batch_id != batch_id]
        self.log(f"Batch '{batch_id}' cancelled and cleared from queue.")

    def clear_completed(self):
        """Purge completed, cancelled, and errored items from the queue."""
        with self._items_lock:
            self.items = [it for it in self.items if it.status in ["Queued", "Downloading", "Merging", "Paused"]]
        self.log("Cleared finished, cancelled, and errored downloads from queue.")

    def check_existing(self, urls: List[str]) -> Dict[str, Any]:
        """Detect which URLs are already in queue or processed to prevent unwanted duplicates."""
        def normalize_url(u: str) -> str:
            u = u.strip()
            m = re.search(r'(?:v=|\/shorts\/|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})', u)
            if m:
                return f"yt:{m.group(1)}"
            return u.split('?')[0].rstrip('/')

        with self._items_lock:
            existing_map = {}
            for it in self.items:
                key = normalize_url(it.url)
                existing_map[key] = {
                    "id": it.id,
                    "title": it.title or it.url,
                    "status": it.status,
                    "url": it.url
                }

        duplicates = []
        clean_urls = []
        for u in urls:
            k = normalize_url(u)
            if k in existing_map:
                duplicates.append({
                    "url": u,
                    "existing": existing_map[k]
                })
            else:
                clean_urls.append(u)

        return {
            "has_duplicates": len(duplicates) > 0,
            "duplicate_count": len(duplicates),
            "duplicates": duplicates,
            "clean_urls": clean_urls
        }

    def _worker_loop(self):
        while self._is_running:
            if self._is_paused:
                time.sleep(0.4)
                continue

            try:
                item: DownloadItem = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue

            if item.is_cancelled or item.status == "Cancelled" or item.is_paused:
                self._queue.task_done()
                continue

            self._download_item(item)
            self._queue.task_done()

    def _download_item(self, item: DownloadItem):
        item.status = "Downloading"
        item.is_in_progress = True
        self.log(f"[Download Started] [{item.platform.upper()}] {item.title or item.url}")

        os.makedirs(item.output_dir, exist_ok=True)
        is_audio = "Audio" in item.quality_label

        streams_downloaded = {}
        streams_totals = {}

        def progress_hook(d):
            if item.is_cancelled:
                raise Exception("DOWNLOAD_CANCELLED_BY_USER")

            while item.is_paused:
                time.sleep(0.5)
                if item.is_cancelled:
                    raise Exception("DOWNLOAD_CANCELLED_BY_USER")

            if item.status == "Paused" and not item.is_paused:
                item.status = "Downloading"

            status = d.get('status')
            if status == 'downloading':
                item.status = "Downloading"
                stream_key = d.get('filename') or 'stream'
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                downloaded_bytes = d.get('downloaded_bytes') or 0
                speed = d.get('speed') or 0
                eta = d.get('eta')

                streams_downloaded[stream_key] = downloaded_bytes
                if total_bytes > 0:
                    streams_totals[stream_key] = total_bytes

                combined_downloaded = sum(streams_downloaded.values())
                combined_total = sum(streams_totals.values())

                if combined_total > 0:
                    item.progress = min(1.0, combined_downloaded / combined_total)
                elif d.get('_percent_str'):
                    try:
                        clean_pct = re.sub(r'\x1b\[[0-9;]*m', '', d['_percent_str']).strip().replace('%', '')
                        item.progress = min(1.0, float(clean_pct) / 100.0)
                    except Exception:
                        pass

                item.speed_bytes = speed
                item.speed_str = f"{format_bytes(speed)}/s" if speed else ""
                item.eta_str = format_eta(eta) if eta is not None else ""
                item.downloaded_str = format_bytes(combined_downloaded)
                item.total_str = format_bytes(combined_total) if combined_total > 0 else "Unknown"

            elif status == 'finished':
                item.status = "Merging"
                item.progress = 1.0
                item.speed_str = "Merging"
                item.eta_str = "--:--"

        def _finalize_item_file(ydl_obj, info_dict):
            final_file = None
            if info_dict:
                if not item.title and 'title' in info_dict:
                    item.title = info_dict['title']
                if not item.thumbnail and 'thumbnail' in info_dict:
                    item.thumbnail = info_dict['thumbnail']

                reqs = info_dict.get('requested_downloads')
                if reqs and len(reqs) > 0:
                    final_file = reqs[0].get('filepath')
                if not final_file:
                    final_file = info_dict.get('_filename')
                if not final_file:
                    try:
                        final_file = ydl_obj.prepare_filename(info_dict)
                    except Exception:
                        pass

            # Extension could change after merging / post-processing (.mp4, .mkv, .mp3, etc.)
            if final_file and not os.path.exists(final_file):
                base, _ = os.path.splitext(final_file)
                for ext in ['.mp4', '.mkv', '.webm', '.mp3', '.m4a']:
                    cand = base + ext
                    if os.path.exists(cand):
                        final_file = cand
                        break

            # If still not located, check output folder for matching video id
            if (not final_file or not os.path.exists(final_file)) and info_dict and info_dict.get('id'):
                vid_id = info_dict['id']
                if os.path.exists(item.output_dir):
                    for f in os.listdir(item.output_dir):
                        if vid_id in f and not f.endswith('.part') and not f.endswith('.ytdl'):
                            cand = os.path.join(item.output_dir, f)
                            if os.path.isfile(cand):
                                final_file = cand
                                break

            # Read true file size from disk!
            if final_file and os.path.exists(final_file):
                actual_bytes = os.path.getsize(final_file)
                item.final_filepath = final_file
                item.downloaded_str = format_bytes(actual_bytes)
                item.total_str = format_bytes(actual_bytes)

            item.status = "Completed"
            item.progress = 1.0
            item.speed_str = "Done"
            item.eta_str = "00:00"

        target_dir = item.output_dir
        if item.organize_subfolders:
            folder_clean = re.sub(r'[\\/*?:"<>|]', '_', (item.uploader or item.platform or 'Downloads').strip())
            if folder_clean:
                target_dir = os.path.join(item.output_dir, folder_clean)
                os.makedirs(target_dir, exist_ok=True)

        format_selector = QUALITY_FORMAT_MAP.get(item.quality_label, "bestvideo+bestaudio/best")
        outtmpl = os.path.join(target_dir, f'%(title).150B [%(id)s].%(ext)s')

        ydl_opts: Dict[str, Any] = {
            'outtmpl': outtmpl,
            'format': format_selector,
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True,
            'ignoreerrors': False,
            'noplaylist': True,
            'nocheckcertificate': True,
            'js_runtimes': {'node': {}},
            'remote_components': {'ejs:github': {}},
        }

        if item.time_range and '-' in item.time_range:
            parts = item.time_range.split('-')
            def _parse_time_str(s: str) -> float:
                s = s.strip()
                tokens = s.split(':')
                if len(tokens) == 3:
                    return float(tokens[0]) * 3600 + float(tokens[1]) * 60 + float(tokens[2])
                elif len(tokens) == 2:
                    return float(tokens[0]) * 60 + float(tokens[1])
                return float(tokens[0]) if tokens and tokens[0] else 0.0

            try:
                s_sec = _parse_time_str(parts[0])
                e_sec = _parse_time_str(parts[1])
                if e_sec > s_sec:
                    ydl_opts['download_ranges'] = yt_dlp.utils.download_range_func(None, [(s_sec, e_sec)])
                    ydl_opts['force_keyframes_at_cuts'] = True
                    self.log(f"[Trimmer] Setting time section: {parts[0].strip()} to {parts[1].strip()}")
            except Exception as tr_err:
                self.log(f"[Trimmer Notice] Range parse error: {tr_err}")

        if item.rate_limit_bytes and item.rate_limit_bytes > 0:
            ydl_opts['ratelimit'] = item.rate_limit_bytes

        safe_cookies = get_safe_cookie_file()
        if safe_cookies:
            ydl_opts['cookiefile'] = safe_cookies
            self.log(f"[Engine] Active cookies.txt loaded for: {item.title or item.url}")

        if self.ffmpeg_path:
            ydl_opts['ffmpeg_location'] = self.ffmpeg_path

        postprocessors = []
        if is_audio:
            if 'FLAC' in item.quality_label:
                codec = 'flac'
                quality = '0'
            elif 'WAV' in item.quality_label:
                codec = 'wav'
                quality = '0'
            elif 'AAC' in item.quality_label:
                codec = 'aac'
                quality = '256'
            elif 'M4A' in item.quality_label:
                codec = 'm4a'
                quality = '256'
            else:
                codec = 'mp3'
                quality = '320'

            postprocessors.append({
                'key': 'FFmpegExtractAudio',
                'preferredcodec': codec,
                'preferredquality': quality,
            })
            if item.embed_metadata:
                postprocessors.append({
                    'key': 'FFmpegMetadata',
                    'add_metadata': True,
                })
                ydl_opts['writethumbnail'] = True
                postprocessors.append({
                    'key': 'EmbedThumbnail',
                    'already_have_thumbnail': False,
                })
        else:
            ydl_opts['merge_output_format'] = item.container_format or 'mp4'
            if item.embed_metadata:
                postprocessors.append({
                    'key': 'FFmpegMetadata',
                    'add_metadata': True,
                })
            if item.download_subtitles:
                ydl_opts['writesubtitles'] = True
                ydl_opts['writeautomaticsub'] = True
                sub_langs = [s.strip() for s in (item.subtitle_langs or 'en,bn').split(',') if s.strip()]
                ydl_opts['subtitleslangs'] = sub_langs if sub_langs else ['en']
                ydl_opts['subtitlesformat'] = 'srt/best'
                postprocessors.append({
                    'key': 'FFmpegSubtitlesEmbed'
                })

        if postprocessors:
            ydl_opts['postprocessors'] = postprocessors

        try:
            try:
                # Primary attempt: Full Quality (Up to 4K / 1080p / 60fps)
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(item.url, download=True)
                    _finalize_item_file(ydl, info)
                    self.history_manager.add_entry(item)
                    self.log(f"[Download Finished] {item.title} ({item.total_str})")
            except Exception as e:
                err_str = str(e)
                if "DOWNLOAD_CANCELLED_BY_USER" in err_str:
                    item.status = "Cancelled"
                    item.error_msg = "Cancelled by user"
                    self.log(f"[Download Cancelled] {item.title}")
                    return

                # Check if YouTube blocked with bot challenge / sign in required
                is_bot_error = any(kw in err_str.lower() for kw in ["sign in to confirm", "not a bot", "bot detection", "429: too many requests"])
                if is_bot_error and "youtube" in item.url.lower():
                    self.log(f"[Engine Anti-Bot] Bot challenge detected for {item.title}. Retrying with multi-client bypass...")
                    fallback_opts = dict(ydl_opts)
                    fallback_opts['extractor_args'] = {
                        'youtube': {
                            'player_client': ['web_creator', 'mweb', 'android', 'tv']
                        }
                    }
                    fallback_opts['format'] = 'bestvideo+bestaudio/best'
                    try:
                        with yt_dlp.YoutubeDL(fallback_opts) as ydl_fb:
                            info = ydl_fb.extract_info(item.url, download=True)
                            _finalize_item_file(ydl_fb, info)
                            self.history_manager.add_entry(item)
                            item.quality_label = f"{item.quality_label} [Anti-Bot Fallback]"
                            self.log(f"[Download Finished (Bypass)] {item.title} ({item.total_str}).")
                            return
                    except Exception as fb_err:
                        err_str = str(fb_err)

                item.status = "Error"
                item.error_msg = err_str.split("\n")[0]
                self.log(f"[Download Error] {item.title}: {item.error_msg}")
        finally:
            item.is_in_progress = False

    def fetch_playlist_info(self, url: str) -> Optional[Dict[str, Any]]:
        """Fast flat extraction for YouTube / multi-platform playlists with OmniMedia branding."""
        platform = detect_platform(url)
        clean_url = url.strip()
        match = re.search(r'[?&]list=([a-zA-Z0-9_\-]+)', clean_url)
        if match:
            list_id = match.group(1)
            if not list_id.startswith('RD') and not list_id.startswith('UL') and not list_id.startswith('RDAMVM'):
                clean_url = f"https://www.youtube.com/playlist?list={list_id}"

        ydl_opts: Dict[str, Any] = {
            'extract_flat': True,
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'ignoreerrors': True,
            'nocheckcertificate': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios']
                }
            }
        }
        safe_cookies = get_safe_cookie_file()
        if safe_cookies:
            ydl_opts['cookiefile'] = safe_cookies

        if self.ffmpeg_path:
            ydl_opts['ffmpeg_location'] = self.ffmpeg_path

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                res = ydl.extract_info(clean_url, download=False)
                if not res:
                    return None

                playlist_title = res.get('title') or "YouTube Playlist"
                playlist_id = res.get('id') or "playlist"
                uploader = res.get('uploader') or res.get('channel') or "YouTube Creator"
                default_thumb = "assets/OmniMedia.png"

                entries_raw = res.get('entries', [])
                parsed_entries = []
                total_duration = 0

                for e in entries_raw:
                    if not e:
                        continue
                    eid = str(e.get('id') or '')
                    if not eid:
                        continue
                    etitle = e.get('title') or f"Track {eid}"
                    edur = e.get('duration') or 0
                    total_duration += edur
                    eurl = e.get('url') or e.get('webpage_url')
                    if not eurl or not str(eurl).startswith('http'):
                        eurl = f"https://www.youtube.com/watch?v={eid}"

                    ethumb = e.get('thumbnail') or ''
                    if not ethumb:
                        thumbs_list = e.get('thumbnails', [])
                        if thumbs_list and isinstance(thumbs_list, list) and isinstance(thumbs_list[-1], dict):
                            ethumb = thumbs_list[-1].get('url', '')
                    if not ethumb and platform == 'youtube' and eid:
                        ethumb = f"https://i.ytimg.com/vi/{eid}/hqdefault.jpg"
                    if not ethumb:
                        ethumb = default_thumb

                    parsed_entries.append({
                        'id': eid,
                        'title': etitle,
                        'url': eurl,
                        'duration': edur,
                        'duration_str': format_duration(edur),
                        'thumbnail': ethumb,
                        'platform': platform,
                        'is_short': (0 < edur <= 60)
                    })

                return {
                    'id': playlist_id,
                    'title': playlist_title,
                    'uploader': uploader,
                    'uploader_avatar': default_thumb,
                    'duration': total_duration,
                    'duration_str': f"{len(parsed_entries)} Videos",
                    'thumbnail': default_thumb,
                    'view_count': res.get('view_count', 0),
                    'is_short': False,
                    'is_playlist': True,
                    'playlist_count': len(parsed_entries),
                    'platform': platform,
                    'url': clean_url,
                    'entries': parsed_entries
                }
        except Exception as e:
            self.log(f"Playlist extraction error: {e}")
            return None

    def fetch_single_info(self, url: str) -> Optional[Dict[str, Any]]:
        clean = url.strip()
        if is_playlist_url(clean):
            pl = self.fetch_playlist_info(clean)
            if pl and pl.get("entries") and len(pl["entries"]) > 1:
                return pl

        platform = detect_platform(clean)
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'noplaylist': True,
            'nocheckcertificate': True,
            'js_runtimes': {'node': {}},
            'remote_components': {'ejs:github': {}},
        }
        safe_cookies = get_safe_cookie_file()
        if safe_cookies:
            ydl_opts['cookiefile'] = safe_cookies

        if self.ffmpeg_path:
            ydl_opts['ffmpeg_location'] = self.ffmpeg_path

        info = None
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean, download=False)
        except Exception as e:
            err_str = str(e)
            is_bot_error = any(kw in err_str.lower() for kw in ["sign in to confirm", "not a bot", "bot detection", "429: too many requests"])
            if is_bot_error and platform == "youtube":
                fb_opts = dict(ydl_opts)
                fb_opts['extractor_args'] = {'youtube': {'player_client': ['android', 'ios']}}
                try:
                    with yt_dlp.YoutubeDL(fb_opts) as ydl_fb:
                        info = ydl_fb.extract_info(clean, download=False)
                except Exception:
                    return None
            else:
                return None

        if not info:
            return None

        # Check if the extracted result is a playlist
        if info.get('_type') == 'playlist' or ('entries' in info and len(info.get('entries', [])) > 1):
            return self.fetch_playlist_info(clean)

        duration = info.get('duration') or 0
        is_short = (
            (duration > 0 and duration <= 60)
            or ('/shorts/' in clean)
            or ('/reel/' in clean)
            or (platform == 'tiktok')
        )

        thumb = info.get('thumbnail') or ''
        if not thumb and platform == 'youtube' and info.get('id'):
            thumb = f"https://i.ytimg.com/vi/{info['id']}/hqdefault.jpg"
        if not thumb:
            thumb = "assets/OmniMedia.png"

        # Extract channel avatar if available
        avatar = ""
        for av_key in ['uploader_avatar', 'channel_avatar', 'avatar']:
            if isinstance(info.get(av_key), str) and info.get(av_key).startswith('http'):
                avatar = info.get(av_key)
                break
        if not avatar:
            avatar = "assets/OmniMedia.png"

        return {
            'id': info.get('id', 'unknown'),
            'title': info.get('title', 'Untitled Video'),
            'uploader': info.get('uploader') or info.get('channel') or info.get('creator', 'Unknown Creator'),
            'uploader_avatar': avatar,
            'duration': duration,
            'duration_str': format_duration(duration),
            'thumbnail': thumb,
            'view_count': info.get('view_count', 0),
            'is_short': is_short,
            'is_playlist': False,
            'platform': platform,
            'url': info.get('webpage_url') or clean
        }

    def get_direct_download_link(self, url: str, quality_label: str = "Best Available") -> Dict[str, Any]:
        """Extract direct CDN stream download link for the given video and selected quality."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'nocheckcertificate': True,
            'js_runtimes': {'node': {}},
            'remote_components': {'ejs:github': {}},
        }
        safe_cookies = get_safe_cookie_file()
        if safe_cookies:
            ydl_opts['cookiefile'] = safe_cookies

        info = None
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
        except Exception:
            if "youtube" in url.lower():
                fb_opts = dict(ydl_opts)
                fb_opts['extractor_args'] = {'youtube': {'player_client': ['android', 'ios']}}
                try:
                    with yt_dlp.YoutubeDL(fb_opts) as ydl_fb:
                        info = ydl_fb.extract_info(url, download=False)
                except Exception:
                    pass

        if not info:
            return {"success": False, "error": "Could not extract stream links for this media"}

        formats = info.get('formats', [])
        target_height = None
        if "4K" in quality_label: target_height = 2160
        elif "1440p" in quality_label: target_height = 1440
        elif "1080p" in quality_label: target_height = 1080
        elif "720p" in quality_label: target_height = 720
        elif "480p" in quality_label: target_height = 480
        elif "360p" in quality_label: target_height = 360

        is_audio_only = "Audio" in quality_label
        best_video = None
        best_audio = None
        best_progressive = None

        for f in formats:
            f_url = f.get('url')
            if not f_url:
                continue
            vcodec = f.get('vcodec') or 'none'
            acodec = f.get('acodec') or 'none'
            h = f.get('height') or 0

            # Progressive (combined video + audio)
            if vcodec != 'none' and acodec != 'none':
                if target_height:
                    if h <= target_height:
                        best_progressive = f
                else:
                    best_progressive = f
            # Video only
            elif vcodec != 'none' and acodec == 'none':
                if target_height:
                    if h <= target_height:
                        best_video = f
                else:
                    best_video = f
            # Audio only
            elif vcodec == 'none' and acodec != 'none':
                best_audio = f

        if is_audio_only and best_audio:
            chosen_url = best_audio.get('url')
        elif best_progressive and (not target_height or target_height <= 720):
            chosen_url = best_progressive.get('url')
        elif best_video:
            chosen_url = best_video.get('url')
        elif best_progressive:
            chosen_url = best_progressive.get('url')
        else:
            chosen_url = info.get('url') or (formats[-1].get('url') if formats else '')

        if not chosen_url:
            return {"success": False, "error": "No direct stream link available for this video"}

        return {
            "success": True,
            "url": chosen_url,
            "title": info.get('title', 'video'),
            "quality": quality_label
        }
