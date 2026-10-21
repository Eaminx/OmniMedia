"""
OmniMedia Pro - Robust Netscape Cookie Manager & Sanitizer
Provides bulletproof cookie parsing, format sanitization, JSON auto-conversion,
and ensures yt-dlp never crashes with 'does not look like a Netscape format cookies file'.
"""

import os
import re
import json
import time
import email.utils
import http.cookiejar
from typing import Optional, Tuple, List, Dict, Any

NETSCAPE_MAGIC = "# Netscape HTTP Cookie File"

def get_cookie_file_path() -> str:
    """Returns absolute path to cookies.txt in user local AppData profile to protect credentials."""
    profile_dir = os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'OmniMediaPro_WebProfile')
    os.makedirs(profile_dir, exist_ok=True)
    target_path = os.path.join(profile_dir, "cookies.txt")

    # Auto-migrate legacy root cookies.txt if present
    root_cookie = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cookies.txt")
    if os.path.exists(root_cookie) and root_cookie != target_path:
        try:
            if not os.path.exists(target_path) or os.path.getsize(target_path) == 0:
                with open(root_cookie, "rb") as rf, open(target_path, "wb") as tf:
                    tf.write(rf.read())
            os.remove(root_cookie)
        except Exception:
            pass

    return target_path

def is_valid_netscape_file(filepath: str) -> bool:
    """Check if a file can be successfully parsed as a Netscape cookie file by MozillaCookieJar."""
    if not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
        return False
    try:
        cj = http.cookiejar.MozillaCookieJar(filepath)
        cj.load(ignore_discard=True, ignore_expires=True)
        return len(cj) > 0
    except Exception:
        return False

