"""Adapter around the released Meta inference API; weights are supplied separately."""
import importlib.metadata
import json
import os
import re
from pathlib import Path

import numpy as np
from renderer import sha256
from result import summarize

PINNED_CODE = "af58661791a351a448a489042a28f6c37e1c14b7"


def require_rights():
    if os.getenv("TRIBE_ENABLED") != "true" or not os.getenv("TRIBE_RIGHTS_REFERENCE", "").strip():
        raise RuntimeError("TRIBE is disabled. Document permission for the intended use before enabling it.")
    if os.getenv("TRIBE_CODE_REVISION", PINNED_CODE) != PINNED_CODE:
        raise RuntimeError("Unsupported upstream revision: review and test an adapter upgrade explicitly")
    if not re.fullmatch(r"[0-9a-f]{40}", os.getenv("TRIBE_WEIGHTS_REVISION", "")):
        raise RuntimeError("TRIBE_WEIGHTS_REVISION must be an immutable repository commit")


class Adapter:
    def __init__(self):
        require_rights()
        installed = importlib.metadata.distribution('tribev2').read_text('direct_url.json')
        if not installed or json.loads(installed).get('vcs_info', {}).get('commit_id') != PINNED_CODE:
            raise RuntimeError('Install TRIBE from the exact Git revision in requirements.txt')
        import torch
        from tribev2 import TribeModel
        self.root = Path(os.environ.get("TRIBE_MODEL_PATH", "/models/tribev2"))
        self.provenance = json.loads((self.root / "metatray-model-provenance.json").read_text())
        if self.provenance["tribeRevision"] != os.environ["TRIBE_WEIGHTS_REVISION"]:
            raise RuntimeError("Downloaded weights do not match the configured revision")
        if sha256(self.root / "best.ckpt") != self.provenance["checkpointHash"] or sha256(self.root / "config.yaml") != self.provenance["configHash"]:
            raise RuntimeError("Checkpoint/config integrity mismatch")
        device = os.getenv("TRIBE_DEVICE", "cuda")
        if device.startswith("cuda") and not torch.cuda.is_available():
            raise RuntimeError("CUDA is not available on this worker")
        # These paths are immutable HF snapshots prepared by prepare_models.py.
        models = self.provenance["features"]
        for feature in models.values():
            if not Path(feature["path"]).exists():
                raise RuntimeError("Feature snapshot is missing; run model preparation on this volume")
        cache = os.getenv("TRIBE_CACHE_PATH", "/cache/tribev2")
        overrides = {"data.batch_size": 1, "data.num_workers": 0,
                     "infra.folder": str(Path(cache) / "experiment"), "infra.cluster": None,
                     "data.text_feature.model_name": models["text"]["path"],
                     "data.audio_feature.model_name": models["audio"]["path"],
                     "data.video_feature.image.model_name": models["video"]["path"]}
        for field in ["data.text_feature.device", "data.audio_feature.device", "data.video_feature.image.device"]:
            overrides[field] = device
        self.model = TribeModel.from_pretrained(str(self.root), cache_folder=os.getenv("TRIBE_CACHE_PATH", "/cache/tribev2"),
                                                cluster=None, device=device, config_update=overrides)
        # Fail loudly if upstream changes the feature configuration shape or ignores an override.
        if str(self.model.data.text_feature.model_name) != models["text"]["path"]:
            raise RuntimeError("Text feature pin was not applied")
        if str(self.model.data.audio_feature.model_name) != models["audio"]["path"]:
            raise RuntimeError("Audio feature pin was not applied")
        if str(self.model.data.video_feature.image.model_name) != models["video"]["path"]:
            raise RuntimeError("Video feature pin was not applied")
        self.mesh = self.load_mesh()
        self.vertex_count = len(self.mesh["vertices"]) // 3

    @staticmethod
    def load_mesh():
        from nilearn.datasets import fetch_surf_fsaverage
        from nilearn.surface import load_surf_mesh
        surfaces = fetch_surf_fsaverage(mesh="fsaverage5")
        left = load_surf_mesh(surfaces.infl_left); right = load_surf_mesh(surfaces.infl_right)
        coords = np.concatenate([left.coordinates, right.coordinates]).astype(np.float32)
        # Rotate for the camera; no vertex permutation and no synthetic anatomical mapping.
        coords = coords[:, [0, 2, 1]]; coords[:, 2] *= -1
        faces = np.concatenate([left.faces, right.faces + len(left.coordinates)])
        if len(coords) != 20484:
            raise RuntimeError("Expected 10,242 vertices per hemisphere")
        return {"vertices": coords.flatten().tolist(), "faces": faces.flatten().tolist(),
                "hemisphereBoundary": len(left.coordinates), "mesh": "fsaverage5"}

    def infer(self, out: Path):
        events = self.model.get_events_dataframe(video_path=str(out / "stimulus.mp4"))
        # CSV stays on the private artifact volume; it may contain private host paths.
        events.to_csv(out / "events.csv", index=False)
        events_hash = sha256(out / "events.csv")
        predictions, segments = self.model.predict(events, verbose=False)
        result = summarize(predictions, segments, self.vertex_count)
        np.savez_compressed(out / "prediction.npz", predictions=predictions,
                            segment_starts=[float(s.start) for s in segments],
                            segment_durations=[float(s.duration) for s in segments])
        manifest = {"upstreamCodeRevision": PINNED_CODE, "weightsRevision": self.provenance["tribeRevision"],
                    "checkpointHash": self.provenance["checkpointHash"], "configHash": self.provenance["configHash"],
                    "eventsHash": events_hash,
                    "features": {key: {k: v for k, v in value.items() if k != "path"} for key, value in self.provenance["features"].items()},
                    "pythonPackages": {name: importlib.metadata.version(name) for name in ["tribev2", "torch", "neuralset", "neuraltrain", "transformers", "numpy"]},
                    "modelTRSeconds": float(self.model.data.TR), "subjectMode": "upstream average_subjects=True",
                    "surface": "fsaverage5; left then right; upstream vertex order",
                    "timeAxis": "upstream segment.start in constructed media seconds; no wall-clock conversion",
                    "alignmentPolicy": "upstream data alignment retained; no extra hemodynamic shift applied",
                    "signalUnits": "normalized model target units, not spikes or percent BOLD",
                    "colorScale": "fixed symmetric +/-2 model units; saturated for display only",
                    "whisperxVersion": "3.3.4; tool environment separate from model environment"}
        return result, sha256(out / "prediction.npz"), manifest
