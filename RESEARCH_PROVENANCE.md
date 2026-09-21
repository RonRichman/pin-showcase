# Research provenance

## Canonical paper

Ronald Richman, Salvatore Scognamiglio and Mario Wüthrich (2026), *Tree-like pairwise interaction networks*, Annals of Actuarial Science, First View, pages 1–24. Published online 18 September 2026. DOI: [10.1017/S1748499526100402](https://doi.org/10.1017/S1748499526100402).

The published article is the source of the scientific claims and benchmark tables. Its [Cambridge page](https://www.cambridge.org/core/journals/annals-of-actuarial-science/article/treelike-pairwise-interaction-networks/FC3DE8C10BEF68F9B2F2D1CC246C9C81) and PDF identify the article as © The Author(s), 2026, published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The showcase paraphrases its explanation and presents its benchmark numbers with attribution. Interactive explanations and new charts are adaptations, not figures supplied by the authors.

A copy of the published 24-page PDF was retrieved on 21 September 2026. SHA256: `9e1d531f78b81f9d50af6a17967fdfe9e14e4d833f80788b1d8336e6edf7a9c3`. It is retained in ignored `sources/private/` for verification. Cambridge dynamically stamps downloaded PDFs with the requesting network address. The site therefore links directly to Cambridge instead of distributing this downloaded copy. No private manuscript, editorial letter or review correspondence is deployed.

## Published benchmark data

`scripts/build_research_data.py` records and exports all 11 rows of published Table 2 (French data, PDF page 13) and all eight rows of Table 4 (Belgian data, PDF page 21). Both rendered PDF pages were visually inspected. Table values agree with the supplied June R2 manuscript, but the published tables are authoritative. Cambridge's HTML accessibility descriptions are misassigned for some tables, so they were not used for numerical transcription.

The exports are `site/data/research.json`, `research.js` (the same object assigned to `window.PIN_RESEARCH`) and `benchmarks.csv`. Raw deviance is stored in `train`, `test`, `trainSd` and `sd`. Paper-display values are retained separately: 23.667 in the paper corresponds to raw deviance 0.23667. Smaller values indicate better predictive performance under this metric.

Single neural-model rows are means over 10 independently initialized fits; their reported standard deviations describe fit-to-fit variation, not uncertainty intervals for a population effect. Ensemble rows evaluate an average of predictions from 10 models and have no reported standard deviation. The parameter column is per constituent model, including ensemble rows. The French GAM's 66.7 is effective degrees of freedom, not an integer parameter count.

The French learning and test counts are 610,206 and 67,801; their sum is 678,007. The validation set uses 10% of the learning sample. The Belgian total is 163,212 and its stated learning/test ratio is 90/10. Exact Belgian integer split sizes are not stated, so the export leaves `learning` and `test` null rather than inventing a rounding convention.

These are published results, not results of a new training campaign or an independent replication. All performance comparisons refer to the models and datasets actually reported. In particular, the paper discusses connections to gradient boosting but these tables do not contain a GBM benchmark.

## Sources for model demonstrations

The [authors' public repository](https://github.com/wueth/Tree-Like-PIN) supplies `Example v11 - GitHub.zip`: cleaned French data, R fitting and SHAP scripts, and ten pre-fitted `PIN_Diag100` through `PIN_Diag109` weight files. Archive SHA256: `6d42a3237dc01e9cd9794607e8e4ce9b2b36d4fc489dd80d0ab9d5b40fe3ab48`. Its internal file dates precede the published paper. The archive does not supply Belgian model weights or forward-selection fits. Saved-model inference has a separate verification record and must not be described as newly trained evidence.

## Source discrepancies and presentation decisions

1. **Continuous embedding activation order.** Published Equation 2.2 places tanh between the first and second affine transformations. The released R functions place a linear dense layer of width 20 before a tanh dense layer of width 10. Both use the same parameter dimensions, so parameter count alone does not reconcile them. A demonstration from the released weights must follow the released R inference graph and identify that source. It must not claim exact reproduction of Equation 2.2 without further evidence.
2. **Belgian pair count.** Section 5 prints `10 × 11 / 2 = 66` and a strict off-diagonal index, which are inconsistent. Section 2 defines upper-triangular units including the diagonal. With 11 features there are 11 × 12 / 2 = 66 units: 11 self terms and 55 distinct pairs. The showcase uses this consistent arithmetic.
3. **Abstract scope.** The abstract mentions the French application; Section 5 additionally presents the Belgian application. Both published experiments are included. This is not an additional experiment performed for the site.
4. **Explainability scope.** The exact paired-permutation SHAP argument concerns a fixed empirical-background interventional value function on the link scale. It does not automatically apply to the log of an arithmetic ensemble of response-scale predictions. Direct pair terms can contain main-effect components; they are not uniquely identified causal or purified interaction effects.
5. **Interaction-selection scope.** Section 4.1 trains a separate multi-output network over a frozen additive baseline, then compares predictive-loss reductions. Its rankings are not a ranking of full-model pair weights. French first-round selection chooses BonusMalus × VehBrand; after including that pair the next choice becomes DrivAge × BonusMalus. The analogous Belgian sequence starts with longitude × latitude, then bonus-malus × vehicle age.
6. **Surface scope.** The paper's all-feature driver-age/density plot is an M-plot of portfolio predictions. A learned pair component, a prediction with other inputs fixed, and this observed-portfolio projection answer different questions. Labels should preserve these distinctions. Claim-frequency output is not a quoted premium or a causal effect.

## Verification

Rebuild with `python scripts/build_research_data.py`. The export is deterministic and requires only the Python standard library. Verification checks all 19 source rows, raw-to-display conversions, neural SD presence, ensemble SD absence and per-dataset minimum test loss. Scientific benchmark transcription and separate saved-model inference checks do not imply production validation.
