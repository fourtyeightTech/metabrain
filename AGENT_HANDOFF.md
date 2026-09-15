# Agent handoff: deploy MetaTray from metabrain

## Intended result

Deploy the Next.js project in `fourtyeightTech/metabrain` to Vercel, then connect it to the operator's separately selected Pons token. Preserve the scientific labels and paper-only behavior. Never reuse another project's token address, user identity, email, wallet or credentials.

This repository is a source handoff. Repository publication does not establish a website deployment, a connection to a live token or a completed TRIBE inference run. Do not report those steps complete until you perform and verify them.

The current revision renames the product to MetaTray and adds dedicated explanatory and legal pages. Publication of this source was authorized after the source handoff. Do not report this revision as runtime-tested based on results from an earlier commit. Check the current commit’s CI and deployment results. Review `docs/LEGAL_REVIEW.md` before adopting the terms for a public deployment.

## Phase 1: publish and connect the live observer

1. Clone `https://github.com/fourtyeightTech/metabrain.git` and use the checkout root as the application root.
2. Read `README.md`, `docs/DESIGN.md`, `docs/SCIENCE.md`, `docs/VERIFICATION.md` and `THIRD_PARTY_NOTICES.md`.
3. Use Node 22.12 or later. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
4. Run `npm run verify:browser` on a supported Linux host. The command starts temporary production servers itself. Screenshots and its JSON report go to `artifacts/browser/`, which is excluded from commits.
5. Continue work in this repository. Preserve any subsequent operator changes. Use privacy-preserving commit metadata and keep personal contact information out of public files. Commit source files, `.env.example` and the lockfile. Do not commit actual `.env`, artifacts, models, logs, `node_modules`, `.next` or `.venv`.
6. Import the latest `main` of `fourtyeightTech/metabrain` into Vercel as one Next.js project at root `.`; build command `npm run build`; install `npm ci`. The committed `vercel.json` deliberately contains no Vercel `services` block or service rewrite. Do not add the Python GPU worker as a Vercel service. Restart an older import if it still proposes `tribe`. Set `METATRAY_MODE=live`, `METATRAY_FEED=rpc`, `RPC_HTTP_URL`, `CHAIN_ID`, `TOKEN_ADDRESS`, `MARKET_PROTOCOL` and the verified factory or V3 pool. Remove unused blank environment rows. The four setup values `RPC_HTTP_URL`, `CHAIN_ID`, `TOKEN_ADDRESS` and `PONS_FACTORY_ADDRESS` connect only the live market observer; they cannot produce TRIBE output. This observer needs no database/model environment. See `docs/DEPLOYMENT.md` for the import settings.
7. Open the production URL on desktop and mobile. Verify actual decoded swaps, block/hash receipts, polling age, missing-setting/outage behavior, hero viewer tabs, input pulses, camera controls, chart, both receipt formats, the cortical chronicle and all nine informational routes. Confirm the schematic is not described as model output and reduced-motion preferences stop automatic camera rotation. Set a suitable public contact URL and make the privacy/terms text match the actual operator and hosting arrangements.

## Phase 2: connect the new token

Obtain the following factual deployment inputs from the operator or the protocol's verified deployment records. Do not infer a network from an EVM address alone.

| Required fact | Purpose |
| --- | --- |
| Chain ID and RPC URLs | Correct chain; HTTP must support logs and historical contract reads |
| Token contract and launch/start block | Select only this new project and limit backfill |
| Protocol generation | Choose `pons-v2` or an explicitly identified `uniswap-v3` pool |
| Pons V2 factory, hook and PoolManager | Discover curve metadata and calculate the exact V4 pool ID |
| Actual quote asset/symbol | Keep valuation units accurate; do not substitute USD |
| Database connections | Pooled read connection for Vercel; direct writer connection for persistent services |

Create a fresh Postgres database. Apply `npm run db:migrate`. Configure the indexer environment, leave `PAPER_POLICY=observer` and `INFERENCE_ENABLED=false`, then run `npm run doctor`. Launch the indexer as a persistent service. Confirm its cursor advances and a genuine token swap matches the transaction receipt, including direction, raw amounts and decimals. Check graduation coverage against the verified contracts if the token uses Pons V2.

