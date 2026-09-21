# Tree-like pairwise interaction networks

An interactive academic companion to Ronald Richman, Salvatore Scognamiglio and Mario Wüthrich's paper in Annals of Actuarial Science.

Source: https://doi.org/10.1017/S1748499526100402

Live site: https://ronrichman.github.io/pin-showcase/

The companion includes a conceptual split playground, an architecture walkthrough,
three fitted pair surfaces, four constructed-profile explanations, and the
published French and Belgian benchmark tables. It runs as static HTML, CSS and
JavaScript, with local fonts and no runtime services or package dependencies.

## Preview

```sh
python3 -m http.server 8764 --directory site
```

Open http://localhost:8764/. The complete site is in `site/`; GitHub Actions checks
the evidence and publishes only that directory.

## Verify

```sh
python3 scripts/check_site.py
node --check site/app.js
NODE_PATH=/path/to/node_modules node scripts/browser_qa.cjs
```

The browser check needs an existing Playwright installation and the preview
server. Set `PIN_QA_URL` to check a deployed copy. Browser dependencies are for
development only and do not ship to readers.

## Evidence

- [RESEARCH_PROVENANCE.md](RESEARCH_PROVENANCE.md): published tables, units,
  manuscript differences, original hashes and attribution.
- [MODEL_EXHIBITS.md](MODEL_EXHIBITS.md): saved-weight inference, support grids,
  constructed profiles, Shapley validation and regeneration commands.
- [FOR_RON.md](FOR_RON.md): architecture, choices and lessons.
- `verification/`: numerical and browser receipts.

Published results and repository model demonstrations are distinct sources. The
released model code differs from published Equation 2.2 in its continuous
embedding activation order. Its ten-model French ensemble matches the paper's
reported loss after rounding; that agreement does not resolve the difference.

Raw data, saved weights, editorial correspondence and manuscript archives are
excluded from publication. The public payload contains aggregate model surfaces
and constructed example profiles, not source policy records.

The paper is © the authors, 2026, and is published under CC BY 4.0. Cite the
original paper when using its findings. Bundled fonts retain their accompanying
SIL Open Font Licenses. The authors' upstream repository retains its own terms;
this companion does not relicense the upstream code or dataset.
