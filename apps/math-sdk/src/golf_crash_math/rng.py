"""Provably Fair SHA-256 RNG."""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass


@dataclass(frozen=True)
class Seed:
    server_seed: str
    client_seed: str
    nonce: int


def server_seed_hash(server_seed: str) -> str:
    return hashlib.sha256(server_seed.encode()).hexdigest()


def hmac_stream(seed: Seed, cursor: int = 0) -> bytes:
    message = f"{seed.client_seed}:{seed.nonce}:{cursor}".encode()
    return hmac.new(seed.server_seed.encode(), message, hashlib.sha256).digest()


def floats(seed: Seed, count: int) -> list[float]:
    """Yield `count` deterministic floats in [0, 1) from the seed."""
    out: list[float] = []
    cursor = 0
    while len(out) < count:
        digest = hmac_stream(seed, cursor)
        for i in range(0, len(digest), 4):
            if len(out) >= count:
                break
            chunk = digest[i : i + 4]
            value = int.from_bytes(chunk, "big") / 0x1_0000_0000
            out.append(value)
        cursor += 1
    return out
