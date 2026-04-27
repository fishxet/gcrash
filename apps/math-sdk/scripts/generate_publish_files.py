from __future__ import annotations

import csv
import json
import subprocess
from pathlib import Path

from golf_crash_math.rng import Seed
from golf_crash_math.round import generate_stake_engine_state

ROOT = Path(__file__).resolve().parents[1]
PUBLISH_DIR = ROOT / "library" / "publish_files"
MODE_NAME = "base"
BOOKS_JSONL = PUBLISH_DIR / "books_base.jsonl"
BOOKS_ZST = PUBLISH_DIR / "books_base.jsonl.zst"
LOOKUP_CSV = PUBLISH_DIR / "lookUpTable_base_0.csv"
INDEX_JSON = PUBLISH_DIR / "index.json"
ROOT_INDEX_JSON = ROOT / "index.json"
ROUNDS = 20_000
PROBABILITY_WEIGHT = 1


def payout_multiplier(state: dict) -> int:
    """Stake Engine expects x100 integer payout multipliers."""

    return int(round(float(state["finalMultiplier"]) * 100))


def event_payload(state: dict) -> dict:
    return {
        "type": "roundState",
        "state": state,
    }


def write_index(path: Path, events: str, weights: str) -> None:
    path.write_text(
        json.dumps(
            {
                "modes": [
                    {
                        "name": MODE_NAME,
                        "cost": 1.0,
                        "events": events,
                        "weights": weights,
                    }
                ]
            },
            indent=2,
        )
        + "\n",
        encoding="utf8",
    )


def main() -> None:
    PUBLISH_DIR.mkdir(parents=True, exist_ok=True)

    with BOOKS_JSONL.open("w", encoding="utf8") as books, LOOKUP_CSV.open(
        "w", encoding="utf8", newline=""
    ) as lookup_file:
        lookup = csv.writer(lookup_file)
        for idx in range(1, ROUNDS + 1):
            state = generate_stake_engine_state(Seed("stake-engine-publish", "base", idx))
            payout = payout_multiplier(state)
            books.write(
                json.dumps(
                    {
                        "id": idx,
                        "events": [event_payload(state)],
                        "payoutMultiplier": payout,
                    },
                    separators=(",", ":"),
                )
                + "\n"
            )
            lookup.writerow([idx, PROBABILITY_WEIGHT, payout])

    subprocess.run(["zstd", "-q", "-f", str(BOOKS_JSONL), "-o", str(BOOKS_ZST)], check=True)
    BOOKS_JSONL.unlink()

    write_index(INDEX_JSON, BOOKS_ZST.name, LOOKUP_CSV.name)
    write_index(
        ROOT_INDEX_JSON,
        f"library/publish_files/{BOOKS_ZST.name}",
        f"library/publish_files/{LOOKUP_CSV.name}",
    )
    print(f"Wrote Stake Engine math publish files to {PUBLISH_DIR}")


if __name__ == "__main__":
    main()
