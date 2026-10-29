"""Clean background plate: original image with the card area re-filled with an exact copy of the grid."""
import numpy as np
from PIL import Image
im = np.array(Image.open('assets/reference.jpg').convert('RGB')).astype(float)
H, W, _ = im.shape
cream = np.median(im[10:100, 5:70].reshape(-1, 3), axis=0)
vprof = im[8:100, :, :].mean(axis=0)          # colour per column from the clean strip above the card
hprof = im[:, 8:70, :].mean(axis=1)           # colour per row from the clean strip left of the card
out = im.copy()
X0, X1, Y0, Y1 = 143, 937, 170, 1182
for y in range(Y0, Y1):
    for x in range(X0, X1):
        v = vprof[x] - cream; h = hprof[y] - cream
        both = (abs(v).sum() > 12) and (abs(h).sum() > 12)
        out[y, x] = np.minimum(cream + v, cream + h) - ((v.sum() * 0 + np.array([0, 2, 12])) if both else 0)
# the plate must be card-free: verify seams
print('cream', cream, 'seam diff (left of box)', np.abs(out[500:510, X0 - 3:X0 + 3] - im[500:510, X0 - 3:X0 + 3]).mean())
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save('assets/bg_plate.png')
# intersection check
print('orig intersection (186,106):', im[106, 186], ' plate in-box intersection (292,318):', out[318, 292], ' orig same-type outside (292,106):', im[106, 292])
