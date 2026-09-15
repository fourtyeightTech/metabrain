import sys
import base64
import gzip
import hashlib
import json
import struct
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from result import SURFACE_HEADER_BYTES, SURFACE_MAGIC, encode_surface_frames, summarize
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


def test_surface_payload_contains_only_time_ordered_real_model_frames():
    values = np.array([[.5, -4.0], [.25, 1.0]], dtype=np.float32)
    # Upstream rows are intentionally out of time order; payload order must match summarize().
    segments = [SimpleNamespace(start=2.0, duration=.75), SimpleNamespace(start=1.0, duration=.5)]
    payload, metadata = encode_surface_frames(values, segments, 2, color_limit=2.0)
    assert payload == encode_surface_frames(values, segments, 2, color_limit=2.0)[0]
    assert metadata == {"version": 1, "format": "metatray-surface-int16-le", "compression": "gzip",
                        "quantization": "signed-int16-fixed-symmetric",
                        "timing": "upstream-segment-start-duration-seconds", "frameCount": 2,
                        "vertexCount": 2, "colorLimit": 2.0, "byteLength": len(payload),
                        "sha256": hashlib.sha256(payload).hexdigest()}
    raw = gzip.decompress(payload)
    magic, version, flags, header_bytes, vertices, frames, limit, reserved = struct.unpack("<8sHHIIIfI", raw[:SURFACE_HEADER_BYTES])
    assert (magic, version, flags, header_bytes, vertices, frames, limit, reserved) == (SURFACE_MAGIC, 1, 1, 32, 2, 2, 2.0, 0)
    starts = np.frombuffer(raw, dtype="<f4", count=2, offset=32)
    durations = np.frombuffer(raw, dtype="<f4", count=2, offset=40)
    quantized = np.frombuffer(raw, dtype="<i2", count=4, offset=48).reshape(2, 2)
    assert starts.tolist() == [1.0, 2.0]
    assert durations.tolist() == [.5, .75]
    assert quantized[0].tolist() == [4096, 16384]
    assert quantized[1].tolist() == [8192, -32767]
    # JSON's latest surface remains unquantized while the animation contains every genuine row.
    assert summarize(values, segments, 2)["values"] == pytest.approx([.5, -4.0])


def test_python_encoder_matches_the_typescript_decoder_golden_vector():
    fixture_path = Path(__file__).resolve().parents[3] / "tests" / "data" / "surface-frame-v1.json"
    fixture = json.loads(fixture_path.read_text())
    values = np.array([[.5, -4.0], [.25, 1.0]], dtype=np.float32)
    segments = [SimpleNamespace(start=2.0, duration=.75), SimpleNamespace(start=1.0, duration=.5)]
    payload, metadata = encode_surface_frames(values, segments, 2, color_limit=2.0)
    assert base64.b64encode(payload).decode() == fixture["payloadBase64"]
    assert metadata["sha256"] == fixture["sha256"]
    assert metadata["frameCount"] == fixture["frameCount"]
    assert metadata["vertexCount"] == fixture["vertexCount"]


def test_wrong_surface_nonfinite_and_duplicate_times_fail():
    segments = [SimpleNamespace(start=0, duration=1), SimpleNamespace(start=1, duration=1)]
    with pytest.raises(ValueError): summarize(np.ones((2, 3)), segments, 2)
    with pytest.raises(ValueError): summarize([[float("nan"), 1], [1, 1]], segments, 2)
    with pytest.raises(ValueError): summarize(np.ones((2, 2)), [segments[0], segments[0]], 2)
    with pytest.raises(ValueError): encode_surface_frames(np.ones((2, 2)), [segments[0], segments[0]], 2)


def test_model_defaults_disabled(monkeypatch):
    from adapter import require_rights
    monkeypatch.delenv("TRIBE_ENABLED", raising=False)
    with pytest.raises(RuntimeError, match="disabled"):
        require_rights()
