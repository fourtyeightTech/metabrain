FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime
RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg espeak-ng fonts-dejavu-core libgl1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/tribe/requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r requirements.txt && python -m pip check
COPY services/tribe/ /app/
RUN chmod +x /app/bin/uvx
ENV PATH="/app/bin:${PATH}" PYTHONUNBUFFERED=1 HF_HOME=/cache/huggingface UV_CACHE_DIR=/cache/uv
CMD ["python", "worker.py"]
