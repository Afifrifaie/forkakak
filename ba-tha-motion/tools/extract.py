"""Cut every animated element out of the two reference cards into transparent PNG layers + manifest.json.
   Big letter pieces are saved at 3x (smooth up-sampled alpha) so they stay crisp when the camera zooms in."""
import json
import numpy as np
from PIL import Image
from collections import deque

SS = 3
ba = np.array(Image.open('assets/reference_ba.png').convert('RGB')).astype(float)
th = np.array(Image.open('assets/reference_tha.jpg').convert('RGB')).astype(float)
H, W, _ = ba.shape
CREAM = np.array([247, 242, 232.]); BLUE = np.array([150, 168, 189.]); GOLD = np.array([243, 198, 129.]); CORAL = np.array([217, 126, 105.])
man = {}

def alpha_for(im, fg, bg, region, resid=True):
    d = fg - bg; a = np.clip(((im - bg) @ d) / (d @ d), 0, 1)
    if resid:
        proj = bg + a[..., None] * d; a[np.abs(im - proj).sum(-1) > 60] = 0
    y0, y1, x0, x1 = region; m = np.zeros(a.shape, bool); m[y0:y1, x0:x1] = True; a[~m] = 0; a[a < 0.04] = 0
    return a

def comps(a, thr=0.3, min_px=30):
    mask = a > thr; lab = np.zeros(a.shape, int); out = []; n = 0
    for y, x in zip(*np.nonzero(mask)):
        if lab[y, x]: continue
        n += 1; q = deque([(y, x)]); lab[y, x] = n; pts = []
        while q:
            cy, cx = q.popleft(); pts.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < a.shape[0] and 0 <= nx < a.shape[1] and mask[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; q.append((ny, nx))
        if len(pts) >= min_px: out.append(pts)
    return out

def keep_only(a, pts, pad=4):
    m = np.zeros(a.shape, bool)
    for y, x in pts: m[y, x] = True
    mm = m.copy()
    for dy in range(-pad, pad + 1):
        for dx in range(-pad, pad + 1): mm |= np.roll(np.roll(m, dy, 0), dx, 1)
    return np.where(mm, a, 0)

def bbox(pts, pad=6):
    ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
    return min(ys) - pad, max(ys) + pad + 1, min(xs) - pad, max(xs) + pad + 1

def save(name, a, color, box, scale=1, extra=None):
    y0, y1, x0, x1 = box; sub = a[y0:y1, x0:x1]
    if scale > 1:
        im = Image.fromarray(sub.astype(np.float32), 'F').resize(((x1 - x0) * scale, (y1 - y0) * scale), Image.LANCZOS)
        up = np.clip(np.array(im), 0, 1); t = np.clip((up - 0.25) / 0.5, 0, 1); sub = t * t * (3 - 2 * t)   # re-sharpened edge: crisp at 3x
    out = np.zeros(sub.shape + (4,), np.uint8); out[..., 0], out[..., 1], out[..., 2] = color; out[..., 3] = (sub * 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'assets/{name}.png')
    man[name] = dict(x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), scale=scale, **(extra or {}))

def label(name, im, bg, region, scale=1, cut_right_gap=False, pad=4):
    y0, y1, x0, x1 = region; sub = im[y0:y1, x0:x1]
    diff = np.abs(sub - bg).sum(-1); al = np.clip(diff / 70.0, 0, 1); al[diff < 14] = 0
    if cut_right_gap:                                     # drop the apostrophe = the right-most connected component
        cs_ = comps(al, 0.3, 4); ap = max(cs_, key=lambda c: np.mean([p[1] for p in c]))
        ax0 = min(p[1] for p in ap) - 2; al[:, ax0:] = 0
    ys, xs = np.nonzero(al > 0); Y0, Y1, X0, X1 = max(0, ys.min() - pad), ys.max() + pad + 1, max(0, xs.min() - pad), xs.max() + pad + 1
    col = np.clip(bg + (sub - bg) / np.where(al > 0, al, 1)[..., None], 0, 255)
    pm = (col * al[..., None])[Y0:Y1, X0:X1]; a = al[Y0:Y1, X0:X1]
    if scale > 1:
        S = lambda arr: np.array(Image.fromarray(arr.astype(np.float32), 'F').resize((arr.shape[1] * scale, arr.shape[0] * scale), Image.LANCZOS))
        a2 = np.clip(S(a), 0, 1); pm2 = np.stack([S(pm[..., c]) for c in range(3)], -1)
        col2 = np.clip(pm2 / np.maximum(a2, 1e-3)[..., None], 0, 255); t = np.clip((a2 - 0.15) / 0.7, 0, 1); a = t * t * (3 - 2 * t); col = col2
    else: col = pm / np.maximum(a, 1e-3)[..., None]
    out = np.zeros(a.shape + (4,), np.uint8); out[..., :3] = np.clip(col, 0, 255).astype(np.uint8); out[..., 3] = (a * 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'assets/{name}.png')
    man[name] = dict(x=int(x0 + X0), y=int(y0 + Y0), w=int(X1 - X0), h=int(Y1 - Y0), scale=scale)

