import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
// state persisted from last run; go to attack
await page.locator('nav button').nth(3).click();
await page.waitForTimeout(1200);
// zoom in a lot so a short (in-range) shot is possible for a big gun
// switch to a long-range piece first
const sel = page.locator('aside select').last();
// pick Storm Cannon-ish (last option often long range) — choose by label
const opts = await sel.locator('option').allInnerTexts();
console.log('PIECES:', JSON.stringify(opts.slice(0,20)));
await browser.close();
