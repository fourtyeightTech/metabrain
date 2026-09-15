# Deployment and operations

## Deployment modes

| Mode | Website | Persistent services | Model permission/access |
| --- | --- | --- | --- |
| Demo | Vercel alone | None | None; no model runs |
| Live RPC observer | Vercel + configured RPC | None | None; no model runs |
| Indexed observer | Vercel | Postgres + Node indexer | None; no model runs |
| Live cortical experiment | Vercel | Postgres + indexer + GPU worker + durable model/artifact volumes | Required for intended use and all selected models |

The website builds without credentials and shows live setup instructions until configured. Synthetic mode requires an explicit `METATRAY_MODE=demo`. The live paths are implemented but require operator configuration and the acceptance tests below. The GPU Docker image and real model invocation have not been executed in this handoff environment.

## 1. Vercel live RPC feed

Import the repository's latest `main` revision into Vercel as one ordinary Next.js project. The committed `vercel.json` sets the Next.js framework, install command, build command and a 30-second read-API duration limit at the repository root. It contains no `services` block and no rewrites: Next.js owns the pages, assets and `/api/*` route handlers directly.

| Import setting | Value |
| --- | --- |
| Project name | `metatray`, or another available project name |
| Git branch | `main` |
| Project root directory | `.` (repository root) |
| Framework preset | **Next.js** |
| Install command | `npm ci` (provided by config) |
| Build command | `npm run build` (provided by config) |
| Output directory | Leave the framework default |
| Node version | Supported version at least 22.12 |
| Environment | Live RPC variables below, Production and Preview |

If the import screen shows `tribe` / Python or asks for a multi-service `vercel.json`, do not accept that generated setup. Select **Next.js**, set Root Directory to `.`, and use the committed configuration. There is no `frontend/` directory and no `/api/tribe` web endpoint. `services/tribe` is a persistent GPU queue consumer, not an HTTP application; Next.js reads completed results from Postgres.

Vercel may prefill many names from `.env.example`. Remove unused blank rows. Add the following server environment variables for the direct RPC observer, then redeploy:

| Variable | Value |
| --- | --- |
| `METATRAY_MODE` | `live` (also the application default) |
| `METATRAY_FEED` | `rpc` |
| `RPC_HTTP_URL` | Private HTTP RPC endpoint for the selected chain; must allow chain ID, bytecode, contract reads, blocks and event logs |
| `CHAIN_ID` | Actual numeric EVM chain ID |
| `TOKEN_ADDRESS` | This new project's token contract |
| `MARKET_PROTOCOL` | `pons-v2` |
| `PONS_FACTORY_ADDRESS` | Verified factory that created this token, on this chain |
| `BLOCK_EXPLORER_URL` | Optional public HTTPS explorer base URL, with no credentials, query or fragment |

The four connection values named in the website setup state are `RPC_HTTP_URL`, `CHAIN_ID`, `TOKEN_ADDRESS` and `PONS_FACTORY_ADDRESS`. With the live/RPC mode and Pons protocol selected, they establish only the read-only market feed. They do **not** enable TRIBE, queue a model job or create a cortical heatmap. Real cortical output requires the separate indexed deployment in sections 2–6: Postgres, a persistent indexer and an authorized GPU worker.

For a compatible V3 pool, select `MARKET_PROTOCOL=uniswap-v3` and set `V3_POOL_ADDRESS` instead of the Pons factory. In Pons V2 mode the observer reads the hook and pool manager from the factory and validates deployed bytecode. It follows curve events and the derived V4 pool through graduation. It never reuses another project's token. The adapter was audited against [Pons V2 source revision `cb5748a29e4d3a7af1c4e982baa9ed9194d25a8f`](https://github.com/ponsdotdev/ponsfamily/tree/cb5748a29e4d3a7af1c4e982baa9ed9194d25a8f); separately verify that the selected deployment uses that compatible contract generation.

