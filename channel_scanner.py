"""
Multi-Platform Channel & Profile Scanner with Robust Channel Avatar Logo and Video Thumbnail Extraction.
Supports YouTube (@Channels, Shorts, Playlists), TikTok (@Profiles), Instagram & Facebook.
"""

import os
import re
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Callable, Optional
import yt_dlp
from downloader import format_duration, get_ffmpeg_path, detect_platform
from cookie_manager import get_safe_cookie_file

def extract_avatar_from_info(info_dict: Optional[Dict[str, Any]]) -> str:
    """Extract channel avatar / profile picture from yt-dlp metadata."""
    if not info_dict:
        return ""

    for field in ['uploader_avatar', 'avatar', 'channel_avatar', 'thumbnail']:
        val = info_dict.get(field)
        if isinstance(val, str) and val.startswith('http') and not val.endswith('.mp4'):
            return val

    thumbs = info_dict.get('thumbnails', [])
    if isinstance(thumbs, list):
        for t in thumbs:
            if isinstance(t, dict):
                if t.get('id') == 'avatar_uncropped' and t.get('url'):
                    return t.get('url')
                w = t.get('width', 0)
                h = t.get('height', 0)
                if w > 0 and w == h and t.get('url'):
                    return t.get('url')

        if thumbs and isinstance(thumbs[-1], dict) and thumbs[-1].get('url'):
            return thumbs[-1].get('url')

    return ""

def fetch_avatar_from_html(url: str) -> str:
    """Fast fallback to retrieve og:image avatar directly from channel page HTML."""
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            m = re.search(r'property=[\'"]og:image[\'"]\s+content=[\'"]([^\'"]+)[\'"]', html)
            if not m:
                m = re.search(r'content=[\'"]([^\'"]+)[\'"]\s+property=[\'"]og:image[\'"]', html)
            if m:
                img_url = m.group(1)
                if img_url.startswith('http'):
                    return img_url
    except Exception:
        pass
    return ""

class ScannedItem:
    def __init__(
        self,
        item_id: str,
        title: str,
        url: str,
        platform: str,
        is_short: bool,
        duration: Optional[int] = None,
        thumbnail: str = ""
    ):
        self.id = item_id
        self.title = title
        self.url = url
        self.platform = platform
        self.is_short = is_short
        self.duration = duration or 0
        self.duration_str = format_duration(self.duration)
        self.thumbnail = thumbnail
        self.selected = True

