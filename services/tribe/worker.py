"""Durable PostgreSQL job consumer. Never places or signs an order."""
import json
import os
import signal
import threading
import time
import uuid
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from adapter import Adapter
from renderer import render

STOP = threading.Event()


def connection():
    return psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row, connect_timeout=10)


def claim(db):
    with db.transaction():
        # Leases are renewed while inference runs; interrupted jobs can retry twice.
        db.execute("UPDATE metatray_jobs SET status=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END, lease_id=NULL, error='Lease expired' WHERE status='running' AND locked_at<now()-interval '90 seconds'")
        job = db.execute("SELECT * FROM metatray_jobs WHERE status='queued' ORDER BY input_end DESC LIMIT 1 FOR UPDATE SKIP LOCKED").fetchone()
        if not job:
            return None
        lease = uuid.uuid4()
        db.execute("UPDATE metatray_jobs SET status='running',attempts=attempts+1,locked_at=now(),lease_id=%s,error=NULL WHERE id=%s", (lease, job["id"]))
        return {**job, "lease_id": lease}


def heartbeat(job, finished):
    while not finished.wait(20):
        try:
            with connection() as db:
                db.execute("UPDATE metatray_jobs SET locked_at=now() WHERE id=%s AND lease_id=%s AND status='running'", (job["id"], job["lease_id"]))
        except psycopg.Error:
            # Publication verifies the lease again. A disconnected worker cannot publish stale ownership.
            continue


def publish(db, job, result, surface_payload):
    with db.transaction():
        # Lock the job first so reorg cancellation and publication serialize.
        current = db.execute("SELECT status,lease_id FROM metatray_jobs WHERE id=%s FOR UPDATE", (job["id"],)).fetchone()
        if not current or current["status"] != "running" or current["lease_id"] != job["lease_id"]:
            return False
        source = db.execute("SELECT hash FROM metatray_blocks WHERE number=%s", (job["source_block"],)).fetchone()
        if not source or source["hash"] != job["input"]["sourceBlockHash"]:
            db.execute("UPDATE metatray_jobs SET status='cancelled',lease_id=NULL,error='Orphaned input' WHERE id=%s", (job["id"],))
            return False
        result["availableAt"] = int(time.time() * 1000)
        public_result = result
        summary_keys = ["id", "source", "inputStart", "inputEnd", "availableAt", "modelRevision", "stimulusHash", "outputHash",
                        "meanAbsoluteResponse", "responseChange", "sampleCount", "vertexCount", "latencyMs", "alignment", "runMode",
                        "surfaceFrames"]
        summary = {key: public_result[key] for key in summary_keys}
        db.execute("INSERT INTO metatray_predictions(id,input_end,available_at,summary,result) VALUES(%s,%s,%s,%s,%s)",
                   (job["id"], job["input_end"], public_result["availableAt"], Jsonb(summary), Jsonb(public_result)))
        surface = public_result["surfaceFrames"]
        db.execute("""INSERT INTO metatray_prediction_surfaces
                   (prediction_id,format,version,compression,frame_count,vertex_count,color_limit,sha256,byte_length,payload)
                   VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                   (job["id"], surface["format"], surface["version"], surface["compression"], surface["frameCount"],
                    surface["vertexCount"], surface["colorLimit"], surface["sha256"], surface["byteLength"], surface_payload))
        db.execute("UPDATE metatray_jobs SET status='complete',lease_id=NULL WHERE id=%s", (job["id"],))
        return True


def main():
    for event in [signal.SIGTERM, signal.SIGINT]:
        signal.signal(event, lambda *_: STOP.set())
    with connection() as db:
        if not db.execute("SELECT version FROM metatray_migrations WHERE version='002'").fetchone():
            raise RuntimeError("Database migration 002 is required before starting the GPU worker")
    adapter = Adapter()
    with connection() as db:
        db.execute("INSERT INTO metatray_assets(key,data) VALUES('fsaverage5',%s) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data", (Jsonb(adapter.mesh),))
    root = Path(os.getenv("TRIBE_ARTIFACT_PATH", "/data/metatray"))
    while not STOP.is_set():
        with connection() as db:
            job = claim(db)
        if not job:
            STOP.wait(2); continue
        finished = threading.Event()
        thread = threading.Thread(target=heartbeat, args=(job, finished), daemon=True); thread.start()
        out = root / str(job["id"]) / str(job["lease_id"])
        started = time.monotonic()
        try:
            stimulus = render(job["input"], out)
            values, output_hash, model_manifest, surface_payload = adapter.infer(out)
            result = {**values, "id": str(job["id"]), "source": "tribe-v2", "inputStart": job["input"]["start"],
                      "inputEnd": job["input_end"], "modelRevision": os.environ["TRIBE_WEIGHTS_REVISION"],
                      "stimulusHash": stimulus["videoHash"], "outputHash": output_hash,
                      "latencyMs": round((time.monotonic() - started) * 1000), "alignment": "upstream-segment-timestamps",
                      "runMode": "rolling-window-experimental", "manifest": {**model_manifest, "stimulus": stimulus,
                      "sourceBlock": job["source_block"], "sourceBlockHash": job["input"]["sourceBlockHash"], "inputHash": job["input_hash"]}}
            with connection() as db:
                accepted = publish(db, job, result, surface_payload)
            (out / "manifest.json").write_text(json.dumps({**result, "published": accepted}, indent=2))
            print(json.dumps({"job": str(job["id"]), "published": accepted}), flush=True)
        except Exception as exc:
            out.mkdir(parents=True, exist_ok=True)
            # Private diagnostic details are never returned by the website.
            (out / "error.txt").write_text(f"{type(exc).__name__}: {exc}")
            with connection() as db:
                db.execute("UPDATE metatray_jobs SET status='failed',lease_id=NULL,error=%s WHERE id=%s AND lease_id=%s AND status='running'",
                           (f"{type(exc).__name__}; inspect private artifact log", job["id"], job["lease_id"]))
            print(json.dumps({"job": str(job["id"]), "failed": type(exc).__name__}), flush=True)
        finally:
            finished.set(); thread.join(timeout=2)


if __name__ == "__main__":
    main()
