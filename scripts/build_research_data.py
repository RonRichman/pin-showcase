"""Export the published PIN tables; no model fitting is performed."""

import csv
import json
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "data"
ARTICLE = "https://www.cambridge.org/core/journals/annals-of-actuarial-science/article/treelike-pairwise-interaction-networks/FC3DE8C10BEF68F9B2F2D1CC246C9C81"
PDF = "https://www.cambridge.org/core/services/aop-cambridge-core/content/view/FC3DE8C10BEF68F9B2F2D1CC246C9C81/S1748499526100402a.pdf/tree-like-pairwise-interaction-networks.pdf"

# Published Tables 2 and 4, visually verified against PDF pages 13 and 21.
# Columns: name, kind, parameters, train, test, train SD, test SD.
FRANCE = [
    ("Null model (intercept-only)", "baseline", 1, "25.213", "25.445", None, None),
    ("Poisson GLM3", "baseline", 50, "24.084", "24.102", None, None),
    ("Poisson GAM", "baseline", 66.7, "23.920", "23.956", None, None),
    ("Plain-vanilla FNN", "single", 792, "23.728", "23.819", "0.026", "0.017"),
    ("Ensemble plain-vanilla FNN", "ensemble", 792, "23.691", "23.783", None, None),
    ("CAFFT", "single", 27133, "23.715", "23.807", "0.047", "0.017"),
    ("Ensemble CAFFT", "ensemble", 27133, "23.630", "23.726", None, None),
    ("Credibility Transformer", "single", 1746, "23.641", "23.788", "0.053", "0.040"),
    ("Ensemble Credibility Transformer", "ensemble", 1746, "23.562", "23.711", None, None),
    ("Tree-like PIN", "single", 4147, "23.593", "23.740", "0.046", "0.025"),
    ("Ensemble tree-like PIN", "ensemble", 4147, "23.522", "23.667", None, None),
]
BELGIUM = [
    ("Null model (intercept-only)", "baseline", 1, "55.071", "55.062", None, None),
    ("Poisson GLM", "baseline", 13, "53.494", "53.338", None, None),
    ("Plain-vanilla FNN", "single", 1166, "53.357", "53.168", "0.052", "0.067"),
    ("Ensemble plain-vanilla FNN", "ensemble", 1166, "53.123", "52.976", None, None),
    ("Credibility Transformer", "single", 1646, "53.153", "53.045", "0.104", "0.122"),
    ("Ensemble Credibility Transformer", "ensemble", 1646, "53.043", "52.934", None, None),
    ("Tree-like PIN", "single", 4828, "53.107", "52.927", "0.100", "0.098"),
    ("Ensemble tree-like PIN", "ensemble", 4828, "53.008", "52.826", None, None),
]


def raw(value):
    return float(Decimal(value) / 100)


def benchmarks(rows):
    result = []
    for name, kind, parameters, train, test, train_sd, sd in rows:
        row = dict(name=name, kind=kind, parameters=parameters, train=raw(train), test=raw(test),
                   paperTrain=train, paperTest=test, runs=10 if kind != "baseline" else 1,
                   parameterBasis="effective degrees of freedom" if name == "Poisson GAM" else "per model")
        if sd is not None:
            row.update(sd=raw(sd), trainSd=raw(train_sd), paperSd=sd, paperTrainSd=train_sd)
        result.append(row)
    return result


