"""Validate actual upstream arrays and preserve their temporal alignment."""
import math
import numpy as np


def summarize(predictions, segments, expected_vertices: int) -> dict:
    values = np.asarray(predictions, dtype=np.float32)
    if values.ndim != 2 or values.shape[1] != expected_vertices or len(values) < 2:
        raise ValueError("TRIBE output does not match the required surface/time shape")
    if not np.isfinite(values).all() or len(segments) != len(values):
        raise ValueError("Nonfinite output or missing segment alignment")
    starts = np.array([float(s.start) for s in segments])
    durations = np.array([float(s.duration) for s in segments])
    if not np.isfinite(starts).all() or not np.isfinite(durations).all() or np.any(durations <= 0):
        raise ValueError("Invalid upstream segment metadata")
    # Keep every raw row in NPZ. Display in temporal order and reject duplicate windows.
    order = np.argsort(starts, kind="stable")
    if np.any(np.diff(starts[order]) <= 0):
        raise ValueError("Overlapping/duplicate output starts require an explicit aggregation protocol")
    values = values[order]; starts = starts[order]
    trace = np.mean(np.abs(values), axis=1)
    change = float(np.mean(np.abs(values[-1] - values[-2])))
    if not math.isfinite(change):
        raise ValueError("Invalid response-change statistic")
    return {"values": values[-1].tolist(), "times": starts.tolist(), "segmentOffsets": starts.tolist(),
            "responseTrace": trace.tolist(), "meanAbsoluteResponse": float(trace[-1]), "responseChange": change,
            "sampleCount": int(len(values)), "vertexCount": int(values.shape[1]),
            # Fixed normalized-model scale across frames and jobs; never per-frame dramatic autoscaling.
            "colorLimit": 2.0}
