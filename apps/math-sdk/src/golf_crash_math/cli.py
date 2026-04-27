"""Command-line entry: `python -m golf_crash_math.cli simulate`."""

from __future__ import annotations

import argparse

from .rtp import simulate


def main() -> None:
    parser = argparse.ArgumentParser(prog="golf-crash-math")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sim = sub.add_parser("simulate", help="Run RTP simulation")
    sim.add_argument("--rounds", type=int, default=100_000)
    sim.add_argument("--target", type=float, default=1.5, help="Fixed cashout target")

    args = parser.parse_args()
    if args.cmd == "simulate":
        out = simulate(rounds=args.rounds, cashout_target=args.target)
        print(
            f"Rounds: {int(out['rounds']):,}  target: x{out['cashout_target']:.2f}  "
            f"RTP: {out['rtp'] * 100:.4f}%  "
            f"cashouts: {int(out['cashout_wins'])}  "
            f"crashes: {int(out['crash_losses'])}  "
            f"jackpots: {int(out['jackpots'])}  "
            f"pre-shot fails: {int(out['pre_shot_fails'])}"
        )


if __name__ == "__main__":
    main()
