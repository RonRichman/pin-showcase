# Claude Code Fable design review

Reviewed commit `73c9bbd3f7c89301e7902bb143f3c97cf7820467` using model
`claude-fable-5-1` through the installed Claude Code CLI. The reviewer received
site source, the earlier review, and twelve desktop/mobile screenshots.
Read-only tools were enabled. No fallback model was requested or used.

## Reviewer response

I found no material defects and no P1 issues at commit 73c9bbd. I read all three source files, the twelve screenshots and the earlier review list. None of the five refinements below repeats completed work. None touches model data, numerical claims or provenance text. I ran nothing, so the findings come from source and screenshots only.

## Verdict

The site is already polished. Typography, palette, evidence boundaries and the mobile layouts all hold up. The copy is sober and accurate. The remaining work is scientific finish: tick labels, orientation in the last third of the page, tiny type and two small consistency slips. Items 1, 2, 3 and 5 are verified defects. Item 4 is a consistency and taste call.

## Recommendations

**1. P2, verified. Chart ticks are not round, and one is mislabelled.**
- **Observation:** In `showProfile` the ticks sit at half the shared extent and are printed to one decimal. The explain screenshots show −1.7, −0.8, 0.0, 0.8, 1.7. The gridline labelled 0.8 sits near 0.85.
- **Observation, benchmarks:** In `drawBenchmarks` the axis is cut into four equal parts. The France ensemble view shows 23.60, 24.08, 24.55, 25.02, 25.50.
- **Why:** Both audiences read axes literally. A gridline whose label is off by 0.05 weakens an otherwise rigorous exhibit.
- **Fix, SHAP:** Keep the extent, bounds and bar scaling. Draw SHAP gridlines at multiples of 0.5 inside the extent on desktop and multiples of 1 on mobile.
- **Fix, benchmarks:** Pick a step from 0.05, 0.1, 0.2, 0.25 or 0.5 that gives at most six ticks. Place ticks at multiples of that step.
- **Optional:** On mobile the SHAP plot can grow about a quarter. Move the zero line to 215 and the half-width to 96.
- **Accept:** Every printed tick equals its true position at the printed precision. No labels overlap at 320 or 390 pixels. The 32-configuration bounds check and the numerical reconciliation still pass.

**2. P2, verified. The chapter index stops at 05 while the page numbers run to 07.**
- **Observation:** The research screenshots at both widths show "05 The evidence" still active while "07 / Follow the research" is on screen. The progress bar is full at that point. Sections 06 and 07 have no entry in `.section-index nav`.
- **Why:** The orientation cue is wrong for the last three sections. The citation block, which matters most to researchers, cannot be reached from the sticky bar.
- **Fix:** Give the selection section an id. Add two links, "06 Selection" and "07 The research". The script builds its chapter list from the nav links, so no logic change is needed.
- **Accept:** The active chapter is correct in every numbered section. Seven items fit on one line at 1440 and 1100. The mobile arrow and edge fade still work. The keyboard checks still pass.

**3. P2, verified. Several labels render at 8 or 9 pixels.**
- **Observation:** The stylesheet sets 8 pixels for `.technical summary>span` and the explorer tag below 800 wide. It sets 8 pixels for the hero eyebrow between 801 and 1100 wide. Below 480 wide it sets 8 pixels for the figure caption and the split legend. The explore screenshot at 390 shows the "SAVED MODEL · FRENCH MTPL" tag wrapped onto two lines at that size.
- **Why:** These labels carry provenance and scale meaning. The earlier review already raised chart overlines and side notes to 10 pixels for the same reason.
- **Fix:** Set a 10 pixel floor on those selectors, and on the 9 pixel base sizes of `.tag`, `.art-caption` and the "Research by" label. Let the explorer tag drop below its heading on narrow screens instead of shrinking.
- **Accept:** No computed font size under 10 pixels at 320, 390, 768 or 1440. No new wrapping or overflow appears in the hero, the explorer header or the disclosure summaries.

**4. P3, consistency and partly taste. The north-east arrow means two different things.**
- **Observation:** The glyph marks external links in the masthead and the research list. It also marks "Go to the results" and "Open access research", which scroll down the page. The pair buttons built in `app.js` carry it too, although they are toggles that load a surface.
- **Why:** Academic readers expect that glyph to leave the site. On the pair buttons it suggests navigation where none happens.
- **Fix:** Use a down arrow on the two in-page links. Remove the arrow element from the pair buttons, which mobile already hides. Reduce their right padding to match.
- **Accept:** The north-east arrow appears only on links that leave the page. Pair buttons keep their pressed state, hover state and keyboard behaviour.

**5. P3, verified. Two slips in the research link list.**
- **Observation:** The bottom rule is written for `.research-links a:last-child`, but the last child is the copy button. The desktop screenshot shows no closing rule under "Copy the citation". The first row's text also starts about three pixels left of the others, because the numeral "01" is narrower.
- **Why:** This is the final block a reader sees before citing the paper.
- **Fix:** Apply the bottom border to the last child of any type. Give the number span a fixed minimum width with tabular numerals.
- **Accept:** A rule closes the list at both widths. All four titles share one left edge.

## Implementation decisions

All five recommendations were accepted. SHAP keeps its original bar geometry
and uses exact round ticks; the optional wider mobile plot was unnecessary.
Benchmark steps use round multiples at the current scale so both countries
remain covered. Seven chapters now reach the research and citation block.
Existing 8/9-pixel CSS declarations were raised to 10 pixels, with wrapping
for the explorer label. In-page and download links use a downward arrow;
pair toggles no longer carry a navigation arrow. The research list closes
with a rule and its row numbers have a fixed width.

Numerical data and model artifacts remain unchanged. The browser suite now
checks tick labels against their plotted positions, label overlap, all seven
chapters, the type-size floor, and citation alignment. Verification receipts
are recorded separately after testing.

## Closure

All five findings are resolved. All 15 local browser groups pass in
`verification/fable-browser-qa.json`, including the 32 benchmark configurations.
The numerical checker, JavaScript syntax checks and whitespace checks pass.
Desktop and mobile screenshots were inspected after the changes. The initial
tick-density failure and test-harness negative-zero failure are retained in
`verification/fable-first-pass.json`; both were resolved before publication.

Published commit `4f37c5556b3bd2ef0cc069acf03e19372b3e0b28` passed deployment
run `35648531837`. All 15 browser groups passed on the public site, and all
21 public assets matched the reviewed local files. Final receipts:
`verification/fable-browser-qa-live.json` and
`verification/fable-live-assets.json`. This review is closed.