class ChannelScanner:
    def __init__(self):
        self.ffmpeg_path = get_ffmpeg_path()

    def normalize_url(self, raw_url: str) -> str:
        clean = raw_url.strip()
        if clean.startswith('@'):
            clean = f"https://www.youtube.com/{clean}"
        elif not clean.startswith('http://') and not clean.startswith('https://'):
            clean = f"https://{clean}"
        clean = re.sub(r'/(videos|shorts|featured|streams|playlists)/?$', '', clean)
        return clean.rstrip('/')

    def scan(
        self,
        url: str,
        filter_mode: str,
        max_results: Optional[int] = None,
        progress_callback: Optional[Callable[[str], None]] = None
    ) -> Dict[str, Any]:
        base_url = self.normalize_url(url)
        platform = detect_platform(base_url)

        is_playlist = False
        scan_targets = []
        if platform == 'youtube':
            is_playlist = 'playlist?list=' in base_url or '&list=' in base_url or '?list=' in base_url or '/playlist' in base_url
            if is_playlist:
                match = re.search(r'[?&]list=([a-zA-Z0-9_\-]+)', base_url)
                if match:
                    list_id = match.group(1)
                    if not list_id.startswith('RD') and not list_id.startswith('UL') and not list_id.startswith('RDAMVM'):
                        base_url = f"https://www.youtube.com/playlist?list={list_id}"
                scan_targets.append((base_url, None))
            else:
                if filter_mode == "All Videos":
                    scan_targets.append((f"{base_url}/videos", False))
                elif filter_mode == "All Shorts":
                    scan_targets.append((f"{base_url}/shorts", True))
                elif filter_mode == "Both (Videos & Shorts)":
                    scan_targets.append((f"{base_url}/videos", False))
                    scan_targets.append((f"{base_url}/shorts", True))
                else:
                    scan_targets.append((base_url, None))
        else:
            scan_targets.append((base_url, platform == 'tiktok'))

        items: List[ScannedItem] = []
        seen_ids = set()
        channel_meta = {
            "title": "",
            "avatar": "assets/OmniMedia.png" if is_playlist else "",
            "handle": "",
            "platform": platform,
            "is_playlist": is_playlist
        }

        # Try fast HTML avatar retrieval for YouTube channels (skip if playlist)
        if platform == 'youtube' and not channel_meta["avatar"] and not is_playlist:
            channel_meta["avatar"] = fetch_avatar_from_html(base_url)

        for target_url, force_short in scan_targets:
            if progress_callback:
                progress_callback(f"Scanning channel feed: {target_url}...")

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

            if max_results and max_results > 0:
                ydl_opts['playlist_items'] = f"1:{max_results}"

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    result = ydl.extract_info(target_url, download=False)
                    if not result:
                        continue

                    if not channel_meta["title"]:
                        channel_meta["title"] = result.get('channel') or result.get('uploader') or result.get('title') or "Channel"
                    
                    if not channel_meta["avatar"]:
                        avatar_from_ydl = extract_avatar_from_info(result)
                        if avatar_from_ydl:
                            channel_meta["avatar"] = avatar_from_ydl

                    if not channel_meta["handle"] and '@' in base_url:
                        handle_match = re.search(r'(@[a-zA-Z0-9_\-\.]+)', base_url)
                        if handle_match:
                            channel_meta["handle"] = handle_match.group(1)

                    entries = result.get('entries', [])
                    if not entries and 'id' in result:
                        entries = [result]

                    for entry in entries:
                        if not entry:
                            continue

                        entry_id = str(entry.get('id') or '')
                        if not entry_id or entry_id in seen_ids:
                            continue
                        seen_ids.add(entry_id)

                        title = entry.get('title') or f"Video {entry_id}"
                        duration = entry.get('duration') or 0
                        entry_url = entry.get('url') or entry.get('webpage_url')
                        
                        # High-res thumbnail resolution
                        thumb = entry.get('thumbnail') or ''
                        if not thumb:
                            thumbs_list = entry.get('thumbnails', [])
                            if thumbs_list and isinstance(thumbs_list, list) and isinstance(thumbs_list[-1], dict):
                                thumb = thumbs_list[-1].get('url', '')

                        # Reliable direct YouTube CDN thumbnail fallback
                        if not thumb and platform == 'youtube' and entry_id:
                            thumb = f"https://i.ytimg.com/vi/{entry_id}/hqdefault.jpg"

                        if not thumb:
                            thumb = "assets/OmniMedia.png"

                        if force_short is not None:
                            is_short = force_short
                        else:
                            is_short = (
                                (duration > 0 and duration <= 60)
                                or ('/shorts/' in str(entry_url))
                                or ('/reel/' in str(entry_url))
                                or ('shorts' in target_url)
                                or (platform == 'tiktok')
                            )

                        if not entry_url or not str(entry_url).startswith('http'):
                            if platform == 'youtube':
                                entry_url = f"https://www.youtube.com/shorts/{entry_id}" if is_short else f"https://www.youtube.com/watch?v={entry_id}"
                            else:
                                entry_url = target_url

                        items.append(ScannedItem(
                            item_id=entry_id,
                            title=title,
                            url=entry_url,
                            platform=platform,
                            is_short=is_short,
                            duration=duration,
                            thumbnail=thumb
                        ))

                        if max_results and len(items) >= max_results:
                            break

            except Exception as e:
                if progress_callback:
                    progress_callback(f"Notice on {target_url}: {str(e)}")

        if not channel_meta["title"]:
            if items:
                channel_meta["title"] = "YouTube Playlist" if is_playlist else f"{platform.capitalize()} Creator Feed"
            else:
                channel_meta["title"] = "YouTube Playlist" if is_playlist else "Creator Feed"

        if not channel_meta["avatar"]:
            channel_meta["avatar"] = "assets/OmniMedia.png"

        if progress_callback:
            progress_callback(f"Scanned {len(items)} videos from {channel_meta['title']}.")

        return {
            "channel": channel_meta,
            "items": items
        }