def sanitize_and_validate_cookie_file(source_path: str, target_path: Optional[str] = None) -> Tuple[bool, str, int]:
    """
    Sanitize, repair, and convert any cookie file into a guaranteed valid Netscape format.
    Handles:
    - JSON cookie exports (Cookie-Editor, EditThisCookie, etc.)
    - UTF-8 BOM, UTF-16, latin1 encodings
    - Space-separated instead of tab-separated lines
    - Missing Netscape magic headers
    - Empty or corrupt lines
    Returns: (success: bool, message: str, cookie_count: int)
    """
    if target_path is None:
        target_path = get_cookie_file_path()

    if not os.path.exists(source_path):
        return False, "Source file does not exist", 0

    try:
        # Read raw content in binary first to detect BOM
        with open(source_path, "rb") as f:
            raw = f.read()

        if not raw or not raw.strip():
            return False, "Selected cookie file is empty", 0

        # Strip UTF-8 BOM if present
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]

        # Decode safely
        text = ""
        for enc in ["utf-8", "utf-16", "cp1252", "latin-1"]:
            try:
                text = raw.decode(enc)
                break
            except Exception:
                continue

        if not text:
            return False, "Could not decode cookie file encoding", 0

        text = text.strip()

        # 1. Check if it's JSON format (e.g. from Cookie-Editor JSON export)
        if (text.startswith("[") and text.endswith("]")) or (text.startswith("{") and text.endswith("}")):
            try:
                data = json.loads(text)
                if isinstance(data, dict):
                    data = data.get("cookies", [data])
                if isinstance(data, list):
                    lines = [
                        NETSCAPE_MAGIC,
                        "# Converted from JSON by OmniMedia Pro",
                        ""
                    ]
                    count = 0
                    for c in data:
                        if not isinstance(c, dict):
                            continue
                        name = c.get("name")
                        val = c.get("value")
                        if not name or val is None:
                            continue
                        domain = c.get("domain", ".youtube.com")
                        flag = "TRUE" if domain.startswith(".") else "FALSE"
                        path = c.get("path", "/")
                        secure = "TRUE" if c.get("secure", True) else "FALSE"
                        exp = c.get("expirationDate") or c.get("expires") or 0
                        exp_str = str(int(float(exp))) if exp else "0"
                        lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{exp_str}\t{name}\t{val}")
                        count += 1

                    if count > 0:
                        with open(target_path, "w", encoding="utf-8", newline="\n") as f:
                            f.write("\n".join(lines) + "\n")
                        if is_valid_netscape_file(target_path):
                            return True, f"Auto-converted {count} JSON cookies into Netscape format!", count
            except Exception:
                pass

        # 2. Text format: sanitize lines
        raw_lines = text.splitlines()
        cookie_lines = []
        for line in raw_lines:
            line_str = line.strip()
            if not line_str:
                continue
            # Ignore comments and headers
            if line_str.startswith("#"):
                continue

            # Check if separated by tabs or spaces
            parts = line_str.split("\t")
            if len(parts) < 7:
                # Try splitting by whitespace if user copied space-delimited text
                parts = re.split(r"\s+", line_str, maxsplit=6)

            if len(parts) >= 7:
                domain, flag, path, secure, expires, name = parts[:6]
                val = parts[6] if len(parts) > 6 else ""
                flag = "TRUE" if flag.upper() in ["TRUE", "1"] else "FALSE"
                secure = "TRUE" if secure.upper() in ["TRUE", "1"] else "FALSE"
                try:
                    exp_val = str(int(float(expires)))
                except Exception:
                    exp_val = "0"
                cookie_lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{exp_val}\t{name}\t{val}")

        if not cookie_lines:
            return False, "No valid cookie entries found in file", 0

        final_content = (
            f"{NETSCAPE_MAGIC}\n"
            "# Sanitized and formatted by OmniMedia Pro\n\n"
            + "\n".join(cookie_lines)
            + "\n"
        )

        with open(target_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(final_content)

        if is_valid_netscape_file(target_path):
            return True, f"Successfully loaded and formatted {len(cookie_lines)} cookies!", len(cookie_lines)
        else:
            return False, "File could not be verified as Netscape format", 0

    except Exception as e:
        return False, f"Cookie processing error: {e}", 0

def get_safe_cookie_file() -> Optional[str]:
    """
    Returns valid cookie file path for yt-dlp if and only if cookies.txt exists and is valid.
    Auto-repairs common formatting defects (missing headers, BOM, spaces).
    If cookies.txt is invalid or broken, returns None so yt-dlp continues downloading without crashing!
    """
    cookie_file = get_cookie_file_path()
    if not os.path.exists(cookie_file) or os.path.getsize(cookie_file) == 0:
        return None

    # Check if already valid
    try:
        cj = http.cookiejar.MozillaCookieJar(cookie_file)
        cj.load(ignore_discard=True, ignore_expires=True)
        if len(cj) > 0:
            return cookie_file
    except Exception:
        pass

    # Attempt in-place sanitization
    try:
        ok, msg, count = sanitize_and_validate_cookie_file(cookie_file, cookie_file)
        if ok and count > 0:
            return cookie_file
    except Exception:
        pass

    # If completely unfixable, return None to prevent yt-dlp from aborting with Netscape LoadError!
    return None

def parse_and_write_cookies(cookie_list: List[Dict[str, Any]], target_path: Optional[str] = None) -> int:
    """Parse SimpleCookie / morsel objects from WebView2 into Netscape format for yt-dlp."""
    if target_path is None:
        target_path = get_cookie_file_path()

    lines = [
        NETSCAPE_MAGIC,
        "# Exported automatically by OmniMedia Pro In-App Login",
        ""
    ]
    count = 0
    for sc in cookie_list:
        for name, morsel in sc.items():
            domain = morsel['domain'] or '.youtube.com'
            flag = "TRUE" if domain.startswith(".") else "FALSE"
            path = morsel['path'] or "/"
            secure = "TRUE" if morsel['secure'] else "FALSE"
            exp_str = morsel['expires']
            expires = 0
            if exp_str:
                try:
                    expires = int(email.utils.parsedate_to_datetime(exp_str).timestamp())
                except Exception:
                    expires = int(time.time()) + 3600 * 24 * 365
            lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{expires}\t{name}\t{morsel.value}")
            count += 1

    if count > 0:
        with open(target_path, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(lines) + "\n")
    return count
