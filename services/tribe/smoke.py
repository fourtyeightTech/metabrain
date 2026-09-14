"""Operator GPU test. Never publishes test predictions or synthetic events to the live DB."""
import argparse
import json
import math
from pathlib import Path

from renderer import render


def fixture():
    start = 1700000000000
    ticks = [{"id": f"synthetic-{i}", "ts": start + i * 2000, "price": .01 * math.exp(.002 * i),
              "side": "buy" if i % 3 else "sell", "blockNumber": i + 1} for i in range(50)]
    return {"schemaVersion": 1, "rendererVersion": "tray-market-screen-v1", "start": start, "end": start + 100000,
            "sourceBlock": 50, "sourceBlockHash": "synthetic-smoke-only", "quoteSymbol": "DEMO", "ticks": ticks,
            "paper": {"cash": 10000, "units": 0}, "text": "This is a synthetic test market. The price has risen during this recorded interval. The paper account holds ten thousand units of cash and no tokens.",
            "portfolioTiming": "cutoff snapshot in a constructed replay", "temporalMode": "rolling-window-experimental"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--render-only", action="store_true")
    parser.add_argument("--out", default="/data/tray/smoke")
    args = parser.parse_args(); out = Path(args.out).resolve()
    rendered = render(fixture(), out)
    if args.render_only:
        (out / "render-manifest.json").write_text(json.dumps(rendered, indent=2)); print("Stimulus rendered; no inference was performed."); return
    from adapter import Adapter
    adapter = Adapter()
    result, output_hash, manifest = adapter.infer(out)
    (out / "smoke-result.json").write_text(json.dumps({"syntheticInput": True, "published": False,
        "outputHash": output_hash, "stimulus": rendered, "manifest": manifest, "result": result}, indent=2))
    print(f"Actual TRIBE smoke output: {result['sampleCount']} samples, {result['vertexCount']} vertices. Not published to the live database.")


if __name__ == "__main__":
    main()
