"""Command-line entry: `python -m golf_crash_math.cli simulate`."""

from __future__ import annotations

import argparse
import json

from .rng import Seed
from .round import generate_stake_engine_state
from .rtp import simulate


def main() -> None:
    parser = argparse.ArgumentParser(prog="golf-crash-math")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sim = sub.add_parser("simulate", help="Run RTP simulation")
    sim.add_argument("--rounds", type=int, default=100_000)
    sim.add_argument("--target", type=float, default=1.5, help="Fixed cashout target")

    state = sub.add_parser("state", help="Print a Stake Engine-compatible round.state JSON")
    state.add_argument("--server-seed", required=True)
    state.add_argument("--client-seed", required=True)
    state.add_argument("--nonce", type=int, required=True)

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
    elif args.cmd == "state":
        seed = Seed(
            server_seed=args.server_seed,
            client_seed=args.client_seed,
            nonce=args.nonce,
        )
        print(json.dumps(generate_stake_engine_state(seed), separators=(",", ":")))


if __name__ == "__main__":
    main()
