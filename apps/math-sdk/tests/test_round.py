from collections import Counter

from golf_crash_math.events import DEFAULT_EVENTS
from golf_crash_math.rng import Seed
from golf_crash_math.round import (
    HOUSE_EDGE,
    JACKPOT_MULT,
    crash_from_uniform,
    generate_round,
    generate_stake_engine_state,
)
from golf_crash_math.rtp import simulate


def test_crash_from_uniform_house_edge_returns_one() -> None:
    assert crash_from_uniform(0.0) == 1.0
    assert crash_from_uniform(HOUSE_EDGE - 1e-9) == 1.0


def test_crash_from_uniform_post_edge_at_least_one() -> None:
    for u in [HOUSE_EDGE, 0.5, 0.9, 0.999]:
        assert crash_from_uniform(u) >= 1.0


def test_generate_round_deterministic() -> None:
    s = Seed(server_seed="abc", client_seed="xyz", nonce=42)
    r1 = generate_round(s)
    r2 = generate_round(s)
    assert r1.outcome == r2.outcome
    assert r1.crash_multiplier == r2.crash_multiplier
    assert r1.pre_shot_fail == r2.pre_shot_fail
    assert r1.crash_cause == r2.crash_cause


def test_outcome_distribution_over_many_rounds() -> None:
    counter: Counter[str] = Counter()
    rounds = 20_000
    for nonce in range(rounds):
        r = generate_round(Seed("dev", "dev", nonce))
        counter[r.outcome] += 1

    pre_shot_total = (
        DEFAULT_EVENTS.pre_shot_mole
        + DEFAULT_EVENTS.pre_shot_club_break
        + DEFAULT_EVENTS.pre_shot_self_hit
    )
    expected_pre_shot = rounds * pre_shot_total
    assert abs(counter["pre_shot_fail"] - expected_pre_shot) < expected_pre_shot * 0.5
    assert counter["crash"] > rounds * 0.95
    assert counter["hole_in_one"] >= 1


def test_hole_in_one_payout_is_jackpot() -> None:
    found = False
    for nonce in range(50_000):
        r = generate_round(Seed("dev", "dev", nonce))
        if r.outcome == "hole_in_one":
            assert r.crash_multiplier == JACKPOT_MULT
            assert r.pre_shot_fail is None
            found = True
            break
    assert found, "expected at least one hole-in-one in 50k rounds"


def test_decorative_events_within_flight_window() -> None:
    seed = Seed("dev", "dev", 7)
    r = generate_round(seed)
    if r.outcome == "crash":
        for ev in r.decorative_events:
            assert 0 <= ev.at_sec
            assert ev.kind in {"bird", "wind", "helicopter", "plane", "cart"}


def test_stake_engine_state_matches_frontend_contract() -> None:
    state = generate_stake_engine_state(Seed("dev", "dev", 3))

    assert state["roundId"].startswith("round-")
    assert state["serverSeedHash"]
    assert state["seed"] == {"serverSeed": "dev", "clientSeed": "dev", "nonce": 3}
    assert state["outcome"] in {"preShotFail", "holeInOne", "crash"}
    assert state["landingZone"] in {"fairway", "sand", "water", "cart", "hole"}
    assert isinstance(state["finalMultiplier"], float | int)
    assert isinstance(state["crashMultiplier"], float | int)
    assert isinstance(state["crashAtSec"], float | int)
    assert isinstance(state["decorativeEvents"], list)


def test_simulate_rtp_in_reasonable_range() -> None:
    """Total RTP ≈ jackpot_contrib + (1 - p_jackpot - p_pre_shot) * (1 - house_edge).

    For HOUSE_EDGE=0.06, JACKPOT_PROB=0.005, JACKPOT_MULT=10, pre_shot≈0.015:
    expected ≈ 0.05 + 0.98 * 0.94 = 0.971.
    """
    out = simulate(rounds=50_000, cashout_target=1.5)
    assert 0.93 < out["rtp"] < 1.02, f"RTP out of range: {out['rtp']:.4f}"
