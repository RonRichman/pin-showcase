#!/usr/bin/env python3
"""Check portable site links and the numerical evidence shipped to readers."""
import json
import math
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        for name in ("href", "src"):
            if name in attrs:
                self.links.append(attrs[name])


def check(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    page = Page()
    page.feed((SITE / "index.html").read_text())
    check(len(page.ids) == len(set(page.ids)), "Duplicate HTML identifiers")
    for link in page.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc:
            continue
        if parsed.path:
            check((SITE / unquote(parsed.path)).is_file(), f"Missing local asset: {link}")
        elif parsed.fragment:
            check(parsed.fragment in page.ids, f"Missing anchor: {link}")

    research = json.loads((SITE / "data/research.json").read_text())
    models = json.loads((SITE / "data/model-exhibits.json").read_text())
    for name, global_name, data in [("research", "PIN_RESEARCH", research), ("model-exhibits", "PIN_MODEL", models)]:
        js = (SITE / f"data/{name}.js").read_text()
        start = js.index("=", js.index(f"window.{global_name}")) + 1
        check(json.loads(js[start:].strip().rstrip(";")) == data, f"Browser JSON mismatch: {name}")
    for key, expected, count in [("france", .23667, 11), ("belgium", .52826, 8)]:
        rows = research["datasets"][key]["benchmarks"]
        check(len(rows) == count, f"Incomplete {key} table")
        winner = min(rows, key=lambda row: row["test"])
        check("PIN" in winner["name"] and winner["test"] == expected, f"Published result mismatch: {key}")
        for row in rows:
            check(f'{row["test"] * 100:.3f}' == row["paperTest"], "Benchmark unit conversion")
    for pair in models["pairs"]:
        nx, ny = len(pair["xValues"]), len(pair["yValues"])
        for field in ("values", "support", "supportMask"):
            grid = pair[field]
            check(len(grid) == ny and all(len(row) == nx for row in grid), f"Grid dimensions: {pair['id']}")
        check(sum(map(sum, pair["support"])) == 610206, "Support grid must conserve the learning population")
        for values, counts, mask in zip(pair["values"], pair["support"], pair["supportMask"]):
            check(all(math.isfinite(value) for value in values), "Non-finite model surface")
            check(all(present == (n >= pair["supportThreshold"]) for n, present in zip(counts, mask)), "Support hatching threshold")
    for profile in models["profiles"]:
        total = profile["baselineLog"] + sum(c["value"] for c in profile["contributions"])
        check(abs(total - profile["logPrediction"]) < 1e-10, "SHAP allocation fails to reconstruct prediction")
        check(abs(math.exp(total) - profile["frequency"]) < 1e-10, "Frequency link mismatch")
        check(len(profile["contributions"]) == 9, "Missing feature explanation")
    validation = models["validation"]
    check(validation["testRows"] == 67801, "Incorrect model test split")
    check(round(validation["ensembleTestDeviance"], 3) == 23.667, "Saved-model diagnostic no longer reconciles after rounding")
    check(validation["maxShapAll512CoalitionsError"] < 1e-10, "Exact SHAP cross-check failed")
    forbidden = {".rda", ".h5", ".zip", ".r", ".tex"}
    check(not any(p.suffix.lower() in forbidden for p in SITE.rglob("*") if p.is_file()), "Raw research artifacts must not ship as site assets")
    print("PASS: local links, 19 benchmark rows, data/JS parity, 3 support grids, 4 SHAP decompositions and model validation")


if __name__ == "__main__":
    main()
