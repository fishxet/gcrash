"""RTP simulation harness."""

from __future__ import annotations

from .rng import Seed
from .round import JACKPOT_MULT, generate_round


def simulate(
    rounds: int = 100_000,
    cashout_target: float = 1.5,
    server_seed: str = "dev-server",
    client_seed: str = "dev-client",
) -> dict[str, float]:
    total_bet = 0.0
    total_payout = 0.0
    pre_shot_fails = 0
    jackpots = 0
    crash_losses = 0
    cashout_wins = 0

    for nonce in range(rounds):
        seed = Seed(server_seed=server_seed, client_seed=client_seed, nonce=nonce)
        result = generate_round(seed)
        total_bet += 1.0

        if result.outcome == "pre_shot_fail":
            pre_shot_fails += 1
            continue

        if result.outcome == "hole_in_one":
            payout = max(cashout_target, JACKPOT_MULT)
            total_payout += payout
            jackpots += 1
            continue

        if result.crash_multiplier >= cashout_target:
            total_payout += cashout_target
            cashout_wins += 1
        else:
            crash_losses += 1

    rtp = total_payout / total_bet if total_bet else 0.0
    return {
        "rounds": float(rounds),
        "rtp": rtp,
        "cashout_target": cashout_target,
        "pre_shot_fails": float(pre_shot_fails),
        "jackpots": float(jackpots),
        "crash_losses": float(crash_losses),
        "cashout_wins": float(cashout_wins),
    }
