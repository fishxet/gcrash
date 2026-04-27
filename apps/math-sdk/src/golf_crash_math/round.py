"""Crash round generation: deterministic round plan ("book") from a seed.

A round resolves to exactly one outcome:
  * pre_shot_fail — the player never gets to swing (mole, club break, self hit).
  * hole_in_one — ball lands in the hole at JACKPOT_MULT (auto-win).
  * crash — multiplier rises to crash_multiplier, attributed to a cause event.

Decorative events are pure visual flavor that fire mid-flight without changing
the outcome. The Bustabit-style formula with HOUSE_EDGE is used for the regular
crash distribution.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Any, Literal

from .events import DEFAULT_EVENTS, EventTable
from .rng import Seed, floats, server_seed_hash

HOUSE_EDGE = 0.06
MAX_CRASH = 1_000_000.0
JACKPOT_MULT = 10.0
JACKPOT_PROB = 0.005
GROWTH_C = 0.08
GROWTH_K = 1.6

PreShotFail = Literal["mole", "club_break", "self_hit"]
CrashCause = Literal["bird", "wind", "helicopter", "plane", "cart", "timeout", "fakeBoost"]
DecorativeKind = Literal["bird", "wind", "helicopter", "plane", "cart"]
Outcome = Literal["pre_shot_fail", "hole_in_one", "crash"]
LandingZone = Literal["fairway", "sand", "water", "cart", "hole"]


@dataclass(frozen=True)
class DecorativeEvent:
    kind: DecorativeKind
    at_sec: float


@dataclass(frozen=True)
class RoundResult:
    seed: Seed
    outcome: Outcome
    crash_multiplier: float  # the multiplier at which flight ends (1.0 for pre_shot_fail)
    final_multiplier: float
    landing_zone: LandingZone
    crash_at_sec: float
    pre_shot_fail: PreShotFail | None = None
    crash_cause: CrashCause | None = None
    decorative_events: list[DecorativeEvent] = field(default_factory=list)

    @property
    def round_id(self) -> str:
        digest = hashlib.sha256(
            f"{self.seed.server_seed}:{self.seed.client_seed}:{self.seed.nonce}".encode()
        ).hexdigest()
        return f"round-{digest[:16]}"

    def to_stake_engine_state(self) -> dict[str, Any]:
        """Return the camelCase round.state contract consumed by the web client."""

        pre_shot_fail = {
            "club_break": "clubBreak",
            "self_hit": "selfHit",
        }.get(self.pre_shot_fail or "", self.pre_shot_fail)
        outcome = {
            "pre_shot_fail": "preShotFail",
            "hole_in_one": "holeInOne",
        }.get(self.outcome, self.outcome)
        return {
            "roundId": self.round_id,
            "seed": {
                "serverSeed": self.seed.server_seed,
                "clientSeed": self.seed.client_seed,
                "nonce": self.seed.nonce,
            },
            "serverSeedHash": server_seed_hash(self.seed.server_seed),
            "finalMultiplier": self.final_multiplier,
            "outcome": outcome,
            "landingZone": self.landing_zone,
            "crashMultiplier": self.crash_multiplier,
            "crashAtSec": self.crash_at_sec,
            "preShotFail": pre_shot_fail,
            "crashCause": self.crash_cause,
            "decorativeEvents": [
                {"kind": event.kind, "atSec": event.at_sec}
                for event in self.decorative_events
            ],
        }


def crash_from_uniform(u: float, house_edge: float = HOUSE_EDGE) -> float:
    if not 0.0 <= u < 1.0:
        raise ValueError(f"u must be in [0,1), got {u}")
    if u < house_edge:
        return 1.0
    rescaled = (u - house_edge) / (1.0 - house_edge)
    if rescaled >= 1.0:
        return MAX_CRASH
    raw = 1.0 / (1.0 - rescaled)
    crash = math.floor(raw * 100) / 100
    return min(max(crash, 1.0), MAX_CRASH)


def time_for_multiplier(mult: float) -> float:
    if mult <= 1.0:
        return 0.0
    return ((mult - 1.0) / GROWTH_C) ** (1.0 / GROWTH_K)


def _pick_pre_shot_fail(u: float, table: EventTable) -> PreShotFail | None:
    cum = 0.0
    options: list[tuple[PreShotFail, float]] = [
        ("mole", table.pre_shot_mole),
        ("club_break", table.pre_shot_club_break),
        ("self_hit", table.pre_shot_self_hit),
    ]
    for kind, p in options:
        cum += p
        if u < cum:
            return kind
    return None


def _pick_crash_cause(u: float, crash_at_sec: float) -> CrashCause:
    options: list[CrashCause] = ["cart", "wind", "bird", "helicopter", "plane", "timeout", "fakeBoost"]
    return options[min(len(options) - 1, math.floor(u * len(options)))]


def _flight_duration(u: float) -> float:
    return 5.0 + u * 3.0


def _pick_landing_zone(u: float, cause: CrashCause) -> LandingZone:
    if cause == "cart":
        return "cart"
    if cause == "timeout" or cause == "fakeBoost":
        return "water"
    if u < 0.55:
        return "fairway"
    if u < 0.78:
        return "sand"
    return "water"


def _schedule_decorative(rolls: list[float], crash_t: float) -> list[DecorativeEvent]:
    """Spread up to N decorative events across the flight duration."""
    out: list[DecorativeEvent] = []
    if crash_t <= 0.4:
        return out
    def pick_for_progress(u: float, progress: float) -> DecorativeKind:
        if progress < 0.25:
            options: list[DecorativeKind] = ["cart", "wind", "bird"]
        elif progress < 0.65:
            options = ["wind", "bird", "helicopter"]
        else:
            options = ["bird", "helicopter", "plane"]
        return options[min(len(options) - 1, math.floor(u * len(options)))]

    cursor = 0
    max_events = min(6, max(1, math.floor(crash_t / 0.75)))
    for slot in range(max_events):
        progress = (slot + 1) / (max_events + 1)
        base_t = crash_t * progress
        if base_t >= crash_t - 0.2:
            break
        if cursor + 1 >= len(rolls):
            break
        jitter = rolls[cursor]
        pick = rolls[cursor + 1]
        cursor += 2
        t = min(crash_t - 0.2, base_t + (jitter - 0.5) * 0.35)
        out.append(DecorativeEvent(kind=pick_for_progress(pick, progress), at_sec=t))
    return out


def generate_round(seed: Seed, table: EventTable = DEFAULT_EVENTS) -> RoundResult:
    rolls = floats(seed, count=32)

    pre_shot = _pick_pre_shot_fail(rolls[0], table)
    if pre_shot is not None:
        return RoundResult(
            seed=seed,
            outcome="pre_shot_fail",
            crash_multiplier=1.0,
            final_multiplier=0.0,
            landing_zone="water",
            crash_at_sec=0.0,
            pre_shot_fail=pre_shot,
        )

    if rolls[1] < JACKPOT_PROB:
        crash_t = _flight_duration(rolls[2])
        decorative = _schedule_decorative(rolls[3:], crash_t)
        return RoundResult(
            seed=seed,
            outcome="hole_in_one",
            crash_multiplier=JACKPOT_MULT,
            final_multiplier=JACKPOT_MULT,
            landing_zone="hole",
            crash_at_sec=crash_t,
            decorative_events=decorative,
        )

    crash_mult = crash_from_uniform(rolls[2])
    crash_t = _flight_duration(rolls[5])
    cause = _pick_crash_cause(rolls[3], crash_t)
    landing_zone = _pick_landing_zone(rolls[4], cause)
    decorative = _schedule_decorative(rolls[6:], crash_t)
    return RoundResult(
        seed=seed,
        outcome="crash",
        crash_multiplier=crash_mult,
        final_multiplier=crash_mult,
        landing_zone=landing_zone,
        crash_at_sec=crash_t,
        crash_cause=cause,
        decorative_events=decorative,
    )


def generate_stake_engine_state(seed: Seed, table: EventTable = DEFAULT_EVENTS) -> dict[str, Any]:
    return generate_round(seed, table).to_stake_engine_state()
