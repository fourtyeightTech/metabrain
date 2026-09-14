# Third-party components

This source archive does not bundle the TRIBE implementation, its checkpoint, pretrained feature weights, research recordings, fsaverage5 surface files or third-party browser binaries. Package managers and explicit operator preparation steps obtain dependencies separately. The license in this repository does not replace their terms.

| Component | Source / terms to retain |
| --- | --- |
| TRIBE v2 source and checkpoint | Meta Platforms, Inc. and affiliates; [source license](https://github.com/facebookresearch/tribev2/blob/main/LICENSE), [model card](https://huggingface.co/facebook/tribev2); CC BY-NC 4.0 |
| Llama 3.2 3B | [Official model card and Llama license](https://huggingface.co/meta-llama/Llama-3.2-3B); gated access and model-specific terms |
| V-JEPA 2 | [Official model repository](https://huggingface.co/facebook/vjepa2-vitg-fpc64-256); retain model and dependency notices |
| w2v-BERT 2.0 | [Official model repository](https://huggingface.co/facebook/w2v-bert-2.0); retain model and dependency notices |
| Neuralset / Neuraltrain | [Meta NeuroAI repository](https://github.com/facebookresearch/neuroai); pinned package releases used by TRIBE |
| WhisperX and associated models | [WhisperX repository](https://github.com/m-bain/whisperX); transcription/alignment models are additional downloads with their own terms |
| Surface geometry | [Nilearn fsaverage interface](https://nilearn.github.io/stable/modules/generated/nilearn.datasets.fetch_surf_fsaverage.html); retain dataset provenance and notices |
| Protocol ABI descriptions | [Pons public contracts](https://github.com/ponsdotdev/ponsfamily), [Uniswap V3](https://github.com/Uniswap/v3-core), [Uniswap V4](https://github.com/Uniswap/v4-core); this project does not deploy copies of their contracts |
| Web dependencies | Exact versions in `package-lock.json`; retain installed packages' licenses |
| Fonts | Inter and Geist Mono via Fontsource; retain the packages' OFL notices |
| eSpeak NG / FFmpeg | System packages installed in the GPU image; retain their applicable licenses and redistribution obligations for any distributed image |
| Test browser | Playwright and packaged Chromium, development dependencies only; not served by the website |

`TRIBE_ENABLED` and `TRIBE_RIGHTS_REFERENCE` document operator configuration. They do not grant rights or verify the legal sufficiency of a use. The default website works without the model service, and the model service remains disabled until explicitly configured.

The project is independent and is not endorsed by Meta, Pons, Uniswap or Vercel. Scientific attribution is provided in `docs/SCIENCE.md`. No personal contact details, contributor email addresses or account credentials are inserted into original project files.
