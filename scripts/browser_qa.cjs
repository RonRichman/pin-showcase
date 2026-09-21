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
const report = process.env.PIN_QA_REPORT || 'browser-qa.json';
assert.equal(path.basename(report), report, 'PIN_QA_REPORT must be a basename');
const shots = path.join(out, 'screenshots', ...(process.env.PIN_QA_REPORT ? [path.parse(report).name] : []));
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
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
        await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(180);
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
        const pair = model.pairs[index]; await page.locator(`[data-pair="${index}"]`).click();
        assert.equal(await page.locator(`[data-pair="${index}"]`).getAttribute('aria-pressed'), 'true');
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
        assert.equal(await text(page, '#pair-mid'), signed((Math.min(...flat) + Math.max(...flat)) / 2));
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
        assert.equal(await text(page, '#interaction-status'), `${profile.label}. ${(profile.frequency * 100).toFixed(2)} expected claims per 100 policy-years.`);
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
    await test('Surface legend explains its scale and support visibility never changes numeric values', async () => {
      assert((await text(page, '.pair-colour-key')).includes('scale varies by pair'));
      assert((await text(page, '.pair-colour-key')).includes('Lower → higher'));
      for (let index = 0; index < model.pairs.length; index++) {
        await page.locator(`[data-pair="${index}"]`).click();
        const before = await text(page, '.pair-readout');
        const image = await page.locator('#pair-canvas').evaluate(el => el.toDataURL());
        await page.locator('#show-support').uncheck();
        assert.equal(await text(page, '.pair-readout'), before);
        assert.notEqual(await page.locator('#pair-canvas').evaluate(el => el.toDataURL()), image);
        await page.locator('#show-support').check();
        assert.equal(await text(page, '.pair-readout'), before);
        assert.equal(await page.locator('#pair-canvas').evaluate(el => el.toDataURL()), image);
      }
    });
    await test('Refined controls, chapter navigation and touch surface readouts work across viewport widths', async () => {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(180);
        const ranges = await page.locator('input[type="range"]').evaluateAll(elements => elements.map(el => ({ id: el.id, height: el.getBoundingClientRect().height })));
        assert(ranges.every(range => range.height >= 44), JSON.stringify({ width, ranges }));
        await page.locator('#stage-tab-0').click();
        assert(await page.locator('#stage-prev').isDisabled());
        for (let stage = 1; stage < 5; stage++) {
          await page.locator('#stage-next').click();
          assert.equal(await text(page, '#stage-count'), `Step ${stage + 1} of 5`);
          assert.equal(await page.locator(`#stage-tab-${stage}`).getAttribute('aria-selected'), 'true');
        }
        assert(await page.locator('#stage-next').isDisabled());
        if (width <= 390) {
          const selectedFill = await page.locator('#architecture-svg text').filter({ hasText: 'weighted sum → exp → frequency' }).evaluate(el => el.previousElementSibling.getAttribute('fill'));
          await page.locator('#stage-prev').click();
          const otherFill = await page.locator('#architecture-svg text').filter({ hasText: 'weighted sum → exp → frequency' }).evaluate(el => el.previousElementSibling.getAttribute('fill'));
          assert.notEqual(selectedFill, otherFill, 'Combine must visibly highlight its output box');
        }
        await page.locator('#stage-tab-0').click();
        assert(await page.locator('#stage-prev').isDisabled());
        for (const id of ['intuition', 'method', 'explore', 'explain', 'evidence', 'selection', 'research']) {
          await page.locator(`#${id}`).evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80));
          await page.waitForFunction(section => document.querySelector('.section-index [aria-current]')?.getAttribute('href') === `#${section}`, id);
          assert.equal(await page.locator('.section-index [aria-current]').count(), 1);
        }
        if (width <= 768) {
          await page.locator('#intuition').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80));
          await page.waitForFunction(() => document.querySelector('.section-index [aria-current]')?.getAttribute('href') === '#intuition');
          const next = page.locator('#chapter-next'); await next.focus();
          const before = await page.evaluate(() => ({ y: scrollY, left: document.querySelector('.section-index nav').scrollLeft, focus: document.activeElement.id }));
          await next.press('Enter');
          const after = await page.evaluate(() => ({ y: scrollY, left: document.querySelector('.section-index nav').scrollLeft, focus: document.activeElement.id }));
          assert.equal(after.y, before.y); assert.equal(after.focus, before.focus);
          const overflow = await page.locator('.section-index nav').evaluate(el => el.scrollWidth > el.clientWidth);
          if (overflow) {
            assert(after.left > before.left, JSON.stringify({ width, before, after }));
            for (let step = 0; step < 3; step++) {
              const endVisible = await page.locator('.section-index nav').evaluate(el => el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
              if (endVisible) break;
              await next.press('Enter');
            }
            assert(await page.locator('.section-index nav').evaluate(el => {
              const last = el.lastElementChild.getBoundingClientRect(), nav = el.getBoundingClientRect();
              return last.left >= nav.left && last.right <= nav.right + 1;
            }), 'More chapters reveals the final Research destination');
            assert.equal(await page.evaluate(() => scrollY), before.y);
            assert.equal(await page.evaluate(() => document.activeElement.id), before.focus);
          }
        }
        for (let index = 0; index < model.pairs.length; index++) {
          await page.locator(`[data-pair="${index}"]`).click();
          const canvas = page.locator('#pair-canvas'); await canvas.scrollIntoViewIfNeeded();
          const rect = await canvas.boundingBox();
          const beforePoint = await text(page, '#pair-point');
          await page.touchscreen.tap(rect.x + rect.width * .65, rect.y + rect.height * .40);
          assert.notEqual(await text(page, '#pair-point'), beforePoint, 'Touch must select a new point');
          const x = Number(await page.locator('#pair-x').inputValue()), y = Number(await page.locator('#pair-y').inputValue());
          assert.equal(await text(page, '#pair-inline-value'), signed(model.pairs[index].values[y][x], 4));
          assert.equal(await text(page, '#pair-inline-value'), await text(page, '#pair-value'));
          assert((await text(page, '#pair-point')).includes(await text(page, '#pair-x-output')));
          assert((await text(page, '#pair-point')).includes(await text(page, '#pair-y-output')));
        }
      }
    });
    await test('Neural focus preserves all published table rows, status feedback and readable chart bounds', async () => {
      assert.equal(await page.locator('#neural-focus').isChecked(), false, 'All reported models remain the default');
      const checked = [];
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(180);
        for (const country of ['france', 'belgium']) for (const comparison of ['single', 'ensemble']) for (const focus of [false, true]) {
          await page.locator(`[data-dataset="${country}"]`).click(); await page.locator(`[data-comparison="${comparison}"]`).click(); await page.locator('#neural-focus').setChecked(focus);
          const data = research.datasets[country], label = await page.locator('#benchmark-chart').getAttribute('aria-label');
          for (const baseline of data.benchmarks.filter(row => row.kind === 'baseline')) assert.equal(label.includes(baseline.name + ':'), !focus);
          for (const row of data.benchmarks.filter(row => row.kind === comparison)) assert(label.includes(`${row.name}: ${(row.test * 100).toFixed(3)}`));
          assert.equal(await page.locator('#benchmark-table tbody tr').count(), data.benchmarks.length);
          const status = await text(page, '#interaction-status');
          assert(status.includes(country === 'france' ? 'France' : 'Belgium'));
          assert(status.includes(comparison === 'single' ? 'individual fits' : 'ensembles'));
          assert(status.includes(await text(page, '#result-score')));
          assert((await text(page, '#benchmark-scope')).includes(focus ? 'axis rescaled' : 'All reported models'));
          const bounds = await page.locator('#benchmark-chart').evaluate(svg => {
            const view = svg.viewBox.baseVal;
            return [...svg.querySelectorAll('text')].filter(el => Number(el.getAttribute('y')) > view.height - 15).map(el => {
              const box = el.getBBox(); return { label: el.textContent, position: Number(el.getAttribute('x')), x: box.x, right: box.x + box.width, bottom: box.y + box.height, width: view.width, height: view.height, mobile: svg.clientWidth < 550 };
            });
          });
          assert(bounds.length >= 2 && bounds.length <= 6, 'Readable number of round ticks');
          const rows = data.benchmarks.filter(row => row.kind === comparison || (!focus && row.kind === 'baseline'));
          const low = Math.floor((Math.min(...rows.map(row => (row.test - (row.sd || 0)) * 100)) - .03) * 10) / 10;
          const high = Math.ceil((Math.max(...rows.map(row => (row.test + (row.sd || 0)) * 100)) + .03) * 10) / 10;
          for (const tick of bounds) {
            const left = tick.mobile ? 0 : 240, plotWidth = tick.mobile ? tick.width - 70 : 425;
            const valueAtPosition = low + (tick.position - left) / plotWidth * (high - low);
            assert(Math.abs(Number(tick.label) - valueAtPosition) < 1e-8, 'Tick label equals its plotted value');
          }
          assert(bounds.every((box, index) => index === 0 || box.x > bounds[index - 1].right + 2), JSON.stringify({width, country, comparison, focus, bounds}));
          assert(bounds.every(box => box.x >= -.5 && box.right <= box.width + .5 && box.bottom <= box.height + .5), JSON.stringify({ width, country, comparison, focus, bounds }));
          checked.push({ width, country, comparison, focus });
        }
      }
      await page.locator('#neural-focus').uncheck(); return { combinations: checked.length };
    });
    await test('Fable refinements keep labels readable, round SHAP ticks accurate and research links aligned', async () => {
      for (const width of [320, 390, 768, 1100, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(180);
        const small = await page.locator('body *').evaluateAll(elements => elements.filter(el => el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 10).map(el => ({ tag: el.tagName, id: el.id, size: getComputedStyle(el).fontSize })));
        assert.deepEqual(small, [], `Small text at ${width}px`);
        if (width >= 1100) assert(await page.locator('.section-index nav').evaluate(el => el.scrollWidth <= el.clientWidth), 'All seven chapters fit desktop navigation');
        assert.equal(await page.locator('.section-index nav a').count(), 7);
        const links = await page.locator('.research-links').evaluate(el => ({ lefts: [...el.querySelectorAll('strong')].map(item => item.getBoundingClientRect().left), border: getComputedStyle(el.lastElementChild).borderBottomWidth }));
        assert(Math.max(...links.lefts) - Math.min(...links.lefts) < 1, 'Research titles align');
        assert.equal(links.border, '1px');
        const ticks = await page.locator('#shap-chart').evaluate(svg => ({ mobile: svg.clientWidth < 550, ticks: [...svg.querySelectorAll('text[y="450"]')].map(el => { const b = el.getBBox(); return { value: Number(el.textContent), position: Number(el.getAttribute('x')), left: b.x, right: b.x + b.width }; }) }));
        const extent = Math.max(...model.profiles.flatMap(profile => profile.contributions.map(c => Math.abs(c.value)))) * 1.2;
        for (const [index, tick] of ticks.ticks.entries()) {
          const actual = (tick.position - (ticks.mobile ? 235 : 426)) / (ticks.mobile ? 76 : 214) * extent;
          assert(Math.abs(tick.value - actual) < 1e-8, 'SHAP tick label equals its plotted value');
          assert(tick.value % (ticks.mobile ? 1 : .5) === 0);
          assert(tick.left >= 0 && tick.right <= (ticks.mobile ? 360 : 720));
          if (index) assert(tick.left > ticks.ticks[index - 1].right + 2, 'SHAP labels do not overlap');
        }
      }
      assert.equal(await page.locator('#pair-choices b').count(), 0);
      const misleading = await page.locator('a').evaluateAll(links => links.filter(a => a.textContent.includes('↗') && !a.getAttribute('href').startsWith('https://')).map(a => a.getAttribute('href')));
      assert.deepEqual(misleading, []);
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
    fs.writeFileSync(path.join(out, report), JSON.stringify(receipt, null, 2) + '\n'); await browser.close(); console.log(`Receipt: verification/${report}; passed=${receipt.passed}`); if (!receipt.passed) process.exitCode = 1;
  }
})();
