"""
Python API Bridge for PyWebView with Individual Item Actions (Pause, Remove, Show in Folder, Retry).
"""

import os
import sys
import time
import json
import shutil
import threading
import webbrowser
import email.utils
import http.cookies
from typing import List, Dict, Any, Optional
import yt_dlp
import webview

from downloader import DownloadManager, QUALITY_FORMAT_MAP, detect_platform, get_ffmpeg_path, format_bytes, is_playlist_url
from channel_scanner import ChannelScanner
from cookie_manager import (
    parse_and_write_cookies,
    sanitize_and_validate_cookie_file,
    get_safe_cookie_file,
    get_cookie_file_path,
    is_valid_netscape_file
)

import ctypes
from ctypes import wintypes

def _win32_read_clipboard() -> str:
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    if not user32.OpenClipboard(None):
        return ""
    try:
        CF_UNICODETEXT = 13
        h_data = user32.GetClipboardData(CF_UNICODETEXT)
        if not h_data:
            return ""
        kernel32.GlobalLock.restype = ctypes.c_void_p
        p_data = kernel32.GlobalLock(h_data)
        if not p_data:
            return ""
        try:
            return ctypes.c_wchar_p(p_data).value or ""
        finally:
            kernel32.GlobalUnlock(h_data)
    except Exception:
        return ""
    finally:
        user32.CloseClipboard()

def _win32_write_clipboard(text: str) -> bool:
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    if not user32.OpenClipboard(None):
        return False
    try:
        user32.EmptyClipboard()
        CF_UNICODETEXT = 13
        data = text.encode('utf-16-le') + b'\x00\x00'
        GMEM_MOVEABLE = 0x0002
        kernel32.GlobalAlloc.restype = ctypes.c_void_p
        h_mem = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(data))
        if not h_mem:
            return False
        kernel32.GlobalLock.restype = ctypes.c_void_p
        p_mem = kernel32.GlobalLock(h_mem)
        ctypes.memmove(p_mem, data, len(data))
        kernel32.GlobalUnlock(h_mem)
        user32.SetClipboardData(CF_UNICODETEXT, h_mem)
        return True
    except Exception:
        return False
    finally:
        user32.CloseClipboard()

def detect_installed_browsers() -> List[str]:
    browsers = []
    chrome_path = os.path.expanduser('~\\AppData\\Local\\Google\\Chrome\\User Data')
    edge_path = os.path.expanduser('~\\AppData\\Local\\Microsoft\\Edge\\User Data')
    brave_path = os.path.expanduser('~\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data')
    firefox_path = os.path.expanduser('~\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles')
    if os.path.exists(chrome_path): browsers.append("chrome")
    if os.path.exists(edge_path): browsers.append("edge")
    if os.path.exists(brave_path): browsers.append("brave")
    if os.path.exists(firefox_path): browsers.append("firefox")
    return browsers if browsers else ["chrome"]

_main_window = None
_login_window = None

def set_main_window(window):
    global _main_window
    _main_window = window

