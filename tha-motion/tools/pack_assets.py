"""Pack the PNG layers + manifest into js/assets.js as data: URIs (keeps the canvas untainted under file://)."""
import base64, json, glob, os
man = json.load(open('assets/manifest.json'))
out = {'manifest': man, 'img': {}}
for f in sorted(glob.glob('assets/*.png')):
    out['img'][os.path.basename(f)[:-4]] = 'data:image/png;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
open('js/assets.js', 'w').write('window.ASSETS = ' + json.dumps(out) + ';\n')
print('packed', len(out['img']), 'images,', os.path.getsize('js/assets.js') // 1024, 'KB')
