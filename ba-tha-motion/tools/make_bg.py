"""Clean background plate from the ba reference: original image with the card area re-filled with an exact copy of the grid."""
import numpy as np
from PIL import Image
im = np.array(Image.open('assets/reference_ba.png').convert('RGB')).astype(float)
cream = np.median(im[10:100, 5:70].reshape(-1, 3), axis=0)
vprof = im[8:100, :, :].mean(axis=0); hprof = im[:, 8:70, :].mean(axis=1)
out = im.copy(); X0, X1, Y0, Y1 = 143, 937, 170, 1182
for y in range(Y0, Y1):
    for x in range(X0, X1):
        v = vprof[x] - cream; h = hprof[y] - cream
        both = (abs(v).sum() > 12) and (abs(h).sum() > 12)
        out[y, x] = np.minimum(cream + v, cream + h) - (np.array([0, 2, 12]) if both else 0)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save('assets/bg_plate.png'); print('plate ok, cream', cream)
