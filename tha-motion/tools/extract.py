"""Cut every animated element out of assets/reference.jpg into transparent PNG layers + manifest.json."""
import json, sys
import numpy as np
from PIL import Image
from collections import deque

im = np.array(Image.open('assets/reference.jpg').convert('RGB')).astype(float)
H, W, _ = im.shape
CREAM = np.array([247, 242, 232.])
BLUE = np.array([150, 168, 189.])
GOLD = np.array([243, 198, 129.])
CORAL = np.array([217, 126, 105.])

def alpha_for(fg, bg, region):
    """alpha by projecting each pixel onto the bg->fg colour line"""
    d = fg - bg
    a = ((im - bg) @ d) / (d @ d)
    a = np.clip(a, 0, 1)
    # residual: reject pixels that are not on the bg-fg line (borders, other colours)
    proj = bg + a[..., None] * d
    res = np.abs(im - proj).sum(-1)
    a[res > 60] = 0
    m = np.zeros((H, W), bool); y0, y1, x0, x1 = region; m[y0:y1, x0:x1] = True
    a[~m] = 0
    a[a < 0.04] = 0
    return a

def label_layer(name, bg, region, pad=4):
    y0, y1, x0, x1 = region
    sub = im[y0:y1, x0:x1]
    diff = np.abs(sub - bg).sum(-1)
    a = np.clip(diff / 70.0, 0, 1)
    a[diff < 14] = 0
    safe = np.where(a > 0, a, 1)[..., None]
    col = np.clip(bg + (sub - bg) / safe, 0, 255)
    ys, xs = np.nonzero(a > 0)
    Y0, Y1, X0, X1 = max(0, ys.min() - pad), ys.max() + pad + 1, max(0, xs.min() - pad), xs.max() + pad + 1
    out = np.zeros((Y1 - Y0, X1 - X0, 4), np.uint8)
    out[..., :3] = col[Y0:Y1, X0:X1].astype(np.uint8); out[..., 3] = (a[Y0:Y1, X0:X1] * 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'assets/{name}.png')
    return dict(name=name, x=int(x0 + X0), y=int(y0 + Y0), w=int(X1 - X0), h=int(Y1 - Y0))

def components(a, thr=0.3, min_px=30):
    mask = a > thr
    lab = np.zeros((H, W), int); n = 0; comps = []
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if lab[y, x]: continue
        n += 1; q = deque([(y, x)]); lab[y, x] = n; pts = []
        while q:
            cy, cx = q.popleft(); pts.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n; q.append((ny, nx))
        if len(pts) >= min_px: comps.append(pts)
    return lab, comps

def save_layer(name, a, color, pts, pad=6):
    ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
    y0, y1, x0, x1 = min(ys) - pad, max(ys) + pad + 1, min(xs) - pad, max(xs) + pad + 1
    # include soft AA pixels around the component
    sub = a[y0:y1, x0:x1].copy()
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = color
    out[..., 3] = (sub * 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'assets/{name}.png')
    return dict(name=name, x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0))

manifest = {}
# 1. big letter (blue on cream, inside panel)
a = alpha_for(BLUE, CREAM, (232, 848, 218, 850))
lab, comps = components(a)
comps.sort(key=lambda p: -len(p))
print('big letter comps', [(len(c), min(p[1] for p in c), min(p[0] for p in c)) for c in comps])
# split: the body = largest; dots = 3 others
body = comps[0]; dots = comps[1:4]
keep = np.zeros((H, W), bool)
for c in comps[:4]:
    for y, x in c: keep[y, x] = True
# dilate keep by 3px so AA edges are retained
from itertools import product
k = keep.copy()
for dy, dx in product(range(-3, 4), repeat=2):
    k |= np.roll(np.roll(keep, dy, 0), dx, 1)
a_big = np.where(k, a, 0)
# build the body-only alpha: restrict to bbox of body minus dots areas
def restrict(a_, comp_pts, pad=4):
    m = np.zeros((H, W), bool)
    for y, x in comp_pts: m[y, x] = True
    mm = m.copy()
    for dy, dx in product(range(-pad, pad + 1), repeat=2):
        mm |= np.roll(np.roll(m, dy, 0), dx, 1)
    return np.where(mm, a_, 0)
manifest['big_body'] = save_layer('big_body', restrict(a_big, body), BLUE, body)
_cen = [(np.mean([p[1] for p in c]), np.mean([p[0] for p in c]), c) for c in dots]
_top = min(_cen, key=lambda t: t[1]); _rest = sorted([t for t in _cen if t is not _top], key=lambda t: -t[0])
dots_sorted = [t[2] for t in _rest + [_top]]
names = []
for i, c in enumerate(dots_sorted):
    nm = f'big_dot{i}'
    manifest[nm] = save_layer(nm, restrict(a_big, c), BLUE, c)
    manifest[nm]['cx'] = float(np.mean([p[1] for p in c])); manifest[nm]['cy'] = float(np.mean([p[0] for p in c]))
manifest['label_main'] = label_layer('label_main', CREAM, (740, 830, 230, 400))
# 3. small letters (gold on blue): body, vowel mark, 3 dots each
for nm, (x0, x1) in dict(thu=(215, 400), thi=(450, 640), tha=(690, 880)).items():
    a = alpha_for(GOLD, BLUE, (880, 1074, x0, x1))
    lab, comps = components(a, min_px=15)
    comps.sort(key=lambda c: -len(c))
    body, mark, dts = comps[0], comps[1], comps[2:5]
    assert len(comps) == 5, len(comps)
    manifest[f's_{nm}_body'] = save_layer(f's_{nm}_body', restrict(a, body), GOLD, body)
    manifest[f's_{nm}_mark'] = save_layer(f's_{nm}_mark', restrict(a, mark), GOLD, mark)
    # dots ordered: right, left, top (same order as the big letter)
    cen = [(np.mean([p[1] for p in c]), np.mean([p[0] for p in c]), c) for c in dts]
    top = min(cen, key=lambda t: t[1]); rest = sorted([t for t in cen if t is not top], key=lambda t: -t[0])
    for i, (cx, cy, c) in enumerate(rest + [top]):
        n2 = f's_{nm}_dot{i}'
        manifest[n2] = save_layer(n2, restrict(a, c), GOLD, c)
        manifest[n2]['cx'] = float(cx); manifest[n2]['cy'] = float(cy)
# 4. labels thu/thi/tha (coral on blue) y 1070-1130
for nm, (x0, x1) in dict(lab_thu=(250, 370), lab_thi=(490, 600), lab_tha=(730, 840)).items():
    manifest[nm] = label_layer(nm, BLUE, (1074, 1132, x0, x1))
json.dump(manifest, open('assets/manifest.json', 'w'), indent=1, default=float)
