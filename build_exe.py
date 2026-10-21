"""
Automated Build Script for OmniMedia Pro (YouTube Bulk Downloader).
Compiles the modern desktop application into a standalone Windows .exe using PyInstaller.
"""

import os
import sys
import subprocess
import imageio_ffmpeg
from PIL import Image

def ensure_icon(assets_dir: str):
    ico_path = os.path.join(assets_dir, "app.ico")
    if not os.path.exists(ico_path):
        png_path = os.path.join(assets_dir, "OmniMedia.png")
        if os.path.exists(png_path):
            try:
                img = Image.open(png_path)
                img.save(ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
                print(f"[+] Generated application icon at: {ico_path}")
            except Exception as e:
                print(f"[-] Could not generate icon: {e}")
    return ico_path if os.path.exists(ico_path) else None

def build():
    print("==================================================")
    print(" Building OmniMedia Pro - Standalone Single .EXE")
    print("==================================================")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"[+] Bundling FFmpeg binary from: {ffmpeg_exe}")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    web_dir = os.path.join(base_dir, "web")
    assets_dir = os.path.join(base_dir, "assets")

    ico_path = ensure_icon(assets_dir)

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name", "OmniMedia_Pro",
        "--add-data", f"{web_dir};web",
        "--add-data", f"{assets_dir};assets",
        "--add-binary", f"{ffmpeg_exe};imageio_ffmpeg/binaries",
        "--add-binary", f"{ffmpeg_exe};.",
        "--collect-all", "yt_dlp",
        "--collect-all", "imageio_ffmpeg",
        "--collect-all", "webview",
        "--collect-all", "pythonnet",
        "--collect-all", "clr_loader",
    ]

    if ico_path:
        cmd.extend(["--icon", ico_path])

    cmd.append("main.py")

    print("[+] Running PyInstaller compilation...")
    result = subprocess.run(cmd)

    if result.returncode == 0:
        exe_path = os.path.join(base_dir, "dist", "OmniMedia_Pro.exe")
        print("\n==================================================")
        print(" BUILD SUCCEEDED! Standalone Single .EXE Ready!")
        print(f" Executable: {exe_path}")
        print(" This file is fully portable: distribute it directly!")
        print("==================================================")
    else:
        print(f"\n[-] Build failed with exit code: {result.returncode}")

if __name__ == "__main__":
    build()
