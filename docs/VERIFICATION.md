# Verification record

Prepared 2026-09-14. This record describes checks performed while building the source handoff. It does not claim a GitHub deployment, a Vercel deployment, access to a new token, a measured human response or a completed TRIBE model run.

## Current revision: live-feed implementation checked locally

This revision adds a server-side direct RPC observer, structured setup/error snapshots, visible incoming swaps and pipeline status, trade-driven illustrative 3D pulses, a cortical-epoch chronicle and an evidence page with actual MetaTray and pinned Meta source links. Completed fixture predictions were verified as selectable historical epochs and as downloadable JSON and 1200 x 630 PNG receipts. The `/lore` route was checked alongside the explanatory, evidence and legal routes; every story term on that page is explicitly tied to an implemented state. Live mode is the default; demo replay must be explicitly selected. Vercel is configured as one ordinary root Next.js project; Services mode and the Python worker are excluded.

The current production build and all **18 Node tests** passed, including tests for confirmed-window bounds, real ABI decoding, duplicate/removed events, wrong-chain rejection, event/block mismatch, reorg-during-read rejection, stale blocks, quiet markets, event caps, Pons factory discovery, privacy-safe setup errors and cortical-epoch market summaries. The unchanged Python scientific-contract suite was rerun: **5 tests passed**.

The production-browser story passed for desktop/mobile rendering, live setup instructions, both repository links, event updates without WebGL canvas replacement, receipt/explorer keyboard navigation, pause/outage behavior, model-surface rendering with a controlled fixture, cortical-epoch selection, lore navigation, data/visual receipt downloads and a visible WebGL fallback. It checks horizontal overflow at 320, 390, 768, 1024 and 1440 pixels. The controlled RPC-shaped and model-shaped browser responses are test fixtures, not real on-chain observations or completed Meta inference. Generated screenshots and the browser JSON report are excluded from publication.

A read-only check against a public Ethereum RPC reference market was attempted from the build environment; the endpoint was unavailable and no live-chain pass is claimed. This project's actual token, chain, private RPC endpoint and deployed website URL have not been supplied. The separately hosted GPU service has not run here. Published/deployed operation must be checked independently after configuration; local test success does not establish a live deployment.

The historical records below describe earlier checks and are retained for context.

## Checks completed

| Area | Evidence / result |
| --- | --- |
| Production build | `npm run build` completed using Next.js 16.3.5; homepage and four read API routes generated |
| Type checking | `npm run typecheck` completed; script generates Next route types before TypeScript checking |
| Accounting | Unit tests cover buy cash conservation, fee-inclusive basis, adverse slippage, round-trip realized P/L and nonnegative cash/units through a long price path |
| Decision timing | Tests reject future/missing/stale/nonfinite model summaries; observer and cooldown behavior verified |
| Event decoding | V3 and V4 sign conventions, decimal normalization, unrelated pool rejection, removed logs and curve graduation fallback tested with encoded ABI fixtures |
| PostgreSQL state | PGlite tests execute the actual migration and store functions; verify idempotence, canonical-parent enforcement, queue creation, orphan-result removal, restored paper state and no historic backfill trades |
| Scientific contracts | Five Python tests verify input cutoff checks, no future values in earlier frames, output surface/time alignment, invalid-output rejection and default-disabled model state |
| Real media rendering | eSpeak NG and FFmpeg produced a 100-second synthetic smoke stimulus: H.264 video, 640 × 360 at 8 fps, AAC audio, factual speech plus declared trade tones |
| Browser flows | Automated Chromium story passed at 1440 × 1100 and 390 × 844; additional horizontal-overflow checks at 320, 768 and 1024 px widths; actual production server and APIs used |
| Browser controls | 3D schematic, hero viewer tabs and arrow keys, camera pause/resume, reduced-motion preference, FAQ expansion, policy selector, pause/reset, chart range, event dialog/Escape, receipt download and science/deployment tabs exercised |
| Failure boundary | A separately started `METATRAY_MODE=live` server without a database returned 503 and did not return synthetic trades; demo has no prediction/mesh endpoint output |
| Visual inspection | Updated MetaTray desktop and mobile screenshots inspected; no horizontal page overflow detected at the five tested widths |
| Archive | Source allowlist, common-secret scan, per-file SHA-256 manifest and ZIP integrity check performed by the packaging script |

