# Third-party components

This source archive does not bundle the TRIBE implementation, its checkpoint, pretrained feature weights, research recordings, fsaverage5 surface files or third-party browser binaries. Package managers and explicit operator preparation steps obtain dependencies separately. The license in this repository does not replace their terms.

| Component | Source / terms to retain |
| --- | --- |
| TRIBE v2 source and checkpoint | Meta Platforms, Inc. and affiliates; [audited source revision](https://github.com/facebookresearch/tribev2/tree/af58661791a351a448a489042a28f6c37e1c14b7), [license at that revision](https://github.com/facebookresearch/tribev2/blob/af58661791a351a448a489042a28f6c37e1c14b7/LICENSE), [model card](https://huggingface.co/facebook/tribev2); CC BY-NC 4.0 |
| Llama 3.2 3B | [Official model card and Llama license](https://huggingface.co/meta-llama/Llama-3.2-3B); gated access and model-specific terms |
| V-JEPA 2 | [Official model repository](https://huggingface.co/facebook/vjepa2-vitg-fpc64-256); retain model and dependency notices |
| w2v-BERT 2.0 | [Official model repository](https://huggingface.co/facebook/w2v-bert-2.0); retain model and dependency notices |
| Neuralset / Neuraltrain | [Meta NeuroAI repository](https://github.com/facebookresearch/neuroai); pinned package releases used by TRIBE |
| WhisperX and associated models | [WhisperX repository](https://github.com/m-bain/whisperX); transcription/alignment models are additional downloads with their own terms |
| Surface geometry | [Nilearn fsaverage interface](https://nilearn.github.io/stable/modules/generated/nilearn.datasets.fetch_surf_fsaverage.html); retain dataset provenance and notices |
| Protocol ABI descriptions | [Pons source revision reviewed by the adapter](https://github.com/ponsdotdev/ponsfamily/tree/cb5748a29e4d3a7af1c4e982baa9ed9194d25a8f), [Uniswap V3](https://github.com/Uniswap/v3-core), [Uniswap V4](https://github.com/Uniswap/v4-core); this project does not deploy copies of their contracts |
| Web dependencies | Exact versions in `package-lock.json`; retain installed packages' licenses |
| Fonts | Inter and Geist Mono via Fontsource; retain the packages' OFL notices |
| eSpeak NG / FFmpeg | System packages installed in the GPU image; retain their applicable licenses and redistribution obligations for any distributed image |
| Test browser | Playwright and packaged Chromium, development dependencies only; not served by the website |
| Source marks | GitHub's official mark identifies links to repositories under its [logo policy](https://docs.github.com/en/site-policy/other-site-policies/github-logo-policy). Meta and Pons are identified in text because this project has no trademark approval from either organization. |

`TRIBE_ENABLED` and `TRIBE_RIGHTS_REFERENCE` document operator configuration. They do not grant rights or verify the legal sufficiency of a use. CC BY-NC 4.0 restricts use to noncommercial purposes; token promotion or another commercial deployment is plausibly outside that permission. Obtain separate permission and legal review for the intended deployment before enabling the model. The default website works without the model service, and the model service remains disabled until explicitly configured.

The project is independent and is not endorsed by Meta, Pons, Uniswap or Vercel. Scientific attribution is provided in `docs/SCIENCE.md`. No personal contact details, contributor email addresses or account credentials are inserted into original project files.
