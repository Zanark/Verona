"""Bounded real-head performance qualification, with isolated caches/profile."""
import argparse
import json
from pathlib import Path

from tests.run_idle_smoke import MODELS, run
from verona.desktop import ELECTRON


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", choices=(*MODELS, "all"), default="claire")
    parser.add_argument("--checks-only", action="store_true",
                        help="Skip the eight 16-second Claire measurement windows.")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists() or not ELECTRON.is_file():
        parser.error("Use a new receipt directory and the explicitly installed desktop runtime.")
    output.mkdir(parents=True)
    reports = []
    for model in MODELS if args.model == "all" else (args.model,):
        target = output / model
        target.mkdir()
        run(model, target, name="performance",
            extra_args=("--checks-only",) if args.checks_only else ())
        reports.append(json.loads((target / "performance-report.json").read_text()))
    (output / "all-models.json").write_text(json.dumps({
        "models": reports, "ownedResourcesStopped": True,
        "limits": "Isolated unfocused native windows; synthetic cursor, muted playback, not OS composition or whole-machine benchmarks.",
    }, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
