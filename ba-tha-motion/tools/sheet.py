import sys, glob
from PIL import Image, ImageDraw
files = sys.argv[2:]; out = sys.argv[1]
cols = min(int(__import__("os").environ.get("COLS","4")), len(files)); rows = (len(files) + cols - 1) // cols
tw, th = int(__import__("os").environ.get("TW","405")), int(int(__import__("os").environ.get("TW","405"))*1.25)
sheet = Image.new('RGB', (cols * tw, rows * th), (20, 20, 20))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    ImageDraw.Draw(im).text((6, 6), f.split('/')[-1], fill=(255, 0, 0))
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
sheet.save(out)
