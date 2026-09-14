"""Original Tray stimulus renderer. No model output is fabricated here."""
from __future__ import annotations
import hashlib
import json
import math
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

VERSION = "tray-market-screen-v1"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for part in iter(lambda: f.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def validate_input(data: dict) -> None:
    if data.get("schemaVersion") != 1 or data.get("rendererVersion") != VERSION:
        raise ValueError("Unsupported stimulus schema or renderer")
    if not 30 <= (data["end"] - data["start"]) / 1000 <= 100:
        raise ValueError("Context must be between 30 and 100 seconds")
    ticks = data["ticks"]
    if not ticks or len(ticks) > 5001:
        raise ValueError("Invalid event count")
    for tick in ticks:
        if tick["ts"] > data["end"] or not math.isfinite(tick["price"]) or tick["price"] <= 0:
            raise ValueError("Future or invalid market input")
        if tick["blockNumber"] > data["sourceBlock"]:
            raise ValueError("Event newer than source block")
    if any(a["ts"] > b["ts"] for a, b in zip(ticks, ticks[1:])):
        raise ValueError("Market input must be time ordered")
    if not isinstance(data["text"], str) or not 1 <= len(data["text"]) <= 4000:
        raise ValueError("Invalid narration")


def font(size: int):
    for path in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def frame(data: dict, seconds: float, size=(640, 360)) -> Image.Image:
    """Only draw ticks visible at this point in the constructed replay."""
    image = Image.new("RGB", size, "#090e12")
    draw = ImageDraw.Draw(image)
    at = data["start"] + seconds * 1000
    visible = [t for t in data["ticks"] if t["ts"] <= at]
    draw.text((26, 20), "TRAY / MARKET EXPERIENCE", font=font(15), fill="#70dfbc")
    draw.text((26, 46), "Constructed replay - paper account", font=font(12), fill="#a3acb4")
    if not visible:
        draw.text((26, 115), "Awaiting first observed trade", font=font(22), fill="#e6edf2")
        return image
    last = visible[-1]
    draw.text((26, 84), f'{last["price"]:.8f} {data["quoteSymbol"]}', font=font(25), fill="#e6edf2")
    prices = [t["price"] for t in visible]
    low, high = min(prices), max(prices)
    span = max(high - low, high * .005)
    low -= span * .1; high += span * .1
    left, top, width, height = 28, 143, 582, 144
    for y in range(4):
        py = top + y * height / 3
        draw.line((left, py, left + width, py), fill="#203039")
    points = [(left + max(0, t["ts"] - data["start"]) / (data["end"] - data["start"]) * width,
               top + (high - t["price"]) / (high - low) * height) for t in visible]
    if len(points) > 1:
        draw.line(points, fill="#70dfbc", width=3)
    else:
        x, y = points[0]; draw.ellipse((x-2, y-2, x+2, y+2), fill="#70dfbc")
    draw.text((26, 311), f'{len(visible)} observed events | latest: {last["side"]}', font=font(13), fill="#a3acb4")
    draw.text((500, 311), f"{seconds:.1f}s", font=font(13), fill="#a3acb4")
    return image


def render(data: dict, out: Path, fps: int = 8) -> dict:
    validate_input(data)
    if not shutil.which("ffmpeg") or not shutil.which("espeak-ng"):
        raise RuntimeError("Stimulus rendering requires ffmpeg and espeak-ng")
    out.mkdir(parents=True, exist_ok=True)
    duration = (data["end"] - data["start"]) / 1000
    (out / "input.json").write_text(json.dumps(data, indent=2))
    speech = out / "speech.wav"
    # stdin is literal text: never interpret market data as a shell command.
    subprocess.run(["espeak-ng", "-v", "en", "-s", "165", "-w", str(speech), "--stdin"],
                   input=data["text"], text=True, check=True, capture_output=True)
    with wave.open(str(speech)) as wav:
        if wav.getsampwidth() != 2 or wav.getnchannels() != 1:
            raise RuntimeError("Expected 16-bit mono narration")
        rate = wav.getframerate()
        samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(np.float32)
    speech_seconds = len(samples) / rate
    if speech_seconds > duration - 2:
        raise ValueError("Narration exceeds context. Increase context or reduce factual text.")
    audio = np.zeros(int(duration * rate), dtype=np.float32)
    # Cutoff portfolio facts are narrated at the end of this authored replay.
    offset = int((duration - speech_seconds - 1) * rate)
    audio[offset:offset + len(samples)] += samples * .75
    # Direction has a published sensory encoding, not an emotion label.
    for tick in data["ticks"]:
        at = int((tick["ts"] - data["start"]) / 1000 * rate)
        if not 0 <= at < len(audio):
            continue
        n = min(int(.07 * rate), len(audio) - at)
        frequency = 660 if tick["side"] == "buy" else 330
        tone = 900 * np.sin(2 * np.pi * frequency * np.arange(n) / rate) * np.hanning(n)
        audio[at:at+n] += tone
    wavpath = out / "stimulus.wav"
    with wave.open(str(wavpath), "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(rate)
        wav.writeframes(np.clip(audio, -32767, 32767).astype("<i2").tobytes())
    video = out / "stimulus.mp4"
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
               "-s", "640x360", "-r", str(fps), "-i", "pipe:0", "-i", str(wavpath), "-c:v", "libx264",
               "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", "-t", str(duration), str(video)]
    # Send stderr to disk so an encoder failure cannot deadlock on a full stderr pipe.
    with (out / "render.log").open("wb") as log:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log)
        try:
            for index in range(math.ceil(duration * fps)):
                process.stdin.write(frame(data, index / fps).tobytes())
            process.stdin.close()
            if process.wait(timeout=120):
                raise RuntimeError("Video encoder failed; inspect private render.log")
        except BaseException:
            process.kill(); process.wait(); raise
    frame(data, duration).save(out / "preview.png")
    return {"rendererVersion": VERSION, "width": 640, "height": 360, "fps": fps, "durationSeconds": duration,
            "narrationStartSeconds": offset / rate, "narrationDurationSeconds": speech_seconds,
            "buyToneHz": 660, "sellToneHz": 330, "videoHash": sha256(video), "audioHash": sha256(wavpath),
            "inputFileHash": sha256(out / "input.json"), "clock": "constructed replay; not live wall time"}