# ---- big isolated ba (body + dot), 3x ----
a = alpha_for(ba, BLUE, CREAM, (400, 760, 300, 760), resid=False)
cs = sorted(comps(a), key=lambda c: -len(c)); body, dot = cs[0], cs[1]
print('ba comps', [len(c) for c in cs])
save('ba_body', keep_only(a, body), BLUE, bbox(body), SS)
save('ba_dot', keep_only(a, dot), BLUE, bbox(dot), SS, dict(cx=float(np.mean([p[1] for p in dot])), cy=float(np.mean([p[0] for p in dot]))))
# ---- where the tha bowl/dots sit relative to the ba bowl (same bowl, shifted) ----
at = alpha_for(th, BLUE, CREAM, (360, 700, 300, 760), resid=False)
tc = sorted(comps(at), key=lambda c: -len(c))
tbody = np.zeros(at.shape, bool)
for y, x in tc[0]: tbody[y, x] = True
bbody = np.zeros(a.shape, bool)
for y, x in body: bbody[y, x] = True
best = (0, 0, 0)
for dy in range(34, 48):
    for dx in range(0, 12):
        sh = np.roll(np.roll(bbody, dy, 0), dx, 1)[540:680, 380:660]; t = tbody[540:680, 380:660]
        iou = (sh & t).sum() / (sh | t).sum()
        if iou > best[0]: best = (iou, dx, dy)
print('tha bowl = ba bowl shifted by', best)
dots_th = [(float(np.mean([p[1] for p in c])), float(np.mean([p[0] for p in c]))) for c in tc[1:4]]
_top = min(dots_th, key=lambda t: t[1]); _rest = sorted([t for t in dots_th if t is not _top], key=lambda t: -t[0])
man['tha_shift'] = dict(dx=best[1], dy=best[2]); man['tha_dots'] = [dict(cx=t[0] - best[1], cy=t[1] - best[2]) for t in _rest + [_top]]   # in the ba bowl's frame
# ---- ba' label (coral on cream) and caption pieces ----
label('label_ba', ba, CREAM, (760, 830, 255, 350))
label('cap_ba', ba, CREAM, (760, 830, 255, 350), SS, cut_right_gap=True)
label('cap_tha', th, CREAM, (740, 830, 230, 400), SS, cut_right_gap=True)
# ---- small row: ba / bi / bu (gold on blue) ----
for nm, (x0, x1) in dict(bu=(215, 400), bi=(450, 640), ba=(690, 880)).items():
    aa = alpha_for(ba, GOLD, BLUE, (870, 1062, x0, x1))
    cc = sorted(comps(aa, min_px=15), key=lambda c: -len(c)); b = cc[0]
    bb = bbox(b); yb1 = max(p[0] for p in b)
    dts = [c for c in cc[1:] if np.mean([p[0] for p in c]) > yb1 - 30 and np.mean([p[0] for p in c]) < yb1 + 40 and len(c) < 450 and 24 < (max(p[1] for p in c) - min(p[1] for p in c)) < 42 and (max(p[0] for p in c) - min(p[0] for p in c)) < 40]
    dt = dts[0]; mk = [c for c in cc[1:] if c is not dt][0]
    print(nm, 'body', len(b), 'dot', len(dt), 'mark', len(mk), bbox(mk, 0))
    save(f's_{nm}_body', keep_only(aa, b), GOLD, bbox(b))
    save(f's_{nm}_dot', keep_only(aa, dt), GOLD, bbox(dt), 1, dict(cx=float(np.mean([p[1] for p in dt])), cy=float(np.mean([p[0] for p in dt]))))
    save(f's_{nm}_mark', keep_only(aa, mk), GOLD, bbox(mk))
for nm, (x0, x1) in dict(bu=(250, 370), bi=(490, 600), ba=(740, 850)).items():
    label(f'lab_{nm}', ba, BLUE, (1074, 1132, x0, x1))
json.dump(man, open('assets/manifest.json', 'w'), indent=1, default=float)
print({k: (v['x'], v['y'], v['w'], v['h']) for k, v in man.items() if isinstance(v, dict) and 'w' in v})
