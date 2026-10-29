'use strict';
/*  node render.cjs preview <outDir> <t0> <t1> ...     -> PNG per time (seconds)
 *  node render.cjs frames  <outDir> [workers=4]       -> every JPEG frame of the reel
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FPS = 60, DURATION = 15;
const URL = 'file://' + path.join(__dirname, 'reel.html');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); });
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });
  await page.goto(URL);
  await page.evaluate(() => window.__ready);
  return page;
}

async function main() {
  const [mode, outDir, ...rest] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-lcd-text', '--font-render-hinting=none'] });

  if (mode === 'preview') {
    const page = await openPage(browser);
    for (const ts of rest) {
      const t = parseFloat(ts);
      const t0 = Date.now();
      const data = await page.evaluate(tt => { window.renderFrame(tt); return document.getElementById('cv').toDataURL('image/png'); }, t);
      fs.writeFileSync(path.join(outDir, `t${t.toFixed(3).padStart(7, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
      console.log(`t=${t}  ${Date.now() - t0}ms`);
    }
    await browser.close();
    return;
  }

  if (mode === 'frames') {
    const workers = parseInt(rest[0] || '4', 10);
    const total = FPS * DURATION;
    const started = Date.now();
    let done = 0;
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const page = await openPage(browser);
      for (let f = w; f < total; f += workers) {
        const data = await page.evaluate(tt => { window.renderBlurred(tt, 5, 0.8); return document.getElementById('cv').toDataURL('image/jpeg', 0.96); }, f / FPS);
        fs.writeFileSync(path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
        if (++done % 60 === 0) console.log(`${done}/${total}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
      }
    }));
    console.log(`rendered ${total} frames in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    await browser.close();
    return;
  }
  console.error('unknown mode'); process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
