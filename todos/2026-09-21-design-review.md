# PIN showcase design review

Reviewed the published version at `41bc211` through independent visual and
interaction reviews, then reviewed the revised desktop and mobile experience.
All findings below are resolved in `feat/design-polish`.

| Severity | Finding | Acceptance criteria and resolution |
| --- | --- | --- |
| P1 | Diverging colours implied a sign change in nonnegative pair surfaces. | Sequential cream-to-copper scale, labelled minimum/midpoint/maximum, and an explicit statement that each pair has its own scale. Numeric grids unchanged. |
| P2 | Sparse support was hard to interpret. | Visible hatch key states fewer than 20 learning records; support starts visible and can be toggled without altering predictions. |
| P2 | Pair choices were hidden in a select. | All three relationships are visible buttons with a selected state and keyboard support. |
| P2 | Mobile surface inspection separated selection from its value. | Selected features, contribution and support stay beside the plot; actual touch selection updates the same source cell as sliders. |
| P2 | Density ticks and the axis title crowded each other. | Compact tick labels and a wider mobile gutter; full feature values remain available in controls. |
| P2 | Mobile benchmark endpoint labels clipped horizontally and vertically. | Tick bounding boxes fit the SVG at 320, 390, 768 and 1440 pixels for both countries, comparison types and chart scopes (32 combinations). |
| P2 | Chapter navigation lacked orientation and discoverability. | Active chapter and reading progress are visible; a mobile arrow reveals later or earlier chapters without moving keyboard focus or vertical scroll. |
| P2 | Thin slider tracks were difficult touch targets. | Native range controls have targets at least 44 pixels high while retaining keyboard operation. |
| P2 | Architecture steps needed a clearer guided path. | Previous/next controls show step count, respect boundaries, and highlight the Combine output on mobile. |
| P2 | Benchmark baselines compressed neural-model differences. | Optional, explicitly rescaled neural-only view; all-model view remains default and the complete published table stays visible. Whiskers are included in axis bounds. |
| P2 | Prediction explanations reordered features across examples. | Stable feature order and a visible direction legend make examples easier to compare. |
| P3 | Mobile chapter edge fragments and verbose inline units added visual noise. | Faded overflow edge, directional end-state arrow and shorter selected-point labels. |

## Verification

- Independent visual review inspected desktop and mobile layouts, with a second
  pass at 320 and 390 pixels. No blocking visual findings remained.
- `verification/design-browser-qa.json`: all 14 browser groups passed; source
  hashes stayed unchanged during the run. Coverage includes real touch,
  keyboard, navigation, source values and chart bounds.
- `python3 scripts/check_site.py`: all 19 published benchmark rows, three pair
  support grids and four SHAP decompositions reconcile to their source files.
- JavaScript syntax and `git diff --check` pass.
- No research data or model artifacts changed and no models were retrained.

Accessibility checks cover keyboard behaviour and semantics. Axe-core was not
installed, so this is not a full accessibility audit.
