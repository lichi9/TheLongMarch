# -*- coding: utf-8 -*-
"""本地验收：用无头 Chrome 给页面截图。

    python tools/screenshot.py                    # 默认截 index.html
    python tools/screenshot.py index.html a.png    # 指定页面和输出

要点：
- 必须加 --force-prefers-reduced-motion。页面动画用 animation: ... both，
  from 帧是 opacity:0；headless 的 virtual time 不保证能把动画推完，
  不加这个标志会截到一片空白（只看到背景）。
- 用 subprocess 传参而不是拼命令行，避开中文路径的编码问题。
"""
import os
import subprocess
import sys
import pathlib

ROOT = pathlib.Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CANDIDATES = [
    r'C:/Program Files/Google/Chrome/Application/chrome.exe',
    r'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    r'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    r'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]


def find_browser():
    for p in CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit('没找到 Chrome 或 Edge')


def shot(page, out, w=1280, h=720, query=''):
    url = (ROOT / page).as_uri() + query
    cmd = [
        find_browser(),
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--no-first-run',
        '--no-default-browser-check',
        '--run-all-compositor-stages-before-draw',
        '--force-prefers-reduced-motion',
        '--window-size=%d,%d' % (w, h),
        '--virtual-time-budget=4000',
        '--screenshot=' + str(ROOT / out),
        url,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    print('exit %s -> %s' % (r.returncode, out))
    return r.returncode


if __name__ == '__main__':
    page = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
    out = sys.argv[2] if len(sys.argv) > 2 else '.workbuddy/shot.png'
    shot(page, out)
