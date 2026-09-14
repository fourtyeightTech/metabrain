import sys
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from result import summarize
from renderer import validate_input, frame
from smoke import fixture


def test_missing_and_future_market_observations_fail():
    data = fixture(); validate_input(data)
    data["ticks"][-1]["ts"] = data["end"] + 1
    with pytest.raises(ValueError, match="Future"):
        validate_input(data)


def test_frame_does_not_show_future_ticks():
    data = fixture(); before = frame(data, 10).tobytes()
    data["ticks"][-1]["price"] *= 1000
    assert frame(data, 10).tobytes() == before
    assert frame(data, 99).tobytes() != before


def test_real_array_contract_preserves_upstream_times_and_vertex_order():
    # Explicit synthetic numerical fixture. Not a model run, never published.
    values = np.array([[.1, -.1], [.3, -.2]], dtype=np.float32)
    segments = [SimpleNamespace(start=5.25, duration=1), SimpleNamespace(start=6.25, duration=1)]
    result = summarize(values, segments, 2)
    assert result["times"] == [5.25, 6.25]
    assert result["values"] == pytest.approx([.3, -.2])
    assert result["responseChange"] == pytest.approx(.15)
    assert result["colorLimit"] == 2.0


def test_wrong_surface_nonfinite_and_duplicate_times_fail():
    segments = [SimpleNamespace(start=0, duration=1), SimpleNamespace(start=1, duration=1)]
    with pytest.raises(ValueError): summarize(np.ones((2, 3)), segments, 2)
    with pytest.raises(ValueError): summarize([[float("nan"), 1], [1, 1]], segments, 2)
    with pytest.raises(ValueError): summarize(np.ones((2, 2)), [segments[0], segments[0]], 2)


def test_model_defaults_disabled(monkeypatch):
    from adapter import require_rights
    monkeypatch.delenv("TRIBE_ENABLED", raising=False)
    with pytest.raises(RuntimeError, match="disabled"):
        require_rights()