def main():
    research = {
        "citation": {
            "title": "Tree-like pairwise interaction networks",
            "authors": ["Ronald Richman", "Salvatore Scognamiglio", "Mario Wüthrich"],
            "doi": "10.1017/S1748499526100402", "url": ARTICLE,
            "published": "2026-09-18", "journal": "Annals of Actuarial Science",
            "pages": "1–24", "pdf": PDF, "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        },
        "metric": {
            "name": "Poisson deviance", "direction": "lower is better",
            "storedUnits": "raw deviance", "paperUnits": "10^-2", "paperDisplayMultiplier": 100,
            "singleModelMeaning": "Mean of 10 fitted models; SD describes variation across those fits.",
            "ensembleMeaning": "Deviance of the average prediction from 10 models; no ensemble SD is reported.",
        },
        "datasets": {
            "france": {
                "label": "French motor insurance", "policies": 678007, "learning": 610206,
                "test": 67801, "features": 9, "parameters": 4147, "pairUnits": 45,
                "mainEffects": 9, "offDiagonalPairs": 36, "learningFraction": 0.9,
                "validationFractionOfLearning": 0.1, "benchmarks": benchmarks(FRANCE),
                "source": "Published paper, Table 2 (page 13), Table 1 and Section 3.",
                "sourceUrl": PDF + "#page=13", "sourceTable": 2,
                "featureNames": ["Area", "VehPower", "VehAge", "DrivAge", "BonusMalus", "VehGas", "Density", "VehBrand", "Region"],
            },
            "belgium": {
                "label": "Belgian motor insurance", "policies": 163212, "learning": None,
                "test": None, "features": 11, "parameters": 4828, "pairUnits": 66,
                "mainEffects": 11, "offDiagonalPairs": 55, "learningFraction": 0.9,
                "splitNote": "The paper specifies a 90/10 learning/test split, without exact integer split counts.",
                "benchmarks": benchmarks(BELGIUM),
                "source": "Published paper, Table 4 (page 21), Table 3 and Section 5.",
                "sourceUrl": PDF + "#page=21", "sourceTable": 4,
                "featureNames": ["fuel", "coverage", "fleet", "use", "sex", "bm", "ageph", "long", "lat", "power", "agec"],
            },
        },
        "sources": [
            {"label": "Published article", "url": ARTICLE, "role": "Canonical scientific claims and benchmark results"},
            {"label": "Published PDF", "url": PDF, "role": "Visual verification of Tables 2 and 4"},
            {"label": "Authors' code and saved models", "url": "https://github.com/wueth/Tree-Like-PIN", "role": "Separate source for demonstrations using the released French models"},
        ],
        "limitations": [
            "Results concern the two datasets and the benchmarks reported in the paper; they do not establish universal superiority.",
            "Benchmark values are transcribed published results, not newly trained models or an independent replication.",
            "Neural single-model rows report means and standard deviations across 10 fits, not confidence intervals.",
            "Parameter counts are per model, including ensemble rows. The GAM entry is effective degrees of freedom.",
            "Pairwise additivity and the exact paired-permutation SHAP result apply on the link scale for the chosen empirical-background value function.",
            "Forward-selection interaction importance comes from separate fits with a frozen additive baseline; it is not a ranking of full-model output weights.",
            "The released R implementation places tanh after the second continuous-feature dense layer; Equation 2.2 places it after the first. Saved-model demonstrations follow the released implementation.",
        ],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(research, ensure_ascii=False, indent=2) + "\n"
    (OUT / "research.json").write_text(serialized)
    (OUT / "research.js").write_text("window.PIN_RESEARCH = " + serialized.rstrip() + ";\n")
    fields = ["dataset", "table", "name", "kind", "parameters", "parameter_basis", "runs",
              "train_raw", "test_raw", "train_sd_raw", "test_sd_raw", "train_paper_1e-2",
              "test_paper_1e-2", "train_sd_paper_1e-2", "test_sd_paper_1e-2", "source_doi"]
    with (OUT / "benchmarks.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for key, dataset in research["datasets"].items():
            for row in dataset["benchmarks"]:
                writer.writerow(dict(dataset=key, table=dataset["sourceTable"], name=row["name"],
                    kind=row["kind"], parameters=row["parameters"], parameter_basis=row["parameterBasis"],
                    runs=row["runs"], train_raw=row["train"], test_raw=row["test"],
                    train_sd_raw=row.get("trainSd", ""), test_sd_raw=row.get("sd", ""),
                    **{"train_paper_1e-2": row["paperTrain"], "test_paper_1e-2": row["paperTest"],
                       "train_sd_paper_1e-2": row.get("paperTrainSd", ""), "test_sd_paper_1e-2": row.get("paperSd", "")},
                    source_doi=research["citation"]["doi"]))
    print("Exported 19 published benchmark rows, JSON and browser data.")


if __name__ == "__main__":
    main()
