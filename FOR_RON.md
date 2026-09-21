# PIN, made visible

This site is an academic companion for you, Salvatore and Mario. It serves two
readers: an actuary who wants to understand the modelling idea, and a researcher
who wants the architecture, exact evidence and source material. The main page
offers a guided story; expandable technical notes carry the details.

## Technical Architecture

The website is a static publication. A browser loads the page, local fonts and
two small JavaScript data files. Nothing trains when a reader moves a slider.
The split playground calculates a teaching example; the pair explorer reads
precomputed values evaluated from a saved model. The difference is labelled.

Think of it as a museum exhibit with the measurements already prepared. The
reader can inspect the measurements from different angles without needing a
laboratory running behind the wall.

The fitting code and raw data stay outside the published site. Python generates
the numerical exhibits; plain JavaScript draws the diagrams and updates native
controls. The browser needs no Python, R, TensorFlow, login or network API.

## Codebase Structure

- `site/index.html` is the narrative and semantic page structure.
- `site/styles.css` defines the ivory, forest-green and copper visual design.
- `site/app.js` draws the diagrams and connects the controls to the data.
- `site/data/research.*` and `benchmarks.csv` hold the published comparisons.
- `site/data/model-exhibits.*` hold fitted surfaces, support counts and SHAP values.
- `scripts/build_research_data.py` regenerates the publication tables.
- `scripts/export_model_exhibits.py` evaluates the supplied saved weights.
- `scripts/check_site.py` checks publication integrity; `browser_qa.cjs` tests readers' interactions.
- `sources/private/` is ignored by Git and is never a Pages artifact.
- `.github/workflows/pages.yml` checks and publishes only `site/`.

## Technologies Used

HTML, CSS, SVG and Canvas handle the website. DM Sans and Instrument Serif are
bundled locally with their licenses. Native range inputs, selects, buttons and
details elements keep keyboard operation straightforward. Playwright drives
independent browser verification; NumPy and TensorFlow are used in offline
model verification, not by visitors.

## Technical Decisions

**Two sources of evidence stay separate.** The published French and Belgian
results come from the journal tables, visually checked against the PDF. The
interactive model exhibits come from the authors' released checkpoint archive.
The archive's embedding uses linear then tanh; published Equation 2.2 describes
tanh then linear. The ten-model test ensemble nonetheless gives 23.667233 in
the paper's display units, rounding to the reported 23.667. We report both facts
instead of treating the rounding match as proof that the two specifications are
identical.

**The scale is part of the explanation.** PIN adds its terms on log frequency.
Only after that does the exponential give annual frequency. The surface is one
weighted pair term, not a premium, a total prediction or a pure interaction
residual. The SHAP baseline is the mean log frequency over a fixed 256-record
background, not the log of an arithmetic average frequency.

**Single model explanations avoid an ensemble trap.** An average of predicted
frequencies is not generally pairwise-additive after taking its logarithm. The
pair and SHAP exhibits therefore use one named saved model. All 512 coalitions
were enumerated as an independent check of the fast paired-permutation SHAP
calculation for each constructed example.

**Support is visible.** The pair grids also count learning records in each cell.
Hatching means fewer than 20 records. It marks thin empirical support without
pretending the model has no mathematical output there. Density uses logarithmic
spacing, explicitly labelled on the axis.

**Mobile charts are redrawn.** Shrinking a desktop SVG also shrinks its words.
The site changes chart geometry on small screens so labels remain readable.
The architecture diagram becomes vertical; benchmark labels sit above their
data marks.

## Lessons Learned

Cambridge's accessible HTML descriptions did not reliably match the numerical
tables, so the source audit used the rendered PDF. The downloaded PDF also
included the requester's IP in a footer. The public site links to the article
instead of distributing that locally stamped copy.

The support grid and surfaces must share orientation and indexing. All grids
use rows for the vertical feature, columns for the horizontal feature; sliders
and pointer inspection are checked against the JSON values. Each support grid
accounts for all 610,206 learning records.

The repository already contained all ten French weights. Evaluating them was
enough; no retraining was needed. A separate TensorFlow calculation checked
NumPy predictions, with maximum relative difference about 3.27e-7 on 512 rows.
The full-coalition SHAP check agreed to about 6.11e-16. These are implementation
checks, not new evidence of future-period predictive performance.

The installed interactive browser shares a session with other work. Once that
caused navigation interference, verification moved to isolated Playwright
browser contexts. Publication uses a separate repository and worktree so no
unrelated home-folder files enter the commit.

