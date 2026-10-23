# -*- coding: utf-8 -*-
"""从标题源图裁出标题，白底转透明。

    python tools/build-title.py             # 默认输出 922 宽（CSS 里显示 461，2 倍图）
    python tools/build-title.py 1200        # 指定输出宽度

输入  assets/brand/source/title-source.jpg
输出  assets/brand/menu/title.png

源图已经随素材定稿删除（2026-10-23）。要重做标题，把原图放回上面的路径再跑一次就行。

处理链和老版 build-menu-assets 一样，两个要点：
1. 白底用「纯白判定 + 1px 过渡带」，过渡带按白占比给 alpha，并反解颜色
   去掉混进去的白色。soft 不能开大 —— 开大了边缘会糊成一片雾。
2. 缩放走预乘 alpha，否则 PIL 会把透明区的颜色插值进边缘，出白边。
"""
import os
import sys

try:
    from PIL import Image, ImageChops, ImageFilter
except ImportError:
    sys.exit('需要 Pillow：pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'brand', 'source', 'title-source.jpg')
OUT = os.path.join(ROOT, 'assets', 'brand', 'menu', 'title.png')

TARGET_W = int(sys.argv[1]) if len(sys.argv) > 1 else 922
PAD = 8
THRESH = 240


def unpremul(pre_img, a_img):
    w, h = pre_img.size
    pre = pre_img.load()
    a = a_img.load()
    out = Image.new('RGB', (w, h))
    o = out.load()
    for y in range(h):
        for x in range(w):
            av = a[x, y]
            if av == 0:
                continue
            r, g, b = pre[x, y]
            o[x, y] = (min(255, r * 255 // av),
                       min(255, g * 255 // av),
                       min(255, b * 255 // av))
    return out


def premul_resize(img, tw):
    if img.width <= tw:
        return img
    th = max(1, round(img.height * tw / img.width))
    a = img.getchannel('A')
    r, g, b = img.convert('RGB').split()
    pre = Image.merge('RGB', (ImageChops.multiply(r, a),
                              ImageChops.multiply(g, a),
                              ImageChops.multiply(b, a)))
    pre_s = pre.resize((tw, th), Image.LANCZOS)
    a_s = a.resize((tw, th), Image.LANCZOS)
    return Image.merge('RGBA', unpremul(pre_s, a_s).split() + (a_s,))


def main():
    if not os.path.exists(SRC):
        sys.exit('找不到标题源图：%s' % SRC)

    im = Image.open(SRC).convert('RGB')
    W, H = im.size
    px = im.load()

    xmin, xmax, ymin, ymax = W, 0, H, 0
    for y in range(H):
        for x in range(W):
            if min(px[x, y]) < THRESH:
                if x < xmin: xmin = x
                if x > xmax: xmax = x
                if y < ymin: ymin = y
                if y > ymax: ymax = y

    x0 = max(0, xmin - PAD); x1 = min(W - 1, xmax + PAD)
    y0 = max(0, ymin - PAD); y1 = min(H - 1, ymax + PAD)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    print('content %dx%d  ratio %.2f' % (w, h, w / float(h)))

    # 纯白区 -> 膨胀 1px 得到过渡带，只在这圈里做透明化。
    # 注意别对全图做反解：反解是除法，会把 JPEG 噪点一起放大，
    # 整张图会变脏。宁可留少量白边，也不能让画面起颗粒。
    outside = Image.new('L', (w, h), 0)
    op_ = outside.load()
    for y in range(h):
        for x in range(w):
            if min(px[x0 + x, y0 + y]) >= 246:
                op_[x, y] = 255
    bp = outside.filter(ImageFilter.MaxFilter(3)).load()

    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dst = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x0 + x, y0 + y]
            if bp[x, y] == 0:
                dst[x, y] = (r, g, b, 255)
                continue
            mn = min(r, g, b)
            mx = max(r, g, b)
            a = 255 - mn
            if mx > 0 and (mx - mn) / float(mx) > 0.5:
                a = max(a, 200)
            if a < 8:
                dst[x, y] = (r, g, b, 0)
                continue
            af = a / 255.0
            white = 255 * (1 - af)
            dst[x, y] = (
                int(max(0, min(255, (r - white) / af))),
                int(max(0, min(255, (g - white) / af))),
                int(max(0, min(255, (b - white) / af))),
                a,
            )

    img = premul_resize(img, TARGET_W)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, optimize=True, compress_level=9)
    print('%dx%d  %.1f KB  -> %s' % (
        img.width, img.height, os.path.getsize(OUT) / 1024.0, OUT))


if __name__ == '__main__':
    main()