The browser polls every five seconds, with a short server cache and two confirmation blocks by default. Change `CONFIRMATION_BLOCKS` only with the chain's finality behavior in mind. `RPC_RECENT_BLOCKS` defaults to 60 (maximum 200), and `RPC_MAX_EVENTS` to 100 (maximum 200). This is a bounded recent view, not a complete history. Busy windows display a truncation notice. Curves use the execution ratio from event amounts; V3/V4 use post-swap spot prices. Quote values are not assumed to be USD.

Check `/api/health` and `/api/snapshot`. A healthy quiet market returns an empty real-event list with `waiting` status. Missing settings return HTTP 503 with their names, never secret values. Wrong-chain, mismatched-contract, reorg-during-read and unavailable-provider failures return a disconnected state. Old confirmed blocks are stale. No live error falls back to synthetic events. Match a displayed event's hash, block, direction, raw amounts and decimals to a transaction receipt on the configured chain.

The 3D schematic renders without the GPU worker. Fresh real events trigger authored cyan buy/coral sell receipt particles outside the cortical surface, explicitly labelled as market inputs. They are not neural values. Actual model colors are a separate display path that replays the latest completed cortical epoch. Direct RPC mode does not run model jobs or persistent paper decisions; its observer account holds simulated cash. For the full experiment, continue with sections 2–6 and set `METATRAY_FEED=indexed` plus `DATABASE_READ_URL` on Vercel. The persistent worker still requires its full configuration.

Completed indexed predictions populate the cortical atlas automatically. Each card uses the job's retained market input to show trade count, quote volume, price change and a descriptive market regime. Selecting a card loads that exact result through `/api/predictions/[id]`, its 20,484-vertex fsaverage5 mesh through `/api/mesh`, and its integrity-checked temporal frames through `/api/predictions/[id]/surface`. The browser replays genuine completed model rows on the upstream one-second grid. Any interpolation between those rows is visual only. The visual receipt button exports a 1200 × 630 PNG containing the current canvas and public provenance fields; the data receipt retains the complete JSON. A copied result link includes only the prediction UUID and resolves through the public read API.

This configuration follows Vercel's ordinary [project configuration](https://vercel.com/docs/project-configuration/vercel-json) and [Next.js Functions](https://vercel.com/docs/functions/functions-api-reference) paths. Vercel Services mode is intentionally not used.

For an optional synthetic preview only, set `METATRAY_MODE=demo`; that mode needs no database or RPC variables. There is no production model download in the web build. Do not set secrets with a `NEXT_PUBLIC_` prefix.

The website includes `/about`, `/science`, `/how-it-works`, `/deployment`, `/evidence`, `/terms` and `/privacy`. Set `METATRAY_PUBLIC_CONTACT_URL` to an HTTPS page offering an appropriate private contact route, and rebuild after changing it. This value is intended to be public; it must not contain credentials. Review `docs/LEGAL_REVIEW.md` and adapt the terms/privacy pages to the actual deployment before adopting them.