class DesktopAPI:
    def __init__(self):
        self._downloader = DownloadManager(max_concurrent=3)
        self._scanner = ChannelScanner()

        user_home = os.path.expanduser("~")
        self._output_dir = os.path.join(user_home, "Downloads", "OmniMedia_Downloads")
        os.makedirs(self._output_dir, exist_ok=True)

        self._logs: List[str] = []
        self._downloader.log_callback = self.add_log
        self._settings = self._load_settings()
        self.add_log(f"OmniMedia Pro engine initialized. Destination: {self._output_dir}")

    def _get_settings_path(self) -> str:
        profile_dir = os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'OmniMediaPro_WebProfile')
        return os.path.join(profile_dir, 'settings.json')

    def _load_settings(self) -> Dict[str, Any]:
        defaults = {
            "container_format": "mp4",
            "download_subtitles": False,
            "subtitle_langs": "en,bn",
            "embed_metadata": True,
            "rate_limit_mb": 0.0,
            "max_concurrent": 3,
            "clipboard_monitor": True,
            "auto_shutdown_on_finish": False,
            "organize_subfolders": False
        }
        sp = self._get_settings_path()
        if os.path.exists(sp):
            try:
                with open(sp, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    defaults.update(data)
            except Exception:
                pass
        return defaults

    def get_settings(self) -> Dict[str, Any]:
        return dict(self._settings)

    def save_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        self._settings.update(new_settings)
        sp = self._get_settings_path()
        try:
            os.makedirs(os.path.dirname(sp), exist_ok=True)
            with open(sp, "w", encoding="utf-8") as f:
                json.dump(self._settings, f, indent=2)
            self.add_log("Preferences updated.")
            return {"success": True, "settings": self._settings}
        except Exception as e:
            self.add_log(f"Preferences save error: {e}")
            return {"success": False, "error": str(e)}

    def set_main_window(self, window):
        set_main_window(window)

    def add_log(self, text: str):
        timestamp = time.strftime("[%H:%M:%S] ")
        msg = f"{timestamp}{text}"
        self._logs.append(msg)
        if len(self._logs) > 300:
            self._logs.pop(0)

    def is_signed_in(self) -> bool:
        cookie_file = get_cookie_file_path()
        if not os.path.exists(cookie_file):
            self._cookie_cache_mtime = -1
            self._cookie_cache_result = False
            self._cookie_cache_exists = False
            return False
        try:
            mtime = os.path.getmtime(cookie_file)
            if getattr(self, "_cookie_cache_mtime", -1) == mtime:
                return self._cookie_cache_result

            with open(cookie_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                res = any(k in content for k in ["SID\t", "LOGIN_INFO\t", "HSID\t", "__Secure-1PSID\t"])
                self._cookie_cache_mtime = mtime
                self._cookie_cache_result = res
                self._cookie_cache_exists = True
                return res
        except Exception:
            return False

    def get_info(self) -> Dict[str, Any]:
        ffmpeg_p = get_ffmpeg_path()
        cookie_file = get_cookie_file_path()
        has_cookies = os.path.exists(cookie_file)
        signed_in = self.is_signed_in()
        return {
            "output_dir": self._output_dir,
            "ffmpeg_available": bool(ffmpeg_p),
            "ffmpeg_path": ffmpeg_p or "Not Found",
            "python_version": sys.version.split()[0],
            "ytdlp_version": getattr(yt_dlp.version, "__version__", "unknown"),
            "qualities": list(QUALITY_FORMAT_MAP.keys()),
            "max_concurrent": self._downloader.max_concurrent,
            "has_cookies": has_cookies,
            "is_signed_in": signed_in,
            "detected_browsers": detect_installed_browsers(),
            "settings": self._settings
        }

    def choose_folder(self) -> str:
        global _main_window
        try:
            if _main_window:
                res = _main_window.create_file_dialog(webview.FOLDER_DIALOG, directory=self._output_dir)
                if res and len(res) > 0:
                    folder = res[0]
                    if folder:
                        self._output_dir = os.path.normpath(folder)
                        self.add_log(f"Destination folder updated to: {self._output_dir}")
        except Exception as e:
            self.add_log(f"Folder picker error: {e}")
        return self._output_dir

    def open_folder(self) -> bool:
        try:
            os.makedirs(self._output_dir, exist_ok=True)
            os.startfile(self._output_dir)
            self.add_log(f"Opened folder: {self._output_dir}")
            return True
        except Exception as e:
            self.add_log(f"Error opening folder: {e}")
            return False

    def choose_txt_file(self) -> str:
        global _main_window
        try:
            if _main_window:
                res = _main_window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    file_types=('Text Files (*.txt)', 'All Files (*.*)')
                )
                if res and len(res) > 0:
                    path = res[0]
                    if path and os.path.exists(path):
                        with open(path, "r", encoding="utf-8", errors="ignore") as f:
                            return f.read()
        except Exception as e:
            self.add_log(f"File open error: {e}")
        return ""

    def read_clipboard(self) -> str:
        return _win32_read_clipboard()

    def write_clipboard(self, text: str) -> bool:
        return _win32_write_clipboard(text)

    def check_clipboard_for_media(self) -> Dict[str, Any]:
        """Sniff clipboard for newly copied YouTube/TikTok/Instagram/Facebook media URLs."""
        if not self._settings.get("clipboard_monitor", True):
            return {"has_media": False}

        raw = _win32_read_clipboard().strip()
        if not raw or not raw.startswith("http"):
            return {"has_media": False}

        if getattr(self, "_last_sniffed_url", "") == raw:
            return {"has_media": False}

        plat = detect_platform(raw)
        if plat in ["youtube", "tiktok", "instagram", "facebook"]:
            self._last_sniffed_url = raw
            return {
                "has_media": True,
                "url": raw,
                "platform": plat
            }
        return {"has_media": False}

    def save_thumbnail(self, thumb_url: str, title: str = "") -> Dict[str, Any]:
        """Download and save the highest resolution thumbnail as an image asset."""
        import urllib.request
        import re
        if not thumb_url or not thumb_url.startswith("http"):
            return {"success": False, "error": "Invalid thumbnail URL"}

        safe_title = re.sub(r'[\\/*?:"<>|]', '_', title.strip()) if title else f"thumbnail_{int(time.time())}"
        safe_title = safe_title[:100]
        ext = ".jpg"
        if ".webp" in thumb_url:
            ext = ".webp"
        elif ".png" in thumb_url:
            ext = ".png"

        save_path = os.path.join(self._output_dir, f"{safe_title}_HD{ext}")
        counter = 1
        while os.path.exists(save_path):
            save_path = os.path.join(self._output_dir, f"{safe_title}_HD_{counter}{ext}")
            counter += 1

        try:
            req = urllib.request.Request(thumb_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=10) as resp, open(save_path, 'wb') as out_f:
                out_f.write(resp.read())
            self.add_log(f"Saved HD Thumbnail: {os.path.basename(save_path)}")
            return {"success": True, "path": save_path, "filename": os.path.basename(save_path)}
        except Exception as e:
            self.add_log(f"Thumbnail save error: {e}")
            return {"success": False, "error": str(e)}

    def update_ytdlp_engine(self) -> Dict[str, Any]:
        """Upgrade yt-dlp to latest release via pip in background thread."""
        current_ver = getattr(yt_dlp.version, "__version__", "unknown")
        self.add_log(f"Checking for yt-dlp engine updates (current: v{current_ver})...")

        def _run_update():
            import subprocess
            try:
                cmd = [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"]
                p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=90)
                if p.returncode == 0:
                    self.add_log("yt-dlp engine successfully upgraded! Ready for new media challenges.")
                else:
                    self.add_log(f"yt-dlp update notice: {p.stderr.strip()[:100]}")
            except Exception as ex:
                self.add_log(f"yt-dlp update error: {ex}")

        threading.Thread(target=_run_update, daemon=True).start()
        return {"success": True, "current_version": current_ver, "message": "Update process launched in background."}

    def trigger_system_shutdown(self, seconds: int = 60) -> Dict[str, Any]:
        """Schedule Windows system shutdown after all downloads finish."""
        try:
            os.system(f"shutdown /s /t {int(seconds)}")
            self.add_log(f"⚡ System shutdown initiated: PC will turn off in {seconds} seconds.")
            return {"success": True, "seconds": seconds}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def cancel_system_shutdown(self) -> Dict[str, Any]:
        """Abort scheduled Windows shutdown."""
        try:
            os.system("shutdown /a")
            self.add_log("Scheduled system shutdown cancelled by user.")
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def choose_cookies_file(self) -> Dict[str, Any]:
        global _main_window
        try:
            if _main_window:
                res = _main_window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    file_types=('Cookie Files (*.txt;*.json)', 'All Files (*.*)')
                )
                if res and len(res) > 0:
                    path = res[0]
                    if path and os.path.exists(path):
                        target = get_cookie_file_path()
                        ok, msg, count = sanitize_and_validate_cookie_file(path, target)
                        if ok:
                            self.add_log(f"Loaded and verified {count} cookies from: {os.path.basename(path)}")
                            return {"success": True, "message": msg}
                        else:
                            self.add_log(f"Cookie import rejected: {msg}")
                            return {"success": False, "error": msg}
        except Exception as e:
            self.add_log(f"Cookies import error: {e}")
            return {"success": False, "error": str(e)}
        return {"success": False, "error": "No file selected"}

    def remove_cookies(self) -> bool:
        target = get_cookie_file_path()
        if os.path.exists(target):
            try:
                os.remove(target)
                self.add_log("cookies.txt removed.")
                return True
            except Exception as e:
                self.add_log(f"Error removing cookies.txt: {e}")
        return False

    def open_youtube_login(self) -> Dict[str, Any]:
        """Open the integrated in-app YouTube sign-in window."""
        global _login_window
        if _login_window:
            try:
                _login_window.show()
                _login_window.restore()
                return {"success": True, "message": "Sign-in window already active"}
            except Exception:
                _login_window = None

        self.add_log("Opening integrated YouTube sign-in window...")
        login_url = "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F"

        try:
            _login_window = webview.create_window(
                title="Sign in to YouTube - OmniMedia Pro",
                url=login_url,
                width=760,
                height=800,
                resizable=True,
                background_color="#090b10"
            )

            def _on_closed():
                global _login_window
                _login_window = None

            _login_window.events.closed += _on_closed

            def _monitor():
                global _login_window
                time.sleep(2.5)
                target_cookie_file = get_cookie_file_path()
                while _login_window:
                    try:
                        time.sleep(1.5)
                        if not _login_window:
                            break
                        cks = _login_window.get_cookies()
                        if not cks:
                            continue

                        all_names = set()
                        for sc in cks:
                            for n in sc.keys():
                                all_names.add(n)

                        has_auth = any(k in all_names for k in ["LOGIN_INFO", "SID", "SSID", "HSID", "__Secure-1PSID"])
                        if has_auth:
                            saved = parse_and_write_cookies(cks, target_cookie_file)
                            if saved > 0:
                                self.add_log(f"In-App YouTube login detected! Saved {saved} session cookies.")
                                time.sleep(1)
                                try:
                                    if _login_window:
                                        _login_window.destroy()
                                except Exception:
                                    pass
                                _login_window = None
                                break
                    except Exception:
                        break

            threading.Thread(target=_monitor, daemon=True).start()
            return {"success": True, "message": "Sign-in window opened. Please complete your YouTube login."}
        except Exception as e:
            self.add_log(f"Error launching sign-in window: {e}")
            return {"success": False, "error": str(e)}

    def capture_active_cookies(self) -> Dict[str, Any]:
        """Manually capture cookies from active in-app window or main window."""
        global _login_window, _main_window
        target_cookie_file = get_cookie_file_path()
        cks = []
        if _login_window:
            try:
                cks = _login_window.get_cookies()
            except Exception:
                cks = []
        if not cks and _main_window:
            try:
                cks = _main_window.get_cookies()
            except Exception:
                cks = []

        if cks:
            saved = parse_and_write_cookies(cks, target_cookie_file)
            if saved > 0:
                self.add_log(f"Successfully captured {saved} active cookies.")
                if _login_window:
                    try:
                        _login_window.destroy()
                    except Exception:
                        pass
                    _login_window = None
                return {"success": True, "count": saved, "message": "YouTube login session saved! Full 1080p/4K unlocked."}

        return {"success": False, "error": "No YouTube cookies found. Please complete login first."}

    def sign_out_youtube(self) -> bool:
        """Sign out and purge saved cookies."""
        target = get_cookie_file_path()
        res = False
        if os.path.exists(target):
            try:
                os.remove(target)
                self.add_log("Signed out of YouTube. cookies.txt removed.")
                res = True
            except Exception as e:
                self.add_log(f"Sign out error: {e}")
        return res

    def detect_url_platform(self, url: str) -> str:
        return detect_platform(url)

    def inspect_url(self, url: str) -> Dict[str, Any]:
        url = url.strip()
        if not url:
            return {"success": False, "error": "URL cannot be empty"}

        platform = detect_platform(url)
        self.add_log(f"Inspecting [{platform.upper()}] URL: {url}")
        info = self._downloader.fetch_single_info(url)
        if not info:
            return {"success": False, "error": f"Failed to retrieve metadata from {platform.capitalize()}."}

        thumb = info.get("thumbnail") or ""
        if not thumb and platform == "youtube" and info.get("id"):
            thumb = f"https://i.ytimg.com/vi/{info['id']}/hqdefault.jpg"
        if not thumb:
            thumb = "assets/OmniMedia.png"

        avatar = info.get("uploader_avatar") or "assets/OmniMedia.png"

        return {
            "success": True,
            "id": info.get("id"),
            "title": info.get("title"),
            "uploader": info.get("uploader"),
            "uploader_avatar": avatar,
            "duration": info.get("duration"),
            "duration_str": info.get("duration_str"),
            "thumbnail": thumb,
            "is_short": info.get("is_short", False),
            "is_playlist": info.get("is_playlist", False),
            "playlist_count": info.get("playlist_count", 0),
            "entries": info.get("entries", []),
            "platform": info.get("platform"),
            "url": info.get("url")
        }

    def get_direct_download_link(self, url: str, quality_label: str = "Best Available") -> Dict[str, Any]:
        """Fetch direct stream download link for external downloaders (IDM, VLC, browser)."""
        url = url.strip()
        if not url:
            return {"success": False, "error": "URL cannot be empty"}
        self.add_log(f"Extracting direct stream link ({quality_label}): {url}")
        res = self._downloader.get_direct_download_link(url, quality_label)
        if res.get("success"):
            self.add_log(f"Extracted direct stream URL: {res.get('url')[:60]}...")
        return res

    def scan_channel(self, url: str, filter_mode: str, max_results: Optional[int]) -> Dict[str, Any]:
        url = url.strip()
        if not url:
            return {"success": False, "error": "Channel/Profile URL cannot be empty"}

        platform = detect_platform(url)
        self.add_log(f"Scanning [{platform.upper()}] feed: {url} ({filter_mode}, limit: {max_results or 'all'})")
        try:
            res = self._scanner.scan(
                url=url,
                filter_mode=filter_mode,
                max_results=max_results,
                progress_callback=self.add_log
            )
            items = res.get("items", [])
            channel_info = res.get("channel", {})
            serialized = []
            for it in items:
                serialized.append({
                    "id": it.id,
                    "title": it.title,
                    "url": it.url,
                    "platform": it.platform,
                    "is_short": it.is_short,
                    "duration": it.duration,
                    "duration_str": it.duration_str,
                    "thumbnail": it.thumbnail,
                    "selected": it.selected
                })
            return {"success": True, "items": serialized, "channel": channel_info, "platform": platform}
        except Exception as e:
            self.add_log(f"Scan error: {e}")
            return {"success": False, "error": str(e)}

    def check_duplicates(self, urls: List[str]) -> Dict[str, Any]:
        """Check if any of the provided URLs are already in queue or processed."""
        return self._downloader.check_existing(urls)

    def add_items_to_queue(
        self,
        items_payload: List[Dict[str, Any]],
        quality: str,
        batch_id: Optional[str] = None,
        batch_title: Optional[str] = None,
        skip_duplicates: bool = False,
        custom_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not batch_id:
            batch_id = f"batch_{int(time.time())}"
        if not batch_title:
            batch_title = f"Batch Download ({len(items_payload)} items)"

        opts = custom_options or {}
        container_format = opts.get("container_format") or self._settings.get("container_format", "mp4")
        download_subtitles = opts.get("download_subtitles") if "download_subtitles" in opts else self._settings.get("download_subtitles", False)
        subtitle_langs = opts.get("subtitle_langs") or self._settings.get("subtitle_langs", "en,bn")
        embed_metadata = opts.get("embed_metadata") if "embed_metadata" in opts else self._settings.get("embed_metadata", True)
        rate_limit_mb = float(opts.get("rate_limit_mb") if "rate_limit_mb" in opts else self._settings.get("rate_limit_mb", 0.0))
        rate_limit_bytes = int(rate_limit_mb * 1024 * 1024) if rate_limit_mb > 0 else 0

        # Auto-expand playlist items so each video is tracked individually
        expanded_payload = []
        expanded_titles = []
        for it in items_payload:
            u = it.get("url", "").strip()
            is_pl = it.get("is_playlist", False) or is_playlist_url(u)
            if is_pl:
                self.add_log(f"Auto-expanding playlist into batch items: {u}")
                try:
                    pl_info = self._downloader.fetch_playlist_info(u)
                    if pl_info and pl_info.get("entries"):
                        if pl_info.get("title"):
                            expanded_titles.append(pl_info["title"])
                        for entry in pl_info["entries"]:
                            expanded_payload.append({
                                "url": entry["url"],
                                "title": entry["title"],
                                "thumbnail": entry.get("thumbnail") or "assets/OmniMedia.png",
                                "is_short": entry.get("is_short", False),
                                "duration_str": entry.get("duration_str", "00:00")
                            })
                        continue
                except Exception as ex:
                    self.add_log(f"Notice on playlist expansion: {ex}")
            expanded_payload.append(it)
        items_payload = expanded_payload

        if not batch_title or "Batch Download (" in batch_title or "Bulk Links (" in batch_title:
            if expanded_titles:
                batch_title = f"Playlist: {expanded_titles[0]} ({len(items_payload)} items)"
            else:
                batch_title = f"Batch Download ({len(items_payload)} items)"

        urls = [it.get("url", "").strip() for it in items_payload if it.get("url", "").strip()]
        skipped_count = 0
        
        if skip_duplicates:
            check_res = self._downloader.check_existing(urls)
            clean_set = set(check_res.get("clean_urls", []))
            original_len = len(items_payload)
            items_payload = [it for it in items_payload if it.get("url", "").strip() in clean_set]
            skipped_count = original_len - len(items_payload)
            if skipped_count > 0:
                self.add_log(f"Auto-skipped {skipped_count} duplicate videos already in queue.")

        organize_subfolders = opts.get("organize_subfolders") if "organize_subfolders" in opts else self._settings.get("organize_subfolders", False)

        count = 0
        for it in items_payload:
            url = it.get("url", "").strip()
            if not url:
                continue
            title = it.get("title", "")
            is_short = it.get("is_short", False)
            duration_str = it.get("duration_str", "00:00")
            thumbnail = it.get("thumbnail", "")
            time_range = it.get("time_range")
            uploader = it.get("uploader") or ""

            self._downloader.add_to_queue(
                url=url,
                title=title,
                quality_label=quality,
                output_dir=self._output_dir,
                batch_id=batch_id,
                batch_title=batch_title,
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
            count += 1

        self.add_log(f"Added {count} videos to queue under batch '{batch_title}' ({quality})")
        return {
            "success": True,
            "count": count,
            "skipped_count": skipped_count,
            "batch_id": batch_id
        }

    def get_queue_status(self) -> Dict[str, Any]:
        batches_map: Dict[str, Dict[str, Any]] = {}
        total_speed_bytes = 0.0
        active_count = 0
        completed_count = 0
        queued_count = 0

        with self._downloader._items_lock:
            for item in self._downloader.items:
                b_id = item.batch_id
                if b_id not in batches_map:
                    batches_map[b_id] = {
                        "batch_id": b_id,
                        "batch_title": item.batch_title,
                        "items": [],
                        "total": 0,
                        "completed": 0,
                        "downloading": 0,
                        "queued": 0,
                        "paused": 0,
                        "overall_pct": 0
                    }

                b_entry = batches_map[b_id]
                item_dict = item.to_dict()
                b_entry["items"].append(item_dict)
                b_entry["total"] += 1

                if item.status == "Completed":
                    b_entry["completed"] += 1
                    completed_count += 1
                elif item.status in ["Downloading", "Merging"]:
                    b_entry["downloading"] += 1
                    active_count += 1
                    total_speed_bytes += item.speed_bytes
                elif item.status == "Queued":
                    b_entry["queued"] += 1
                    queued_count += 1
                elif item.status == "Paused":
                    b_entry["paused"] += 1

            batches_list = []
            for b_id, b_data in batches_map.items():
                if b_data["total"] > 0:
                    pct = int((b_data["completed"] / b_data["total"]) * 100)
                    b_data["overall_pct"] = pct
                batches_list.append(b_data)

        cookie_file = get_cookie_file_path()
        signed_in = self.is_signed_in()
        has_cookies = getattr(self, "_cookie_cache_exists", os.path.exists(cookie_file))
        return {
            "is_paused": self._downloader.is_paused(),
            "total_speed_str": f"{format_bytes(total_speed_bytes)}/s" if total_speed_bytes > 0 else "0 B/s",
            "active_count": active_count,
            "completed_count": completed_count,
            "queued_count": queued_count,
            "total_items": len(self._downloader.items),
            "batches": batches_list,
            "logs": self._logs[-50:],
            "has_cookies": has_cookies,
            "is_signed_in": signed_in
        }

    # Individual item actions
    def toggle_pause_item(self, item_id: int) -> bool:
        return self._downloader.toggle_pause_item(item_id)

    def cancel_item(self, item_id: int) -> bool:
        self._downloader.cancel_item(item_id)
        return True

    def remove_item(self, item_id: int) -> bool:
        self._downloader.remove_item(item_id)
        return True

    def retry_item(self, item_id: int) -> bool:
        self._downloader.retry_item(item_id)
        return True

    def open_item_folder(self, item_id: int) -> bool:
        return self._downloader.open_item_folder(item_id)

    def cancel_batch(self, batch_id: str, clear_immediately: bool = False) -> bool:
        self._downloader.cancel_batch(batch_id, clear_immediately=clear_immediately)
        return True

    def remove_batch(self, batch_id: str) -> bool:
        self._downloader.remove_batch(batch_id)
        return True

    def pause_queue(self, paused: bool) -> bool:
        self._downloader.pause_queue(paused)
        return self._downloader.is_paused()

    def clear_completed(self) -> bool:
        self._downloader.clear_completed()
        return True

    def get_download_history(self) -> List[Dict[str, Any]]:
        return self._downloader.get_history()

    def open_history_file(self, history_id: str) -> Dict[str, Any]:
        """Open the downloaded media file directly in Windows default media player."""
        history = self._downloader.get_history()
        for item in history:
            if item.get("id") == history_id:
                fp = item.get("filepath")
                if not fp or not os.path.exists(fp):
                    return {"success": False, "exists": False, "error": "File Moved or Deleted"}
                try:
                    norm = os.path.normpath(fp)
                    os.startfile(norm)
                    return {"success": True, "exists": True, "path": norm}
                except Exception as e:
                    return {"success": False, "exists": True, "error": str(e)}
        return {"success": False, "exists": False, "error": "History item not found"}

    def open_history_folder(self, history_id: str) -> Dict[str, Any]:
        """Check if history file exists on disk and open folder with file selected."""
        history = self._downloader.get_history()
        for item in history:
            if item.get("id") == history_id:
                fp = item.get("filepath")
                if not fp or not os.path.exists(fp):
                    return {"success": False, "exists": False, "error": "File Moved or Deleted"}
                try:
                    norm = os.path.normpath(fp)
                    subprocess.Popen(f'explorer /select,"{norm}"')
                    return {"success": True, "exists": True, "path": norm}
                except Exception as e:
                    folder = os.path.dirname(fp)
                    if os.path.exists(folder):
                        try:
                            os.startfile(folder)
                            return {"success": True, "exists": True, "path": folder}
                        except Exception:
                            pass
                    return {"success": False, "exists": False, "error": "File Moved or Deleted"}
        return {"success": False, "exists": False, "error": "History item not found"}

    def delete_history_item(self, entry_id: str) -> bool:
        res = self._downloader.delete_history_entry(entry_id)
        if res:
            self.add_log(f"Deleted history item: {entry_id}")
        return res

    def clear_download_history(self) -> bool:
        res = self._downloader.clear_history()
        if res:
            self.add_log("Cleared all completed download history.")
        return res

    def open_external_url(self, url: str) -> bool:
        try:
            webbrowser.open(url)
            self.add_log(f"Opened link in external browser: {url}")
            return True
        except Exception as e:
            self.add_log(f"Could not open browser URL: {e}")
            return False

    def open_extension_store(self, extension_id: str = "cookies_locally") -> bool:
        store_urls = {
            "cookies_locally": "https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc",
            "cookie_editor_chrome": "https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm",
            "cookie_editor_firefox": "https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/",
            "cookie_editor_edge": "https://microsoftedge.microsoft.com/addons/detail/cookieeditor/neaplmfkghagebokkhhpbddgdbeajmhm"
        }
        target_url = store_urls.get(extension_id, store_urls["cookies_locally"])
        return self.open_external_url(target_url)

    def auto_import_cookies(self, browser_name: str = "chrome") -> Dict[str, Any]:
        """Try extracting cookies directly from an installed browser."""
        self.add_log(f"Attempting 1-click cookie extraction from {browser_name.capitalize()}...")
        try:
            jar = yt_dlp.cookies.extract_cookies_from_browser(browser_name.lower())
            if not jar:
                return {
                    "success": False,
                    "error": f"No cookies found in {browser_name.capitalize()}. Please make sure you are logged into YouTube in {browser_name.capitalize()}."
                }
            target = get_cookie_file_path()
            lines = [
                "# Netscape HTTP Cookie File",
                "# Exported automatically by OmniMedia Pro",
                ""
            ]
            for c in jar:
                domain = c.domain or ""
                flag = "TRUE" if domain.startswith(".") else "FALSE"
                path = c.path or "/"
                secure = "TRUE" if c.secure else "FALSE"
                expires = str(int(float(c.expires))) if c.expires else "0"
                lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{expires}\t{c.name}\t{c.value}")

            with open(target, "w", encoding="utf-8", newline="\n") as f:
                f.write("\n".join(lines) + "\n")

            sanitize_and_validate_cookie_file(target, target)
            self.add_log(f"Auto-imported cookies from {browser_name.capitalize()}! 1080p/4K unlocked.")
            return {
                "success": True,
                "message": f"Successfully extracted YouTube login cookies from {browser_name.capitalize()}! Full 1080p/4K unlocked."
            }
        except Exception as e:
            err = str(e)
            self.add_log(f"Auto-extract from {browser_name} failed: {err}")
            is_locked = any(kw in err.lower() for kw in ["permission denied", "could not copy", "locked", "database"])
            if is_locked:
                msg = f"{browser_name.capitalize()} database is locked because the browser is currently running. Close {browser_name.capitalize()} and retry, or use the 1-click Chrome Extension."
            else:
                msg = f"Extraction failed: {err}. Use the 1-click Chrome Extension instead."
            return {
                "success": False,
                "is_locked": is_locked,
                "error": msg
            }
