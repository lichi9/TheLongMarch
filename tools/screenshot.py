# -*- coding: utf-8 -*-
"""本地验收：用无头浏览器给页面截图。

    python tools/screenshot.py                     # 默认截 index.html
    python tools/screenshot.py map.html out.png    # 指定页面和输出
    python tools/screenshot.py map.html out.png "?demo=1"   # 带 URL 参数

三个必须知道的坑：

1. **系统 Chrome/Edge 正开着的时候，headless 截图会静默失败。**
   chrome.exe 检测到已有实例，会把参数转发过去然后自己退出，返回码 0，
   但既没有截图也没有报错。加 --user-data-dir、换 Edge、关沙箱全都不管用。
   2026-10-25 踩过一次：14 个 chrome 进程在跑，怎么截都是空的。

2. 所以这里优先用 Playwright 附带的 chrome-headless-shell。
   它是独立进程，不受系统浏览器占用影响。找不到才退回系统 Chrome。

3. 页面动画用 animation: ... both，from 帧是 opacity:0，必须加
   --force-prefers-reduced-motion 走降级分支，否则会截到一片空白。
"""
import os
import subprocess
import sys
import pathlib
import glob

ROOT = pathlib.Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 1) Playwright 的 headless shell：独立进程，首选
SHELLS = sorted(glob.glob(os.path.join(
    os.environ.get('LOCALAPPDATA', ''), 'ms-playwright',
    'chromium_headless_shell-*', 'chrome-headless-shell-win64',
    'chrome-headless-shell.exe')), reverse=True)

# 2) 系统浏览器：会被正在运行的实例干扰
SYSTEM = [
    r'C:/Program Files/Google/Chrome/Application/chrome.exe',
    r'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    r'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    r'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]


def pick():
    for p in SHELLS:
        if os.path.exists(p):
            return p, True
    for p in SYSTEM:
        if os.path.exists(p):
            return p, False
    sys.exit('没找到可用的浏览器')


def shot(page, out, w=1280, h=720, query=''):
    exe, is_shell = pick()
    url = (ROOT / page).as_uri() + query
    cmd = [exe]
    if not is_shell:
        cmd.append('--headless=new')
    cmd += [
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        '--force-prefers-reduced-motion',
        '--run-all-compositor-stages-before-draw',
        '--force-device-scale-factor=1',
        '--window-size=%d,%d' % (w, h),
        '--virtual-time-budget=12000',   # 给足时间，否则入场动画会停在半透明中间态
        '--screenshot=' + str(ROOT / out),
        url,
    ]
    subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    ok = (ROOT / out).exists()
    print('%s | %s | %s' % ('OK  ' if ok else 'FAIL', os.path.basename(exe), out))
    if not ok:
        print('  提示：系统浏览器开着时 headless 会被单实例机制吞掉，需要 chrome-headless-shell')
    return ok


if __name__ == '__main__':
    page = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
    out = sys.argv[2] if len(sys.argv) > 2 else '.workbuddy/tmp/shot.png'
    q = sys.argv[3] if len(sys.argv) > 3 else ''
    shot(page, out, query=q)
