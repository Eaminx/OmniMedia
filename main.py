"""
YouTube Bulk & Shorts Downloader - Desktop Launcher
Powered by PyWebView & Edge WebView2 GPU-Accelerated Engine.
"""

import os
import sys
import shutil
import webview
from api import DesktopAPI, set_main_window

def main():
    api = DesktopAPI()
    base_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    index_file = os.path.join(base_dir, "web", "index.html")

    if not os.path.exists(index_file):
        print(f"Error: Could not locate frontend at {index_file}")
        sys.exit(1)

    storage_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'OmniMediaPro_WebProfile')
    
    # Auto-purge stale compiled WebView2 cache so UI updates always reflect immediately
    try:
        for c_sub in ["Cache", "Code Cache", "GPUCache", "DawnGraphiteCache", "DawnWebGPUCache"]:
            c_dir = os.path.join(storage_path, "EBWebView", "Default", c_sub)
            if os.path.exists(c_dir):
                shutil.rmtree(c_dir, ignore_errors=True)
    except Exception:
        pass

    window = webview.create_window(
        title="OmniMedia Pro - Multi-Platform Bulk Media Downloader",
        url=index_file,
        js_api=api,
        width=1100,
        height=664,
        min_size=(720, 480),
        background_color="#06070a",
        text_select=True
    )

    set_main_window(window)

    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    # Launch PyWebView with persistent profile and Edge WebView2 engine
    webview.start(debug=False, private_mode=False, storage_path=storage_path, user_agent=user_agent)

if __name__ == "__main__":
    main()