Set `METATRAY_MODE=live`, `METATRAY_FEED=indexed` and `DATABASE_READ_URL` in Vercel, then redeploy. In this indexed mode the website does not need RPC credentials. HF credentials belong only on the GPU host. Confirm feed status, token metadata and event receipts agree with the worker. Simulate an RPC interruption and confirm stale/degraded status rather than demo fallback.

## Phase 3: enable the scientific model

1. Establish the rights basis for the intended use of TRIBE and its dependency models. CC BY-NC 4.0 plausibly does not permit token-promotional or other commercial use without separate permission; obtain legal review for the exact deployment. Keep supporting documentation private. `TRIBE_RIGHTS_REFERENCE` is a private operator record, not a legal grant from the application.
2. Select immutable revisions for the TRIBE checkpoint, Llama 3.2 3B, V-JEPA 2 and w2v-BERT 2.0. Retain the audited upstream code pin already provided. Obtain gated model access as required.
3. Follow `docs/DEPLOYMENT.md` to build the GPU image and prepare model volumes. Run `smoke.py` against synthetic test inputs. The smoke command never publishes into the live database.
4. Inspect the generated video, narration transcript, full prediction NPZ, compact temporal-surface artifact, model provenance and fsaverage5 dimensions. Confirm 20,484 vertices, genuine ordered rows, the fixed ±2 normalized-model-unit display scale and preserved upstream starts/durations. Benchmark preprocessing plus inference after warm-up. Archive the exact installed package versions and image digest privately.
5. Start the GPU worker with the same writer database. Enable `INFERENCE_ENABLED=true` on the indexer and restart it. Verify queued → running → complete, and ensure a real prediction arrives with matching block hash and stimulus receipt.
6. Confirm the public API returns the exact prediction produced by the worker, the mesh has 20,484 vertices in the expected order, and `/api/predictions/{id}/surface` returns the matching integrity-checked temporal payload. Confirm the website labels the animation as a replay of a completed cortical epoch, keeps live receipt pulses in a separate market-input layer and labels delays correctly. Confirm secrets and private filesystem paths are absent from public output.
7. Keep the paper policy as observer until this path passes. Enabling `cortical` changes the paper configuration fingerprint and requires a fresh database/account under this version. Do not delete an existing database as a shortcut; create another and retain the previous record.

## Acceptance criteria

- Default website builds and renders with no credentials.
- A failed live backend returns an error; it never synthesizes on-chain events or neural predictions.
- Every market event can be traced to chain ID, transaction hash, log index and block hash.
- Every neural result has an actual model revision, exact media hash, output hash and publication timestamp.
- Every animated cortical frame comes from a completed TRIBE result with matching surface metadata; visual interpolation is never treated as a model sample.
- An orphaned source block causes its jobs/results to be invalidated and its paper state to be rolled back.
- Model-derived paper decisions reference an existing fresh prediction and occur after its publication time.
- The system never signs or submits a transaction.
- Product copy explains predicted cortical responses and makes no claims of consciousness, emotion detection, profitability or Meta endorsement.

## Do not silently change

Keep MetaTray’s visual identity: monochrome split hero, prominent interactive cortex, fine borders, Inter with Geist Mono, factual research labels and the dashboard below. Use MetaTray branding and factual attribution to the research software. Do not imply endorsement by a research provider. Camera rotation is presentation motion. Input pulses are authored reactions to actual swaps, not predictions. Returned Meta values are the only source of cortical output colors. The model animation replays the latest completed epoch on the upstream 1 Hz output grid; its 2 Hz feature input, approximately five-second hemodynamic alignment and 100-second window must not be presented as millisecond neurons or instantaneous per-swap inference.

Do not fill missing predictions with animated random values. Do not relabel the momentum baseline as TRIBE trading. Do not change the upstream model's noncausal architecture to imply streaming validity. Do not adjust stale-result limits just to make the live indicator appear healthy. Do not add user identity fields, wallet ranking, speculative buyer psychology, token taxes, treasury orders or automated promotion without a separate task.

The most important remaining deployment uncertainties are actual protocol/network configuration, the licensed GPU environment and measured inference latency. Resolve them with evidence and update `docs/VERIFICATION.md` after deployment.
