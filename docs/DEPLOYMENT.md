# Deployment and operations

## Deployment modes

| Mode | Website | Persistent services | Model permission/access |
| --- | --- | --- | --- |
| Demo | Vercel alone | None | None; no model runs |
| Live observer | Vercel | Postgres + Node indexer | None; no model runs |
| Live cortical experiment | Vercel | Postgres + indexer + GPU worker + durable model/artifact volumes | Required for intended use and all selected models |

The website is ready to build in demo mode. The live paths are implemented but require operator configuration and the acceptance tests below. The GPU Docker image and real model invocation have not been executed in this handoff environment.

## 1. Vercel demo

Import the new repository into Vercel with the framework preset **Next.js**. Use the directory containing `package.json` as the root. `vercel.json` supplies `npm ci`, `npm run build` and a 15-second read-API duration limit. Use a supported Node version at least 22.12.

Set `TRAY_MODE=demo`. Deploy. No database or RPC variables are needed. There is no production model download in the web build. Do not set secrets with a `NEXT_PUBLIC_` prefix.

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

On the operator's machine or persistent market host, copy `.env.example` to a private `.env` and set `DATABASE_URL`. Apply the initial migration:

```bash
npm run db:migrate
```

The migration is idempotent. It creates tables only; it does not clear existing data. Future schema changes need new numbered migrations.

Example read-only role setup, run by a database administrator in an interactive `psql` session:

```sql
CREATE ROLE tray_web LOGIN;
\password tray_web
GRANT CONNECT ON DATABASE tray TO tray_web;
GRANT USAGE ON SCHEMA public TO tray_web;
GRANT SELECT ON tray_state, tray_events, tray_jobs, tray_predictions, tray_assets TO tray_web;
```

Replace `tray` with the actual database name if different. Set the password interactively; do not put it in a public script. The deployment provider can also create a read-only role. Only the worker/migration role needs writes. Supply the resulting private read connection to Vercel as `DATABASE_READ_URL`.

For local development, `compose.yaml` provides a Postgres service. Set a private `LOCAL_POSTGRES_PASSWORD` in `.env` and run `docker compose up -d postgres`. The port is bound to loopback. Use a loopback database connection for host commands; a container uses the service hostname `postgres` instead. Copy a valid connection string into the respective host/container environment and URL-encode any password characters that require it. Do not expose local Postgres to the internet.

## 3. Configure the market worker

| Variable | Meaning / default |
| --- | --- |
| `TRAY_MODE` | Set `live` for live website/doctor behavior |
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
| `TRAY_TOKEN_SYMBOL`, `TRAY_QUOTE_SYMBOL` | Public display labels; configure the actual quote unit |
| `CONFIRMATION_BLOCKS` | 2 by default, configurable 0–128; not an absolute finality guarantee |
| `RPC_BLOCK_BATCH` | At most 30 blocks per catch-up cycle by default; lower for constrained providers |
| `REORG_HISTORY_BLOCKS` | 128 rollback checkpoints by default |

Validate the actual deployment's ABI/version and contract relationships against [Pons source](https://github.com/ponsdotdev/ponsfamily). Do not paste a token address from another project. This code does not assume that every token on a Pons webpage uses the same contract generation.

Run:

```bash
npm run doctor
npm run worker
```

Use a persistent VM/container/process supervisor for `npm run worker`, with graceful SIGTERM and automatic restarts. The supplied `services/Dockerfile.indexer` builds from the repository root. With private `.env` configured for container networking, `docker compose --profile market up -d indexer` is a local/container option.

Watch private logs and database health. `doctor` checks configuration, database migration availability, RPC chain ID, contract bytecode, discovery and start-block bounds. It does not prove that a swap was observed. If indexing fails, verify the private configuration and provider logs; public API errors deliberately omit credentials and verbose RPC details.

## 4. Turn on the live website

In Vercel, set `TRAY_MODE=live` and `DATABASE_READ_URL`, then redeploy. The website reads the token symbol, chain and confirmation settings from the running indexer's database. It does not require the RPC URL, writer connection, HF token or model permission record.

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

Establish permission for this intended model use first. The released TRIBE source/weights are CC BY-NC 4.0. The original integration code's MIT license does not supply commercial rights to those components.

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
| `TRIBE_ARTIFACT_PATH` | `/data/tray` on a durable volume |
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

`smoke.py --render-only` creates an explicitly synthetic 100-second chart/narration test. Without `--render-only`, it calls the real model and stores its output privately. Neither form writes predictions into the live database. Inspect `stimulus.mp4`, `events.csv`, `prediction.npz` and `smoke-result.json`. Require finite `(time, 20484)` output and preserved upstream starts/durations. Validate the transcript and check that silence or digit-heavy speech has not produced unintended language.

Then launch:

```bash
docker compose --profile gpu up -d tribe
```

The GPU worker needs the writer `DATABASE_URL`. Set `INFERENCE_ENABLED=true` on the indexer and restart the indexer. Defaults are a 100-second input context and a 15-second refresh request. The website reports queue/running/failure counts and delayed results. If processing consistently exceeds the 45-second freshness budget, leave cortical paper trading inactive; use observer mode and report measured delays.

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

1. Record one real token swap receipt and its corresponding `tray_events` row.
2. Find a completed job whose input contains that event and whose source block remains canonical.
3. Match its public `stimulusHash` to the retained video, and its `outputHash` to `prediction.npz`.
4. Verify the model/code revisions, output dimensions and fsaverage5 vertex order.
5. Confirm the dashboard displays the returned values and public receipt, with accurate input age.
6. Stop the GPU service and verify that old results become delayed and cannot produce new cortical decisions.
7. Test reorg/cancellation and lease recovery on a controlled development chain/database before making robustness claims about production. Unit tests are not a substitute for the deployed chain's behavior.
8. Record measured median/p95 processing delay, stale-result rate, GPU memory use and costs. Update `docs/VERIFICATION.md` with actual evidence.

For Vercel setup mechanics, consult the [official Next.js deployment guide](https://vercel.com/docs/frameworks/full-stack/nextjs). No service is deployed or billed merely by unpacking this archive.
