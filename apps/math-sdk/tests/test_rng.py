from golf_crash_math.rng import Seed, floats, server_seed_hash


def test_floats_deterministic() -> None:
    seed = Seed(server_seed="abc", client_seed="xyz", nonce=0)
    a = floats(seed, 16)
    b = floats(seed, 16)
    assert a == b
    assert all(0.0 <= x < 1.0 for x in a)


def test_server_seed_hash_stable() -> None:
    assert server_seed_hash("abc") == server_seed_hash("abc")
    assert server_seed_hash("abc") != server_seed_hash("abd")
