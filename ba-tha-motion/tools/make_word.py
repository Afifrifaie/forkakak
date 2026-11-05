"""Builds the joined word بث from the card's own ب silhouette, as two hi-res layers + pen paths (merged into assets/manifest.json):
   word_th   = the card's bowl, right spike shortened to a small peak, slid left          (the final-form ث)
   word_base = a new short base stroke that carries the ب's tooth to the ث's peak          (the initial-form ب, joined to the isolated ب's tooth at x >= 640)
   The notch where the two letters meet comes from the union, softened with a small fillet."""
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
SS = 3; X0, X1, Y0, Y1 = 60, 820, 370, 760
CW, CH = (X1 - X0) * SS, (Y1 - Y0) * SS
S_SHIFT, K, XA, LB = 125, 0.55, 640, 112
man = json.load(open('assets/manifest.json')); l = man['ba_body']
src = np.array(Image.open('assets/ba_body.png'))[..., 3].astype(np.float32) / 255
iso = np.zeros((CH, CW), np.float32); iso[(l['y'] - Y0) * SS:(l['y'] - Y0) * SS + src.shape[0], (l['x'] - X0) * SS:(l['x'] - X0) * SS + src.shape[1]] = src
cx = lambda x: int(round((x - X0) * SS)); cy = lambda y: int(round((y - Y0) * SS))
# ث: compress the spike above the notch (y < 551) to a short peak, slide left
th = iso.copy(); yc = cy(551); H0 = 108 * SS
for c in range(cx(684), CW):
    for yy in range(yc - int(H0 * K), yc):
        sy = yc - (yc - yy) / K; i = int(sy); f = sy - i; th[yy, c] = iso[i, c] * (1 - f) + iso[i + 1, c] * f
    th[:yc - int(H0 * K), c] = 0
sh = S_SHIFT * SS; th = np.roll(th, -sh, 1); th[:, CW - sh:] = 0
# ب: the isolated tooth/wall/curve (x >= 640, kept from the isolated glyph) + a new base stroke
A = iso.copy(); A[:, :cx(XA)] = 0
def bez(p0, p1, p2, p3, n=60):
    t = np.linspace(0, 1, n)[:, None]; p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3)); return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
xe = XA - LB
top = bez((XA + 2, 567), (XA - 30, 567.5), (xe + 30, 568), (xe, 572)); bot = bez((XA + 2, 618), (XA - 22, 636), (xe + 50, 642), (xe, 598))
big = Image.new('L', (CW * 2, CH * 2), 0); ImageDraw.Draw(big).polygon([((x - X0) * SS * 2, (y - Y0) * SS * 2) for x, y in list(top) + list(bot[::-1])], fill=255)
base = np.array(big.resize((CW, CH), Image.LANCZOS)).astype(np.float32) / 255
union = np.maximum(np.maximum(A, base), th)
jx = cx(xe); win = np.zeros_like(union); win[:, max(0, jx - 60 * SS):jx + 60 * SS] = 1
bl = np.array(Image.fromarray((union * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3.2))).astype(np.float32) / 255
fillet = np.clip(np.clip((bl - 0.5) * 3 + 0.5, 0, 1) - union, 0, 1) * win
th_final = np.maximum(th, fillet)
def save(name, a):
    ys, xs = np.nonzero(a > 0.01); y0, y1, x0, x1 = (ys.min() // SS - 3), (ys.max() // SS + 4), (xs.min() // SS - 3), (xs.max() // SS + 4)
    sub = a[y0 * SS:y1 * SS, x0 * SS:x1 * SS]; out = np.zeros(sub.shape + (4,), np.uint8); out[..., 0], out[..., 1], out[..., 2] = 150, 168, 189; out[..., 3] = (sub * 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'assets/{name}.png'); man[name] = dict(x=X0 + x0, y=Y0 + y0, w=x1 - x0, h=y1 - y0, scale=SS)
save('word_th', th_final); save('word_base', base)
# pen paths (centre-lines) and dot positions, in card coordinates
BA_CTRL = [[706, 435], [711, 467], [716, 504], [715, 539], [706, 569], [684, 585], [644, 593], [594, 599], [544, 602], [494, 604], [444, 599], [404, 585], [372, 565], [349, 537], [337, 504], [338, 467], [346, 431]]
sq = lambda p: [p[0] - S_SHIFT, (551 - (551 - p[1]) * K) if (p[1] < 551 and p[0] >= 684) else p[1]]
man['word'] = dict(S=S_SHIFT, K=K, xa=XA, xe=xe, th_ctrl=[sq(p) for p in BA_CTRL], base_ctrl=[[XA, 592], [610, 600], [580, 604], [552, 597], [532, 586]],
                   th_dots=[[d['cx'] - S_SHIFT, d['cy']] for d in man['tha_dots']], dot_target=[668, 704])
json.dump(man, open('assets/manifest.json', 'w'), indent=1, default=float)
print({k: man[k] for k in ('word_th', 'word_base')}); print(man['word']['th_dots'])
