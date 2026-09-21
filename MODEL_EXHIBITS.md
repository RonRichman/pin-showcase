# Saved-model exhibits

The interactive surfaces and profile explanations come from **PIN_Diag100**, a fitted model supplied with the authors' public repository. They are computed from saved weights, not drawn to resemble the paper. No model was trained for this site.

## Evidence boundary

The public repository's August 2025 example and its saved models form a coherent implementation: seven scalar embeddings have a linear Dense(20) layer followed by Dense(10, tanh). Published Equation 2.2, also present in the R2 manuscript, describes a different numeric-embedding arrangement. These exhibits therefore demonstrate the **repository model**, and the rerun loss figures are **repository diagnostics**, not an independent reproduction of the published experiments. The site's benchmark comparison uses the paper's reported results, separately labelled.

The NumPy implementation transcribes the repository's R/Keras model. A second computation in TensorFlow uses the original explicit pair concatenations and float32 arithmetic; NumPy uses float64 and factors the first shared dense layer for efficiency. This checks numerical implementation agreement. It does not independently establish that the selected HDF5 model is the exact checkpoint underlying a published table.

## Source and preparation

Source: <https://github.com/wueth/Tree-Like-PIN>, `Example v11 - GitHub.zip`:

- `freMTPL2freqClean.rda` contains 678,007 French motor records.
- `01_a PIN - fit networks.r` supplies architecture, preprocessing and evaluation definitions.
- `01_b PIN - SHAP on pre-fitted networks.r` supplies the explanation method.
- `Networks/PIN_Diag100.weights.h5` through `PIN_Diag109.weights.h5` supply ten fitted models.

The supplied `LearnTest` flag selects 610,206 learning records and 67,801 test records. The original script standardizes continuous variables using the full supplied data before splitting; this export preserves that behavior rather than silently changing the model inputs. Caps are 20 for vehicle age, 90 for driver age and 150 for bonus–malus. Density is log-transformed and rounded to two decimals in R. Factor ordering is read directly from R. Gas, brand and region use the source's factor codes minus one. R's sample standard deviation and rounding are retained.

Source hashes and each checkpoint hash appear in `verification/model-validation.json`. The exporter preserves source data and temporary numeric matrices under ignored `sources/private/`. No source records or policy identifiers are included in `site/`.

## Surface interpretation

There are 45 terms for nine features, including nine diagonal terms. Every displayed cell is the selected hard-sigmoid pair output multiplied by its fitted final-layer weight: one additive component of **log annual claim frequency**. It is an uncentred model component. It is not a marginal frequency, complete prediction, pure statistical interaction after main-effect subtraction, or causal effect.

Three surfaces are exported:

1. Driver age × bonus–malus: 37 × 41 cells.
2. Driver age × density: 37 × 41 cells, density logarithmically spaced.
3. Vehicle age × vehicle power: 21 × 12 cells.

`values[y][x]` is the fitted contribution. `support[y][x]` counts learning records in the surrounding grid cell; boundaries are grid midpoints, with open outer boundaries. Density-cell boundaries are geometric midpoints. Thus edge cells collect values beyond the displayed endpoint, consistent with displaying the capped age range. `supportMask[y][x]` is true at 20 or more records. A low-support cell still has a valid mathematical model output; its empirical support is limited. Counts across each grid sum to 610,206. No background averaging is necessary to evaluate a pair term because it only depends on its two selected inputs.

## Constructed profiles and SHAP

Four profiles share area C, vehicle power 6, vehicle age 5, Diesel fuel, brand B1 and region R24. The reference profile has driver age 45, bonus–malus 50 and density 300 people/km². The other profiles change:

- Young driver: age 22 and bonus–malus 100.
- Urban setting: density 5,000 people/km².
- Higher bonus–malus: bonus–malus 100.

These values are constructed; no individual policy was selected for publication. Each prediction uses an exposure of one year. Frequencies are expected annual claims, not probabilities of at least one claim and not insurance prices.

The explanations use **interventional SHAP on log annual frequency**, relative to a fixed 256-record learning-data background selected with NumPy RNG seed 20260921. The baseline is the mean log prediction on that background; its exponential is a geometric mean of frequencies, not the portfolio's arithmetic mean frequency. For an additive model of order at most two, a permutation and its reverse recover the exact Shapley values for the chosen empirical background. The exporter additionally enumerates all 512 feature coalitions for every displayed profile to check this shortcut independently.

The finite background approximates a population reference distribution. Interventional replacement can construct unusual combinations among correlated features. Additivity and the two-permutation result apply to the single model's log prediction. They should not be assumed to apply to the log of an arithmetic ensemble of frequencies.

## Validation and reproduction

All ten checkpoints were evaluated on all 67,801 held-out rows using the repository definition:

`100 × mean[2 × (predicted claims − observed claims + observed claims × log(observed claims / predicted claims))]`

The observed-zero logarithm term is zero; predicted claims equal frequency times exposure. This is a per-record denominator, not an exposure denominator.

- Seed 100 test deviance: **23.7640697434**.
- Arithmetic ten-model ensemble test deviance: **23.6672331227**.
- TensorFlow/NumPy cross-check: 512 held-out rows; maximum relative frequency difference **3.28 × 10⁻⁷**.
- SHAP baseline plus contributions reproduces each log prediction to numerical precision.
- All-coalition comparison, source hashes and exact residuals are recorded in the validation receipt.

Run from any directory, with R, NumPy, h5py and TensorFlow installed:

```sh
OPENBLAS_NUM_THREADS=1 python scripts/export_model_exhibits.py \
  --archive /path/to/Example-v11-GitHub.zip \
  --rscript /path/to/Rscript
```

Outputs: `site/data/model-exhibits.json`, its identical `window.PIN_MODEL` JavaScript wrapper, and `verification/model-validation.json`. The exporter makes no network calls and performs no fitting. The source archive remains private to the build; only aggregate grids and constructed-profile explanations are public.