Local equivalent:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm start
```

Optional browser verification, after building:

```bash
npm run verify:browser
```

This starts its own temporary servers and uses a packaged test browser. On a host with its own compatible Chromium, set `BROWSER_EXECUTABLE_PATH` to that executable. Test images/reports are generated under `artifacts/`, not committed.

## 2. Postgres

Provision a private Postgres 16+ database. The indexer needs a **direct session connection** because it holds a session advisory lock. Do not use a transaction-pooled endpoint for that worker. The public website should use a small pooled connection through a separate read-only role. Preserve the provider's required TLS verification settings.

On the operator's machine or persistent market host, copy `.env.example` to a private `.env` and set `DATABASE_URL`. Apply all numbered migrations:

```bash
npm run db:migrate
```

The migrations are idempotent. They create tables only; they do not clear existing data. Migration `002_surface_frames.sql` adds the bounded temporal-surface table. Run the migration command against an existing deployment before starting the updated GPU worker or requesting the surface endpoint. Future schema changes need new numbered migrations.

Example read-only role setup, run by a database administrator in an interactive `psql` session:

```sql
CREATE ROLE metatray_web LOGIN;
\password metatray_web
GRANT CONNECT ON DATABASE metatray TO metatray_web;
GRANT USAGE ON SCHEMA public TO metatray_web;
GRANT SELECT ON metatray_state, metatray_events, metatray_jobs, metatray_predictions, metatray_prediction_surfaces, metatray_assets TO metatray_web;
```

Replace `metatray` with the actual database name if different. Set the password interactively; do not put it in a public script. The deployment provider can also create a read-only role. Only the worker/migration role needs writes. Supply the resulting private read connection to Vercel as `DATABASE_READ_URL`.

For local development, `compose.yaml` provides a Postgres service. Set a private `LOCAL_POSTGRES_PASSWORD` in `.env` and run `docker compose up -d postgres`. The port is bound to loopback. Use a loopback database connection for host commands; a container uses the service hostname `postgres` instead. Copy a valid connection string into the respective host/container environment and URL-encode any password characters that require it. Do not expose local Postgres to the internet.

## 3. Configure the market worker

| Variable | Meaning / default |
| --- | --- |
| `METATRAY_MODE` | Set `live` for live website/doctor behavior |
| `METATRAY_FEED` | Set `indexed` on the website when reading the persistent pipeline |
| `DATABASE_URL` | Direct writer connection for persistent services |
| `RPC_HTTP_URL` | Private HTTP endpoint; requires logs, bytecode, chain ID and historic contract calls |
| `RPC_WS_URL` | Optional WebSocket endpoint; HTTP polling still recovers missed blocks |
| `CHAIN_ID` | Required numeric EVM chain ID; no chain is assumed |
| `TOKEN_ADDRESS` | Required new token contract; no token is preselected |
| `TOKEN_START_BLOCK` | Required launch/start block, at or before the desired first observed event |
| `MARKET_PROTOCOL` | `pons-v2` or `uniswap-v3` |
| `PONS_FACTORY_ADDRESS` | Verified V2 factory for the selected chain |
| `PONS_HOOK_ADDRESS` | Hook used in this launch's V4 pool key |
| `V4_POOL_MANAGER_ADDRESS` | Correct deployed V4 PoolManager |
| `V3_POOL_ADDRESS` | Used only for explicit V3 mode |
| `METATRAY_TOKEN_SYMBOL`, `METATRAY_QUOTE_SYMBOL` | Public display labels; configure the actual quote unit |
| `CONFIRMATION_BLOCKS` | 2 by default, configurable 0–128; not an absolute finality guarantee |
| `RPC_BLOCK_BATCH` | At most 30 blocks per catch-up cycle by default; lower for constrained providers |
| `REORG_HISTORY_BLOCKS` | 128 rollback checkpoints by default |

Validate the actual deployment's ABI/version and contract relationships against [the pinned Pons source](https://github.com/ponsdotdev/ponsfamily/tree/cb5748a29e4d3a7af1c4e982baa9ed9194d25a8f). Do not paste a token address from another project. This code does not assume that every token on a Pons webpage uses the same contract generation.

Run:

```bash
npm run doctor
npm run worker
```

Use a persistent VM/container/process supervisor for `npm run worker`, with graceful SIGTERM and automatic restarts. The supplied `services/Dockerfile.indexer` builds from the repository root. With private `.env` configured for container networking, `docker compose --profile market up -d indexer` is a local/container option.

Watch private logs and database health. `doctor` checks configuration, database migration availability, RPC chain ID, contract bytecode, discovery and start-block bounds. It does not prove that a swap was observed. If indexing fails, verify the private configuration and provider logs; public API errors deliberately omit credentials and verbose RPC details.

## 4. Turn on the live website

In Vercel, set `METATRAY_MODE=live`, `METATRAY_FEED=indexed` and `DATABASE_READ_URL`, then redeploy. This explicitly switches away from the recent RPC observer. The website reads the token symbol, chain and confirmation settings from the running indexer's database. It does not require the RPC URL, writer connection, HF token or model permission record.

Before proceeding, observe at least one genuine swap and compare its transaction hash, log index, raw amounts, direction and normalized price basis with the chain receipt. Confirm the cursor advances through blocks with no trades, and the frontend reports failure when the worker is stopped.

## 5. Paper settings

| Variable | Default |
| --- | --- |
| `PAPER_POLICY` | `observer` in live mode |
| `PAPER_INITIAL_QUOTE` | 10,000 quote units |
| `PAPER_FEE_BPS` | 30 basis points per simulated fill |
| `PAPER_SLIPPAGE_BPS` | 20 basis points adverse slippage |
| `PAPER_MAX_EXPOSURE` | 0.25 target fraction of equity |
| `INFERENCE_MAX_AGE_SECONDS` | 45 seconds for model input/result freshness |

The cooldown is 30 seconds and the minimum rebalance change is 1% of equity. These are authored rules in `src/lib/paper.ts`, not learned parameters. The fee/slippage numbers are estimates and do not automatically match the token's creator tax, transfer tax or pool fees. No on-chain execution is performed.

The worker fingerprints paper settings to protect experiment continuity. For a changed policy or account configuration, create a new database and repeat migration/discovery. Retain the old experiment instead of deleting its history. The demo's policy selector affects only its synthetic replay; it cannot change a live account.

## 6. Prepare the GPU environment

Establish permission for this intended model use first. The released TRIBE source/weights are CC BY-NC 4.0. Token promotion or another commercial use is plausibly outside those noncommercial terms; obtain separate permission and legal review before enabling it. The original integration code's MIT license does not supply commercial rights to those components.

You need a Linux CUDA-capable host, a compatible NVIDIA driver/runtime, sufficient GPU memory for the checkpoint and modality extractors, and durable storage for models, feature caches and artifacts. This project does not claim a measured minimum VRAM requirement or a tested GPU SKU. Benchmark on your chosen host before committing to a low-latency deployment. Vercel is the web host in this design; the GPU service runs separately.

Required private model settings:

| Variable | Value |
| --- | --- |
| `TRIBE_ENABLED` | `true` only after an appropriate rights basis exists |
| `TRIBE_RIGHTS_REFERENCE` | Private reference to the operator's permission/use documentation |
| `TRIBE_CODE_REVISION` | Keep `af58661791a351a448a489042a28f6c37e1c14b7` for this adapter |
| `TRIBE_WEIGHTS_REVISION` | Full 40-character commit from the official `facebook/tribev2` model repository |
| `LLAMA_REVISION` | Full commit from `meta-llama/Llama-3.2-3B` |
| `VJEPA_REVISION` | Full commit from `facebook/vjepa2-vitg-fpc64-256` |
| `W2VBERT_REVISION` | Full commit from `facebook/w2v-bert-2.0` |
| `HF_TOKEN` | Private model-read token with any required gated access |
| `TRIBE_MODEL_PATH` | `/models/tribev2` on a durable volume |
| `TRIBE_CACHE_PATH` | `/cache/tribev2` on a durable volume |
| `TRIBE_ARTIFACT_PATH` | `/data/metatray` on a durable volume |
| `TRIBE_DEVICE` | `cuda` |

Resolve revisions from the official model repositories after reviewing their cards. Do not set them to `main`; the preparation script requires immutable commits. Never share the HF token or permission record in GitHub, screenshots or public environment variables.

Docker path, from the repository root:

```bash
docker compose --profile gpu build tribe
docker compose --profile gpu run --rm tribe python prepare_models.py
docker compose --profile gpu run --rm tribe python smoke.py --render-only
docker compose --profile gpu run --rm tribe python smoke.py
```

The model preparation command downloads only after the explicit enabled/rights configuration check. The three feature models and TRIBE checkpoint are pinned and stored with provenance. The adapter verifies checkpoint/config hashes and the installed upstream Git revision. It rejects missing pins or ignored feature-path overrides.

The Dockerfile constrains the direct Python dependencies and uses the upstream-required `neuralset==0.0.2` and `neuraltrain==0.0.2` through TRIBE. Do not substitute the current NeuroAI main branch: its extractor interfaces have changed. `bin/uvx` routes the upstream WhisperX invocation to version 3.3.4 in an isolated `uv` tool environment. ASR/alignment model downloads and transitive packages are not a fully locked deployment environment in this handoff. After the first successful smoke run, retain the caches, record tool/model file hashes, archive both Python environments' exact package lists and pin your built image digest. Test before upgrading any part of that stack.

`smoke.py --render-only` creates an explicitly synthetic 100-second chart/narration test. Without `--render-only`, it calls the real model and stores its output privately. Neither form writes predictions into the live database. Inspect `stimulus.mp4`, `events.csv`, `prediction.npz`, the compact temporal-surface artifact and `smoke-result.json`. Require finite `(time, 20484)` output, preserved upstream starts/durations and a matching `eventsHash` for the retained event table. Validate the transcript and check that silence or digit-heavy speech has not produced unintended language.

Then launch:

```bash
docker compose --profile gpu up -d tribe
```

The GPU worker needs the writer `DATABASE_URL`. Set `INFERENCE_ENABLED=true` on the indexer and restart the indexer. Defaults are a 100-second input context and a 15-second refresh request. Upstream features are represented at 2 Hz, cortical output is on a 1 Hz grid, and the model alignment includes an approximately five-second hemodynamic offset. None of those values is a claim of millisecond neuron simulation or instantaneous per-swap inference. The website reports queue/running/failure counts and delayed results. If processing consistently exceeds the 45-second freshness budget, leave cortical paper trading inactive; use observer mode and report measured delays.

## 7. Operations, retention and recovery

- Monitor API health, indexer heartbeat/cursor, newest event timestamp, queued/running/failed jobs, input age, GPU processing latency and disk usage. An indexer heartbeat does not establish model health or prediction accuracy.
- Keep host clocks synchronized. Freshness and paper decision receipts rely on sensible wall-clock times.
- Back up Postgres and artifact/model volumes. Preserve manifests and matching raw outputs when reporting results.
- Block checkpoints are bounded by the reorg horizon; active model jobs protect their source checkpoints. Event history, finished jobs/predictions and feature/media artifacts are retained until the operator archives/removes them. Set storage alerts and a documented retention policy before continuous operation. Frequent full-window rendering can consume substantial storage.
- Archive the private raw NPZ and manifest before removing a result. Do not delete predictions referenced by a still-retained paper ledger if you want that ledger to remain auditable. Prune completed/cancelled jobs only after associated result handling; the database foreign key enforces order. Never delete active job directories.
- Ordinary failed jobs are visible as failures. After fixing the cause, the next queued window supplies fresh work. Lease recovery handles interrupted workers separately. Do not relabel failed jobs as complete.
- A deep reorg beyond retained checkpoints stops normal ingestion. Preserve the old database, choose a canonical start block and rebuild into a fresh database. Historical backfill does not fabricate retrospective trading performance.
- Multiple GPU consumers are supported by leases, but benchmark one first. Multiple indexers on the same database are rejected by the advisory lock.

## Acceptance test for actual live inference

1. Record one real token swap receipt and its corresponding `metatray_events` row.
2. Find a completed job whose input contains that event and whose source block remains canonical.
3. Match its public `stimulusHash` to the retained video, and its `outputHash` to `prediction.npz`.
4. Verify the model/code revisions, output dimensions and fsaverage5 vertex order.
5. Fetch `/api/predictions/{id}/surface`; verify its frame/vertex metadata matches the completed prediction, its vertex count is 20,484 and its integrity hash matches the stored payload.
6. Confirm the dashboard replays that completed epoch on the anatomical surface while receipt pulses remain a visibly separate market-input layer. Check the fixed ±2 normalized-model-unit legend and accurate input/publication ages.
7. Stop the GPU service and verify that old results become delayed and cannot produce new cortical decisions.
8. Test reorg/cancellation and lease recovery on a controlled development chain/database before making robustness claims about production. Unit tests are not a substitute for the deployed chain's behavior.
9. Record measured median/p95 processing delay, stale-result rate, GPU memory use and costs. Update `docs/VERIFICATION.md` with actual evidence.

For Vercel setup mechanics, consult the [official Next.js deployment guide](https://vercel.com/docs/frameworks/full-stack/nextjs). No service is deployed or billed merely by unpacking this archive.
