#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const url = process.env.PIN_QA_URL || 'http://127.0.0.1:8764/';
const out = path.join(root, 'verification');
const shots = path.join(out, 'screenshots');
fs.mkdirSync(shots, { recursive: true });
const sourceNames = ['site/index.html', 'site/styles.css', 'site/app.js', 'site/data/model-exhibits.js', 'site/data/research.js', 'scripts/browser_qa.cjs'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceHashes = () => Object.fromEntries(sourceNames.map(name => [name, hash(fs.readFileSync(path.join(root, name)))]));
const receipt = { url, startedAt: new Date().toISOString(), sourceHashesAtStart: sourceHashes(), tests: [], pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [], screenshots: [], accessibility: { engine: 'manual semantic and keyboard behavior checks; axe-core availability checked below' } };
const signed = (v, digits = 3) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
const text = async (page, selector) => (await page.locator(selector).textContent()).trim();
const setRange = (page, selector, value) => page.locator(selector).evaluate((element, v) => { element.value = v; element.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
async function test(name, work) {
  try { const details = await work(); receipt.tests.push({ name, status: 'passed', ...(details === undefined ? {} : { details }) }); }
  catch (error) { receipt.tests.push({ name, status: 'failed', error: error.stack }); }
  console.log(receipt.tests.at(-1).status.toUpperCase(), name);
}
async function screenshot(page, name, fullPage = false) {
  const file = path.join(shots, name + '.png'); await page.screenshot({ path: file, fullPage }); receipt.screenshots.push({ file: path.relative(root, file), sha256: hash(fs.readFileSync(file)) });
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  page.on('pageerror', error => receipt.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') receipt.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => receipt.failedRequests.push({ url: request.url(), reason: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) receipt.httpErrors.push({ url: response.url(), status: response.status() }); });
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PIN_MODEL?.status === 'verified' && window.PIN_RESEARCH);
    const model = await page.evaluate(() => window.PIN_MODEL);
    const research = await page.evaluate(() => window.PIN_RESEARCH);
    receipt.loadedData = { models: model.validation.individualModels.length, profiles: model.profiles.length, pairGrids: model.pairs.length, datasets: Object.keys(research.datasets) };
    await test('All requested viewport widths have no document overflow', async () => {
      const widths = [];
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(80);
        const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).map(el => ({ tag: el.tagName, id: el.id, className: typeof el.className === 'string' ? el.className : '' })).slice(0, 15) }));
        widths.push(geometry);
        if ([390, 1440].includes(width)) await screenshot(page, `page-${width}`, true);
      }
      assert(widths.every(x => x.document <= x.viewport + 1 && x.body <= x.viewport + 1), JSON.stringify(widths)); return widths;
    });
    await test('Three conceptual activations and both ranges change the rendered teaching response', async () => {
      const fingerprints = [];
      for (const activation of ['hard', 'step', 'sigmoid']) {
        await page.locator(`[data-activation="${activation}"]`).click();
        assert.equal(await page.locator(`[data-activation="${activation}"]`).getAttribute('aria-pressed'), 'true');
        fingerprints.push(await page.locator('#split-canvas').evaluate(el => el.toDataURL()));
      }
      assert.equal(new Set(fingerprints).size, 3);
      await setRange(page, '#split-angle', -70); assert.equal(await text(page, '#angle-output'), '−70°'.replace('−', '-'));
      const first = await page.locator('#split-canvas').evaluate(el => el.toDataURL());
      await setRange(page, '#split-angle', 70); assert.equal(await text(page, '#angle-output'), '70°');
      assert.notEqual(first, await page.locator('#split-canvas').evaluate(el => el.toDataURL()));
      await setRange(page, '#split-offset', -1); assert.equal(await text(page, '#offset-output'), '-1.00');
      await setRange(page, '#split-offset', 1); assert.equal(await text(page, '#offset-output'), '1.00');
      await setRange(page, '#split-angle', 35); await setRange(page, '#split-offset', 0); await page.locator('[data-activation="hard"]').click();
    });
    await test('Architecture tabs support every stage and arrow/Home/End keyboard navigation', async () => {
      for (let index = 0; index < 5; index++) {
        await page.locator(`#stage-tab-${index}`).click(); assert.equal(await page.locator(`#stage-tab-${index}`).getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#stage-panel').getAttribute('aria-labelledby'), `stage-tab-${index}`);
        assert((await text(page, '#stage-title')).length > 10);
      }
      await page.locator('#stage-tab-4').press('ArrowRight'); assert.equal(await page.locator('#stage-tab-0').getAttribute('aria-selected'), 'true');
      await page.locator('#stage-tab-0').press('ArrowLeft'); assert.equal(await page.locator('#stage-tab-4').getAttribute('aria-selected'), 'true');
      await page.locator('#stage-tab-4').press('Home'); assert.equal(await page.locator('#stage-tab-0').getAttribute('aria-selected'), 'true');
      await page.locator('#stage-tab-0').press('End'); assert.equal(await page.locator('#stage-tab-4').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('[data-stage][tabindex="0"]').count(), 1);
    });
    await test('Every pair grid maps sliders, extrema, support and pointer coordinates to source numbers', async () => {
      const checked = [];
      for (let index = 0; index < model.pairs.length; index++) {
        const pair = model.pairs[index]; await page.selectOption('#pair-select', String(index));
        assert.equal(await text(page, '#pair-title'), pair.label);
        assert.equal(await page.locator('#pair-x').getAttribute('max'), String(pair.xValues.length - 1));
        assert.equal(await page.locator('#pair-y').getAttribute('max'), String(pair.yValues.length - 1));
        const flat = pair.values.flat(), minIndex = flat.indexOf(Math.min(...flat)), maxIndex = flat.indexOf(Math.max(...flat));
        for (const flatIndex of [0, flat.length - 1, minIndex, maxIndex]) {
          const x = flatIndex % pair.xValues.length, y = Math.floor(flatIndex / pair.xValues.length);
          await setRange(page, '#pair-x', x); await setRange(page, '#pair-y', y);
          assert.equal(await text(page, '#pair-value'), signed(pair.values[y][x], 4));
          assert((await text(page, '#pair-support')).startsWith(pair.support[y][x].toLocaleString('en-US') + ' learning records'));
          assert.equal((await text(page, '#pair-support')).includes('sparse support'), !pair.supportMask[y][x]);
        }
        assert.equal(await text(page, '#pair-low'), signed(Math.min(...flat)));
        assert.equal(await text(page, '#pair-high'), signed(Math.max(...flat)));
        await page.locator('#pair-canvas').scrollIntoViewIfNeeded(); const rect = await page.locator('#pair-canvas').boundingBox();
        const x = Math.floor(pair.xValues.length / 3), y = Math.floor(pair.yValues.length / 4);
        await page.mouse.move(rect.x + (90 + (x + .5) * 700 / pair.xValues.length) / 850 * rect.width, rect.y + (24 + (pair.yValues.length - y - .5) * 510 / pair.yValues.length) / 620 * rect.height);
        assert.equal(await page.locator('#pair-x').inputValue(), String(x)); assert.equal(await page.locator('#pair-y').inputValue(), String(y));
        assert.equal(await text(page, '#pair-value'), signed(pair.values[y][x], 4)); checked.push(pair.id);
      }
      await screenshot(page, 'pair-explorer'); return checked;
    });
    await test('All constructed profiles display exact source frequencies, SHAP values and rounded numeric closure', async () => {
      for (let index = 0; index < model.profiles.length; index++) {
        const profile = model.profiles[index]; await page.locator(`[data-profile="${index}"]`).click();
        assert.equal(await text(page, '#profile-title'), profile.label);
        assert.equal(await text(page, '#profile-frequency'), (profile.frequency * 100).toFixed(2));
        assert.equal(await text(page, '#profile-baseline'), profile.baselineLog.toFixed(4));
        assert.equal(await text(page, '#profile-log'), profile.logPrediction.toFixed(4));
        const sum = profile.contributions.reduce((acc, c) => acc + c.value, 0);
        assert.equal(await text(page, '#profile-sum'), signed(sum, 4));
        assert(Math.abs(profile.baselineLog + sum - profile.logPrediction) < 1e-10);
        const chart = await text(page, '#shap-chart');
        for (const contribution of profile.contributions) { assert(chart.includes(contribution.feature)); assert(chart.includes(signed(contribution.value))); }
        const displayedSum = Number((await text(page, '#profile-sum')).replace('−', '-'));
        assert(Math.abs(Number(await text(page, '#profile-baseline')) + displayedSum - Number(await text(page, '#profile-log'))) < .0002);
      }
      await screenshot(page, 'profile-explanation'); return { profiles: model.profiles.length, sourceClosureTolerance: 1e-10, displayedClosureTolerance: .0002 };
    });
    await test('Both countries and comparison types agree with every published benchmark row', async () => {
      const checked = [];
      for (const country of ['france', 'belgium']) for (const comparison of ['single', 'ensemble']) {
        const data = research.datasets[country]; await page.locator(`[data-dataset="${country}"]`).click(); await page.locator(`[data-comparison="${comparison}"]`).click();
        const selected = data.benchmarks.filter(b => b.kind === comparison || b.kind === 'baseline');
        const pin = selected.find(b => /PIN/.test(b.name)); assert.equal(await text(page, '#result-score'), (pin.test * 100).toFixed(3));
        assert.equal(await text(page, '#result-policies'), data.policies.toLocaleString('en-US'));
        assert.equal(await text(page, '#result-parameters'), data.parameters.toLocaleString('en-US'));
        const label = await page.locator('#benchmark-chart').getAttribute('aria-label');
        for (const b of selected) assert(label.includes(`${b.name}: ${(b.test * 100).toFixed(3)}`));
        const rows = await page.locator('#benchmark-table tbody tr').evaluateAll(rows => rows.map(row => [...row.children].map(el => el.textContent.trim())));
        assert.equal(rows.length, data.benchmarks.length);
        data.benchmarks.forEach((b, i) => { assert.equal(rows[i][0], b.name); assert.equal(rows[i][2], (b.train*100).toFixed(3)+(b.trainSd?` (${(b.trainSd*100).toFixed(3)})`:'')); assert.equal(rows[i][3], (b.test*100).toFixed(3)+(b.sd?` (${(b.sd*100).toFixed(3)})`:'')); });
        checked.push({ country, comparison, pin: (pin.test * 100).toFixed(3), completeTableRows: rows.length });
      }
      await screenshot(page, 'belgian-results'); return checked;
    });
    await test('All disclosure panels open and close through the keyboard', async () => {
      const summaries = page.locator('details > summary'); const count = await summaries.count();
      for (let i = 0; i < count; i++) { const summary = summaries.nth(i); await summary.focus(); await summary.press('Enter'); assert(await summary.evaluate(el => el.parentElement.open)); await summary.press('Enter'); assert(!(await summary.evaluate(el => el.parentElement.open))); }
      return { count };
    });
    await test('Citation clipboard action and permission-denied download fallback both deliver BibTeX', async () => {
      await page.locator('#copy-citation').click(); await page.waitForFunction(() => document.querySelector('#citation-copy-label').textContent === 'Citation copied');
      const copied = await page.evaluate(() => navigator.clipboard.readText()); assert(copied.includes('10.1017/S1748499526100402')); assert(copied.includes('Scognamiglio')); assert(copied.includes('@article'));
      await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new DOMException('QA denial', 'NotAllowedError'); } }); });
      const downloadEvent = page.waitForEvent('download'); await page.locator('#copy-citation').click(); const download = await downloadEvent; const file = await download.path();
      assert.equal(fs.readFileSync(file, 'utf8'), copied); assert(download.suggestedFilename().endsWith('.bib')); return { clipboard: true, fallbackDownload: download.suggestedFilename() };
    });
    await test('Reduced-motion default and explicit pause keep hero canvas still', async () => {
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(120);
      assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'), 'true');
      const paused = await page.locator('#hero-surface').evaluate(el => el.toDataURL()); await page.waitForTimeout(220); assert.equal(await page.locator('#hero-surface').evaluate(el => el.toDataURL()), paused);
      await page.locator('#motion-toggle').click(); await page.waitForTimeout(220); assert.notEqual(await page.locator('#hero-surface').evaluate(el => el.toDataURL()), paused);
      await page.locator('#motion-toggle').click(); const frozen = await page.locator('#hero-surface').evaluate(el => el.toDataURL()); await page.waitForTimeout(220); assert.equal(await page.locator('#hero-surface').evaluate(el => el.toDataURL()), frozen);
    });
    await test('Internal anchors resolve and every local linked resource returns success', async () => {
      const links = await page.locator('a[href]').evaluateAll(links => links.map(a => a.getAttribute('href'))); const resources = new Set();
      for (const link of links) {
        if (link.startsWith('#')) { if (link.length > 1) assert(await page.locator(link).count(), `Missing ${link}`); }
        else { const resolved = new URL(link, url); if (resolved.origin === new URL(url).origin) resources.add(resolved.href); }
      }
      for (const resource of resources) { const response = await context.request.get(resource); assert(response.ok(), `${response.status()}: ${resource}`); }
      return [...resources];
    });
    const axeCandidates = [process.env.PIN_AXE_PATH, '/home/ron/.claude/skills/gstack/node_modules/axe-core/axe.min.js', '/home/ron/node_modules/axe-core/axe.min.js'].filter(Boolean);
    const axePath = axeCandidates.find(file => fs.existsSync(file));
    if (axePath) await test('Installed axe-core accessibility scan', async () => { await page.addScriptTag({ path: axePath }); const results = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })); receipt.accessibility.axe = { version: results.testEngine.version, violations: results.violations }; assert.equal(results.violations.length, 0, JSON.stringify(results.violations)); });
    else receipt.accessibility.axe = { status: 'not installed in checked paths; no dependency added', checkedPaths: axeCandidates };
    await test('No page exceptions, console errors, failed requests or HTTP errors', async () => { assert.deepEqual(receipt.pageErrors, []); assert.deepEqual(receipt.consoleErrors, []); assert.deepEqual(receipt.httpErrors, []); assert.deepEqual(receipt.failedRequests, []); });
  } catch (error) { receipt.tests.push({ name: 'Browser setup and primary navigation', status: 'failed', error: error.stack }); }
  finally {
    receipt.completedAt = new Date().toISOString(); receipt.sourceHashesAtEnd = sourceHashes(); receipt.sourceChangedDuringRun = JSON.stringify(receipt.sourceHashesAtStart) !== JSON.stringify(receipt.sourceHashesAtEnd); receipt.passed = receipt.tests.every(test => test.status === 'passed');
    fs.writeFileSync(path.join(out, 'browser-qa.json'), JSON.stringify(receipt, null, 2) + '\n'); await browser.close(); console.log(`Receipt: verification/browser-qa.json; passed=${receipt.passed}`); if (!receipt.passed) process.exitCode = 1;
  }
})();
