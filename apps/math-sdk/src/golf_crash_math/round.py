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

import math
from dataclasses import dataclass, field
from typing import Literal

from .events import DEFAULT_EVENTS, EventTable
from .rng import Seed, floats

HOUSE_EDGE = 0.06
MAX_CRASH = 1_000_000.0
JACKPOT_MULT = 10.0
JACKPOT_PROB = 0.005
GROWTH_C = 0.08
GROWTH_K = 1.6

PreShotFail = Literal["mole", "club_break", "self_hit"]
CrashCause = Literal["bird", "wind", "helicopter", "plane", "cart", "timeout"]
DecorativeKind = Literal["bird", "wind", "helicopter", "plane", "cart"]
Outcome = Literal["pre_shot_fail", "hole_in_one", "crash"]


@dataclass(frozen=True)
class DecorativeEvent:
    kind: DecorativeKind
    at_sec: float


@dataclass(frozen=True)
class RoundResult:
    seed: Seed
    outcome: Outcome
    crash_multiplier: float  # the multiplier at which flight ends (1.0 for pre_shot_fail)
    pre_shot_fail: PreShotFail | None = None
    crash_cause: CrashCause | None = None
    decorative_events: list[DecorativeEvent] = field(default_factory=list)


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


def _pick_crash_cause(u: float) -> CrashCause:
    weights: list[tuple[CrashCause, float]] = [
        ("bird", 0.30),
        ("wind", 0.25),
        ("helicopter", 0.15),
        ("plane", 0.10),
        ("cart", 0.10),
        ("timeout", 0.10),
    ]
    cum = 0.0
    for kind, p in weights:
        cum += p
        if u < cum:
            return kind
    return "timeout"


def _schedule_decorative(rolls: list[float], crash_t: float) -> list[DecorativeEvent]:
    """Spread up to N decorative events across the flight duration."""
    out: list[DecorativeEvent] = []
    if crash_t <= 0.4:
        return out
    slot_spacing = 0.7
    weights: list[tuple[DecorativeKind, float]] = [
        ("bird", 0.4),
        ("wind", 0.3),
        ("helicopter", 0.2),
        ("plane", 0.15),
        ("cart", 0.1),
    ]
    cursor = 0
    for slot in range(6):
        base_t = 0.4 + slot * slot_spacing
        if base_t >= crash_t - 0.2:
            break
        if cursor + 1 >= len(rolls):
            break
        jitter = rolls[cursor]
        pick = rolls[cursor + 1]
        cursor += 2
        t = min(crash_t - 0.2, base_t + jitter * 0.5)
        cum = 0.0
        for kind, p in weights:
            cum += p
            if pick < cum:
                out.append(DecorativeEvent(kind=kind, at_sec=t))
                break
    return out


def generate_round(seed: Seed, table: EventTable = DEFAULT_EVENTS) -> RoundResult:
    rolls = floats(seed, count=32)

    pre_shot = _pick_pre_shot_fail(rolls[0], table)
    if pre_shot is not None:
        return RoundResult(
            seed=seed,
            outcome="pre_shot_fail",
            crash_multiplier=1.0,
            pre_shot_fail=pre_shot,
        )

    if rolls[1] < JACKPOT_PROB:
        crash_t = time_for_multiplier(JACKPOT_MULT)
        decorative = _schedule_decorative(rolls[2:], crash_t)
        return RoundResult(
            seed=seed,
            outcome="hole_in_one",
            crash_multiplier=JACKPOT_MULT,
            decorative_events=decorative,
        )

    crash_mult = crash_from_uniform(rolls[2])
    cause = _pick_crash_cause(rolls[3])
    crash_t = time_for_multiplier(crash_mult)
    decorative = _schedule_decorative(rolls[4:], crash_t)
    return RoundResult(
        seed=seed,
        outcome="crash",
        crash_multiplier=crash_mult,
        crash_cause=cause,
        decorative_events=decorative,
    )