The earlier Node suite contained **10 passing tests**; the current suite has 18, as recorded above. The Python scientific-contract suite contains **5 passing tests**. Those tests use explicitly synthetic fixtures. They are not accuracy evaluations of TRIBE and are not observations from a live token.

The visual revision replaced the typography, layout and styling, moved the existing cortical viewer into the hero, added viewer tabs and controllable camera motion, and retained the backend contracts. The production build (including TypeScript) and browser story were rerun after these changes. Backend unit-test results above are from the original implementation; those unchanged suites were not rerun for the visual revision. The heavy viewer remains dynamically imported, and its event listeners, animation loop and GPU resources are disposed on unmount.

## Repository integration

The complete source was imported into a fresh checkout of `fourtyeightTech/metabrain` on 2026-09-14. A clean `npm ci`, TypeScript check, all 10 Node tests, all 5 Python contract tests, production build and the five-width browser story passed in that checkout. The Python tests used the existing local test virtual environment. The default demo and live-without-database failure boundary were verified again. A source scan found no email-like contact values or common credential formats; build output, runtime artifacts, environment secrets and downloaded dependencies were excluded from the commit.

GitHub Actions results are reported separately in the repository's Actions tab. Local checks do not establish a Vercel deployment or a successful real-chain/GPU integration.

## Local environment

The observed build/test host used Node 24.19.0 and Python 3.12. The Python CPU test dependencies included NumPy 2.2.6, Pillow 11.3.0 and pytest 8.4.2. The browser used Playwright 1.58.2 with Chromium 153. The CI file additionally targets Node 22 and Python 3.11 on GitHub Actions; hosted results are recorded separately for each published commit.

The environment required a locally unpacked test browser and speech binary. They were used only for verification and are not included in the ZIP. The supplied GPU Dockerfile installs ordinary system packages instead.

## Not yet verified

- Actual Pons deployment addresses, factory generation, pool key and a genuine new-token swap. The archive deliberately supplies no token/network defaults.
- Real-chain outage recovery, confirmation behavior and reorg handling under the chosen provider. The store behavior has been tested against PostgreSQL semantics with fixtures, not a deployed chain.
- GPU Docker image build, full Python dependency resolution on that image, gated feature-model access or weights download.
- A full TRIBE inference run, transcription/alignment output, numeric agreement with the official notebook or a real fsaverage5 output from an actual model run. The browser model-display contract has been checked only with a controlled fixture.
- Minimum GPU VRAM, end-to-end processing latency, steady-state throughput, feature-cache growth, storage cost or a sustainable inference refresh interval.
- Simultaneous real Postgres GPU-worker publication/reorg contention under multiple networked services. The implementation serializes those operations by job row locks; deployment should test this behavior.
- Financial predictive value, profitability, calibrated psychological interpretation or human-response validity for market stimuli.
- Commercial model rights. The operator must establish a valid basis for their intended use; configuration flags do not grant rights.

## Reproduce the locally verified paths

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run verify:browser
```

Python CPU verification, in a virtual environment with its dependencies installed:

```bash
python -m pip install -r services/tribe/requirements-test.txt
python -m pytest services/tribe/tests -q
python services/tribe/smoke.py --render-only --out artifacts/render-smoke
```

The last command requires `ffmpeg` and `espeak-ng` on PATH. It renders actual media but intentionally does not load a model. For real GPU/live acceptance, follow `docs/DEPLOYMENT.md` and append your measured results to this file.
