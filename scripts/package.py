"""Create a reviewable source ZIP. Credentials, caches and downloaded models are excluded."""
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOP_FILES = {"README.md", "AGENT_HANDOFF.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "package.json", "package-lock.json",
             "tsconfig.json", "next-env.d.ts", "next.config.ts", "vercel.json", "compose.yaml", ".env.example", ".gitignore", ".dockerignore"}
DIRS = {"src", "services", "scripts", "db", "docs", "tests", ".github"}
FORBIDDEN_PARTS = {"node_modules", ".git", ".venv", "__pycache__", ".pytest_cache", "data", "artifacts", "dist"}
ALLOWED_SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".py", ".sql", ".css", ".md", ".json", ".txt", ".yml", ".yaml"}


def main():
    files = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        rel = path.relative_to(ROOT)
        if any(part in FORBIDDEN_PARTS for part in rel.parts):
            continue
        if len(rel.parts) == 1:
            include = path.name in TOP_FILES
        else:
            include = rel.parts[0] in DIRS and (path.suffix in ALLOWED_SUFFIXES or path.name in {"Dockerfile", "Dockerfile.indexer", "uvx"})
        if not include:
            continue
        content = path.read_bytes()
        # Catch common credential formats; do not confuse placeholder env variable names with secret values.
        for pattern in [rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", rb"gh[pousr]_[A-Za-z0-9]{30,}", rb"github_pat_[A-Za-z0-9_]{40,}", rb"hf_[A-Za-z0-9]{30,}"]:
            if re.search(pattern, content):
                raise RuntimeError(f"Potential secret in {rel}; archive was not created")
        files.append((rel.as_posix(), content))
    manifest = {"project": "tray", "formatVersion": 1, "files": [
        {"path": name, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()} for name, content in files]}
    files.append(("SOURCE_MANIFEST.json", json.dumps(manifest, indent=2).encode()))
    target = ROOT / "dist" / "tray.zip"; target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in files:
            item = zipfile.ZipInfo(f"tray/{name}", date_time=(2026, 9, 14, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = (0o100755 if name.endswith("bin/uvx") else 0o100644) << 16
            archive.writestr(item, content)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity check failed")
    print(json.dumps({"file": str(target), "files": len(files), "bytes": target.stat().st_size,
                      "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}, indent=2))


if __name__ == "__main__":
    main()
