"""Validate actual upstream arrays and preserve their temporal alignment."""
import gzip
import hashlib
import io
import math
import struct

import numpy as np


SURFACE_MAGIC = b"MTRYSF01"
SURFACE_VERSION = 1
SURFACE_HEADER_BYTES = 32
SURFACE_FORMAT = "metatray-surface-int16-le"
SURFACE_COMPRESSION = "gzip"
SURFACE_QUANTIZATION = "signed-int16-fixed-symmetric"
SURFACE_TIMING = "upstream-segment-start-duration-seconds"
MAX_SURFACE_FRAMES = 512
MAX_SURFACE_PAYLOAD_BYTES = 16 * 1024 * 1024


def _ordered_output(predictions, segments, expected_vertices: int):
    values = np.asarray(predictions, dtype=np.float32)
    if values.ndim != 2 or values.shape[1] != expected_vertices or len(values) < 2:
        raise ValueError("TRIBE output does not match the required surface/time shape")
    if len(values) > MAX_SURFACE_FRAMES:
        raise ValueError("TRIBE output exceeds the supported temporal frame count")
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
    return values[order], starts[order], durations[order]


def summarize(predictions, segments, expected_vertices: int) -> dict:
    values, starts, _durations = _ordered_output(predictions, segments, expected_vertices)
    trace = np.mean(np.abs(values), axis=1)
    change = float(np.mean(np.abs(values[-1] - values[-2])))
    if not math.isfinite(change):
        raise ValueError("Invalid response-change statistic")
    return {"values": values[-1].tolist(), "times": starts.tolist(), "segmentOffsets": starts.tolist(),
            "responseTrace": trace.tolist(), "meanAbsoluteResponse": float(trace[-1]), "responseChange": change,
            "sampleCount": int(len(values)), "vertexCount": int(values.shape[1]),
            # Fixed normalized-model scale across frames and jobs; never per-frame dramatic autoscaling.
            "colorLimit": 2.0}


def encode_surface_frames(predictions, segments, expected_vertices: int, color_limit: float = 2.0):
    """Encode every real model row as deterministic gzip-compressed display frames.

    The retained NPZ remains the lossless scientific artifact. This payload is a
    bounded browser visualization: values are clipped to the fixed display scale
    and quantized to signed int16 without synthesizing or interpolating frames.
    """
    if not math.isfinite(color_limit) or color_limit <= 0:
        raise ValueError("Invalid surface color limit")
    values, starts, durations = _ordered_output(predictions, segments, expected_vertices)
    frame_count, vertex_count = values.shape
    quantized = np.rint(np.clip(values, -color_limit, color_limit) / color_limit * 32767.0).astype("<i2")
    # Header: magic, version, flags, header bytes, vertices, frames, fixed color limit, reserved.
    # Flag bit 0 indicates that one float32 duration follows each float32 start offset.
    header = struct.pack("<8sHHIIIfI", SURFACE_MAGIC, SURFACE_VERSION, 1, SURFACE_HEADER_BYTES,
                         vertex_count, frame_count, float(color_limit), 0)
    raw = header + starts.astype("<f4").tobytes(order="C") + durations.astype("<f4").tobytes(order="C") + quantized.tobytes(order="C")
    compressed = io.BytesIO()
    # GzipFile emits the same empty-name/mtime=0 header on supported Python
    # versions; gzip.compress delegated its OS byte to zlib before Python 3.13.
    with gzip.GzipFile(fileobj=compressed, mode="wb", compresslevel=9, mtime=0, filename="") as archive:
        archive.write(raw)
    payload = compressed.getvalue()
    if len(payload) > MAX_SURFACE_PAYLOAD_BYTES:
        raise ValueError("Compressed surface payload exceeds the public delivery limit")
    digest = hashlib.sha256(payload).hexdigest()
    metadata = {"version": SURFACE_VERSION, "format": SURFACE_FORMAT, "compression": SURFACE_COMPRESSION,
                "quantization": SURFACE_QUANTIZATION, "timing": SURFACE_TIMING,
                "frameCount": int(frame_count), "vertexCount": int(vertex_count),
                "colorLimit": float(color_limit), "byteLength": len(payload), "sha256": digest}
    return payload, metadata
