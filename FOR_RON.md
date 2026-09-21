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
