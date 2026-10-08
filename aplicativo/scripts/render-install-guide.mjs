import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const [html, pdf] = process.argv.slice(2);
if (!html || !pdf) throw new Error('Usage: node scripts/render-install-guide.mjs input.html output.pdf');
const browser = await chromium.launch({
  ...(process.env.RECANTO_CHROMIUM_PATH ? { executablePath: process.env.RECANTO_CHROMIUM_PATH } : {}),
  headless: true,
});
try {
  const page = await browser.newPage();
  // Render a self-contained document in memory; no file navigation or network.
  await page.setContent(await readFile(resolve(html), 'utf8'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: resolve(pdf), format: 'A4', preferCSSPageSize: true, printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font:9px Arial;color:#476172;width:100%;margin:0 14mm;display:flex;justify-content:space-between"><span>Recanto das Asas · Guia de instalação 0.1.0</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '15mm', right: '14mm', bottom: '18mm', left: '14mm' },
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error('Installation guide has horizontal overflow.');
  console.log(`Guide PDF generated: ${pdf}`);
} finally { await browser.close(); }