## Delivery

Published at https://ronrichman.github.io/pin-showcase/ from site commit
`1f98ae1c12350a5c6647aff11175353b3fc2cb9d`. GitHub Actions run `35645187203`
completed both verification and deployment. All 11 browser-check groups passed
against the public URL, including the five responsive widths (320–1440 pixels),
keyboard controls, numerical readouts and network checks. All 20 public assets
checked against the local site matched byte for byte. See
`verification/browser-qa-live.json` and `verification/live-assets.json`.

Keyboard and semantic checks were performed directly. An automated axe scan was
not run because axe-core was not installed; these checks do not constitute a
complete accessibility certification. Desktop and mobile page/chart screenshots
were visually inspected as well.

The main checkout is `/home/ron/pin-showcase`; implementation and private source
extraction are retained in `/home/ron/pin-showcase-build`. Both refer to the same
Git repository. The original R2 ZIP was never modified.

## Design refinement

The polish pass lives in `/home/ron/pin-showcase-polish`. Two independent reviews
looked at visual clarity and interaction, followed by another visual pass on
the revised mobile layouts. Findings and acceptance criteria are recorded in
`todos/2026-09-21-design-review.md`.

The most consequential change is the surface colour scale. All three saved
pair grids are nonnegative, so a green-to-white-to-copper scale suggested a
negative/positive distinction that the numbers did not contain. A sequential
cream-to-copper scale now shows low to high contributions. Its legend explicitly
says that the scale varies by pair. The support hatch has its own key and can
be switched off to inspect the shape; switching it off never changes a value.

On a phone, a selected point needs its value beside it. The compact readout now
stays above the heatmap, while the full inspector retains units and controls.
All three relationships are visible choices, sliders have 44-pixel touch
targets, and the chapter rail shows where you are and how to reach more
chapters. The architecture has bounded previous/next steps, including a visible
Combine highlight in its vertical layout.

The evidence chart can focus on neural models, with the rescaled axis stated
beside the control. The default still includes the reported baselines, and the
complete table remains available in either view. Fixed feature ordering makes
the four SHAP examples easier to compare. These are presentation changes:
the published values, saved-model grids and numerical validation are unchanged.

The expanded browser suite checks 32 chart configurations, actual touch
selection, keyboard feedback and mobile navigation. It caught a two-pixel
vertical crop on axis labels that a page-overflow check would miss. Checking
the text bounding boxes inside the SVG fixed the root cause. All 14 groups
passed locally; see `verification/design-browser-qa.json`.

The refined site was published from commit
`56f474e8db298c03c00cd87da9f181e3e4a97c97` by successful GitHub Actions run
`35647185854`. All 14 browser groups also passed against the public URL, and
all 21 public assets matched local bytes. The receipts are
`verification/design-browser-qa-live.json` and
`verification/design-live-assets.json`.

## Claude Fable final review

At your request, Claude Code reviewed the source and twelve fresh desktop/mobile
screenshots using `claude-fable-5-1`. The review and implementation decisions are
in `todos/2026-09-21-fable-review.md`; the model receipt is
`verification/fable-review.json`. Fable found no major defects and proposed five
small refinements, all implemented.

Chart gridlines now sit at round values whose labels match their coordinates.
The bar and point geometry is unchanged. The first check caught crowded ticks
at 320 pixels; selecting fewer round ticks on mobile fixed it. That failed run
is retained in `verification/fable-first-pass.json`. The test harness also needed
to treat negative zero as zero when checking negative multiples.

The chapter rail now follows all seven numbered sections, including selection
and the research links. Small CSS labels have a 10-pixel minimum. Downward
arrows identify links further down the page or downloads; pair selectors no
longer suggest navigation. Fixed-width row numbers align the research links,
and a closing rule includes the citation button.

All 15 browser groups pass locally, including the original numerical checks,
32 benchmark configurations and new checks for tick accuracy, label spacing,
chapter coverage, small text and link alignment. See
`verification/fable-browser-qa.json`. Fresh screenshots were visually inspected.
The numerical source files and model artifacts are unchanged.

Published commit `4f37c5556b3bd2ef0cc069acf03e19372b3e0b28` passed deployment
run `35648531837`. All 15 browser groups passed on the public site, and all
21 public assets matched the reviewed local files. Final receipts:
`verification/fable-browser-qa-live.json` and
`verification/fable-live-assets.json`. This review is closed.
