"""Explicit operator step: download authorized immutable snapshots. Never run during Vercel build."""
import json
import os
import re
from pathlib import Path

from adapter import require_rights
from renderer import sha256


def main():
    require_rights()
    from huggingface_hub import snapshot_download
    root = Path(os.getenv("TRIBE_MODEL_PATH", "/models/tribev2"))
    revision = os.environ["TRIBE_WEIGHTS_REVISION"]
    snapshot_download("facebook/tribev2", revision=revision, local_dir=root,
                      allow_patterns=["best.ckpt", "config.yaml", "README.md", "LICENSE*"])
    features = {}
    for key, repo, env in [("text", "meta-llama/Llama-3.2-3B", "LLAMA_REVISION"),
                           ("video", "facebook/vjepa2-vitg-fpc64-256", "VJEPA_REVISION"),
                           ("audio", "facebook/w2v-bert-2.0", "W2VBERT_REVISION")]:
        rev = os.getenv(env, "")
        if not re.fullmatch(r"[0-9a-f]{40}", rev):
            raise RuntimeError(f"Set {env} to an immutable repository commit")
        path = snapshot_download(repo, revision=rev, cache_dir=str(root.parent / "hf"))
        features[key] = {"repository": repo, "revision": rev, "path": path}
    provenance = {"tribeRevision": revision, "checkpointHash": sha256(root / "best.ckpt"),
                  "configHash": sha256(root / "config.yaml"), "features": features}
    (root / "metatray-model-provenance.json").write_text(json.dumps(provenance, indent=2))
    print("Authorized model snapshots prepared. Run the inference smoke test before live use.")


if __name__ == "__main__":
    main()
