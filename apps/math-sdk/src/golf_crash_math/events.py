"""Probabilities for pre-shot, in-flight, and bonus events."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EventTable:
    pre_shot_mole: float
    pre_shot_club_break: float
    pre_shot_self_hit: float
    in_flight_bird: float
    in_flight_wind: float
    in_flight_helicopter: float
    in_flight_plane: float
    in_flight_cart: float
    bonus_trigger: float
    fake_boost: float
    near_miss_target: float


DEFAULT_EVENTS = EventTable(
    pre_shot_mole=0.005,
    pre_shot_club_break=0.005,
    pre_shot_self_hit=0.005,
    in_flight_bird=0.05,
    in_flight_wind=0.05,
    in_flight_helicopter=0.02,
    in_flight_plane=0.01,
    in_flight_cart=0.02,
    bonus_trigger=0.01,
    fake_boost=0.02,
    near_miss_target=0.30,
)
