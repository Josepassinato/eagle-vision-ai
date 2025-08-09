import math
from enricher.main import ema_update, passes_quality

def test_ema_update_initial():
    new = [1.0, 2.0]
    out = ema_update(None, new, 0.3)
    assert out == new

def test_ema_update_blend():
    old = [0.0, 0.0]
    new = [1.0, 1.0]
    out = ema_update(old, new, 0.3)
    assert all(abs(v - 0.3) < 1e-6 for v in out)

def test_quality_gate():
    assert passes_quality(0.95, 200) is True
    assert passes_quality(0.85, 200) is False
    assert passes_quality(0.95, 120) is False
    assert passes_quality(None, 200) is False
