'use strict';
/*  node render.cjs preview <outDir> <t0> <t1> ...   -> PNG per time (seconds)
 *  node render.cjs frames  <outDir> [workers=4]     -> every frame as JPEG (q96)
 *  node render.cjs debug   <out.png>                -> pen-path overlay on the reference */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const TL = require('./js/timeline.js');
const FPS = TL.FPS, DURATION = TL.DUR;
const URL = 'file://' + path.join(__dirname, 'tha.html');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });
  await page.goto(URL); await page.evaluate(() => window.__ready);
  return page;
}
const grab = (page, t, fmt) => page.evaluate(([tt, f]) => { window.renderFrame(tt); return document.getElementById('cv').toDataURL(f === 'png' ? 'image/png' : 'image/jpeg', 0.96); }, [t, fmt]);

async function main() {
  const [mode, outDir, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-lcd-text', '--font-render-hinting=none'] });
  if (mode === 'preview') {
    fs.mkdirSync(outDir, { recursive: true });
    const page = await openPage(browser);
    for (const ts of rest) { const t = parseFloat(ts); const d = await grab(page, t, 'png'); fs.writeFileSync(path.join(outDir, `t${t.toFixed(2).padStart(6, '0')}.png`), Buffer.from(d.split(',')[1], 'base64')); }
  } else if (mode === 'frames') {
    fs.mkdirSync(outDir, { recursive: true });
    const workers = parseInt(rest[0] || '4', 10), total = FPS * DURATION, started = Date.now(); let done = 0;
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const page = await openPage(browser);
      for (let f = w; f < total; f += workers) {
        const d = await grab(page, f / FPS, 'jpg'); fs.writeFileSync(path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
        if (++done % 90 === 0) console.log(`${done}/${total}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
      }
    }));
    console.log(`rendered ${total} frames in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
