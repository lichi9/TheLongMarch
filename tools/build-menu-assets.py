# -*- coding: utf-8 -*-
"""从原始菜单图切出标题和三个按钮。

用法：
    python tools/build-menu-assets.py

输入  assets/brand/source/menu-source.jpg
输出  assets/brand/menu/{btn-start,btn-continue,btn-exit}.png

源图已经随素材定稿删除（2026-10-23）。要重做按钮，把原菜单图放回上面的路径再跑一次就行。

两个关键处理，换成新图时如果效果不对，先查这两处：

1. 白底转透明用硬边（min(R,G,B) < 240 判为内容）。
   不要做 232~244 的软过渡——半透明像素的 RGB 仍然是白的，
   叠到深色背景上会泛一圈白边。

2. 缩放走预乘 alpha：先把 RGB 乘上 alpha 再缩，缩完除回去。
   否则 PIL 会把透明区的颜色（这里是黑）插值进边缘，同样出白边。

纵向分界（BANDS）是量出来的：518 和 626 附近是纯空白行。
换一张排版不同的图，需要重新量。
"""
import os
import sys

try:
    from PIL import Image, ImageChops, ImageFilter
except ImportError:
    sys.exit('需要 Pillow：pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'brand', 'source', 'menu-source.jpg')
OUT = os.path.join(ROOT, 'assets', 'brand', 'menu')

# 纵向范围, 目标宽度
BANDS = {
    # 标题已经改成 index.html 里的 SVG（矢量、可自由调宽高比），不再从图里裁。
    # 这里只负责三个按钮。
    'btn-start':    (522, 625, 520),
    'btn-continue': (646, 748, 520),
    'btn-exit':     (771, 876, 520),
}
BTN_X = (545, 1122)     # 三个按钮统一横向范围，保证叠放时左右对齐
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
        sys.exit('找不到原始菜单图：%s' % SRC)
    os.makedirs(OUT, exist_ok=True)

    im = Image.open(SRC).convert('RGB')
    W, H = im.size
    src = im.load()

    def bbox(y0, y1, x0, x1):
        xmin, xmax, ymin, ymax = W, 0, H, 0
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if min(src[x, y]) < THRESH:
                    if x < xmin: xmin = x
                    if x > xmax: xmax = x
                    if y < ymin: ymin = y
                    if y > ymax: ymax = y
        return xmin, ymin, xmax, ymax

    def cut(y0, y1, x0, x1, pad=8, soft=1):
        """裁切并抠掉白底，保留笔刷边缘的渐变。

        红笔刷的边缘是「红慢慢淡入白」的飞白，不是硬边。按阈值一刀切的话，
        这层渐变会被整片砍掉，看起来就像被剪刀裁过。

        做法：
        - 标出纯白（min >= 246）作为「外面」
        - 膨胀 soft 像素，得到一圈过渡带
        - 过渡带按白占比给 alpha：a = 255 - min(R,G,B)
          纯白 a=0、淡红 (240,192,192) a=63、中红 (200,80,80) a=175
        - 过渡带以外一律不透明

        高饱和像素（金色、深红）保底 a >= 200，避免星星和字被削成半透明。

        光有 alpha 还不够：淡红像素的 RGB 本身是「红 + 白」，直接半透明叠上去
        会发白发灰。所以按 C = a·F + (1−a)·255 反解出真正的 F，
        边缘才会是饱和的红，而不是一层雾。
        """
        x0 = max(0, x0 - pad); x1 = min(W - 1, x1 + pad)
        y0 = max(0, y0 - pad); y1 = min(H - 1, y1 + pad)
        w, h = x1 - x0 + 1, y1 - y0 + 1

        outside = Image.new('L', (w, h), 0)
        op_ = outside.load()
        for y in range(h):
            for x in range(w):
                if min(src[x0 + x, y0 + y]) >= 246:
                    op_[x, y] = 255

        bp = outside.filter(ImageFilter.MaxFilter(soft * 2 + 1)).load()

        out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        dst = out.load()
        for y in range(h):
            for x in range(w):
                r, g, b = src[x0 + x, y0 + y]
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
                fr = int(max(0, min(255, (r - white) / af)))
                fg = int(max(0, min(255, (g - white) / af)))
                fb = int(max(0, min(255, (b - white) / af)))
                dst[x, y] = (fr, fg, fb, a)
        return out

    for name, (y0, y1, tw) in BANDS.items():
        if name == 'title':
            bx0, by0, bx1, by1 = bbox(y0, y1, 0, W - 1)
        else:
            _, by0, _, by1 = bbox(y0, y1, BTN_X[0], BTN_X[1])
            bx0, bx1 = BTN_X
        img = premul_resize(cut(by0, by1, bx0, bx1), tw)
        p = os.path.join(OUT, name + '.png')
        img.save(p, optimize=True, compress_level=9)
        print('%-14s %4dx%-4d %7.1f KB' % (
            name, img.width, img.height, os.path.getsize(p) / 1024.0))


if __name__ == '__main__':
    main()
