# MetaTray

**A cortical market observatory with paper trading, built around Meta TRIBE v2.**

Application source for [fourtyeightTech/metabrain](https://github.com/fourtyeightTech/metabrain). The Next.js application lives at the repository root.

MetaTray turns observed token trades into a market-screen video, trade tones and a factual spoken update. An optional, separately hosted TRIBE service predicts cortical responses to that authored experience. The website displays the output alongside the market and a simulated portfolio.

The website reads real recent swaps directly from RPC on Vercel once the new token, chain and factory/pool are configured. Missing configuration produces a visible setup panel. Persistent history, paper decisions and model jobs use the separate Postgres/indexer path. Actual cortical output also requires a compatible GPU service, model access and permission for the intended use. No predictions or trading returns from the real model are claimed by this package.

MetaTray’s visual identity uses a near-black canvas, a crisp cyan-and-white `[tray]_` terminal mark, large white typography, monospace controls, fine layout rails and a split hero containing the interactive 3D cortex. Every route uses the exact browser-tab title `metatray`. MetaTray has its own branding, content and original UI implementation. Read [DESIGN.md](docs/DESIGN.md) for the design specification.

The website has dedicated routes for `/experiment`, `/about`, `/science`, `/how-it-works`, `/lore`, `/deployment`, `/evidence`, `/terms` and `/privacy`. Experiment 001 gives the Pons-to-cortex pipeline its own complete public page; the lore maps every story term to a real system state, and the science pages explain the actual Meta TRIBE interface, feature models, cortical output and experimental paper policy. The terms are a draft for review and do not promise complete exclusion of liability; see [LEGAL_REVIEW.md](docs/LEGAL_REVIEW.md).

## Run the website

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Without configuration, the live setup panel lists missing variable names. For a synthetic preview only, explicitly set `METATRAY_MODE=demo`.

```bash
npm run typecheck
npm test
npm run build
npm start
```

## Deploy this repository to Vercel

Import `fourtyeightTech/metabrain` into Vercel as one **Next.js** project and keep the project root directory at `.`. The supplied `vercel.json` uses the ordinary root-project configuration with `npm ci`, `npm run build` and a 30-second limit for the read APIs. It deliberately has no Vercel `services` block and no service rewrites. The Python GPU worker remains outside the Vercel deployment.

Set these **server-side** Vercel variables using this project's verified deployment, then redeploy:

```dotenv
METATRAY_MODE=live
METATRAY_FEED=rpc
RPC_HTTP_URL=<private HTTP RPC endpoint>
CHAIN_ID=<numeric chain ID>
TOKEN_ADDRESS=<new token contract>
MARKET_PROTOCOL=pons-v2
PONS_FACTORY_ADDRESS=<verified factory on that chain>
```

For a compatible V3 market, use `MARKET_PROTOCOL=uniswap-v3` and `V3_POOL_ADDRESS` instead of the factory. `BLOCK_EXPLORER_URL` is optional and enables transaction links. Do not use `NEXT_PUBLIC_` for credentials. Remove unused blank import rows; RPC mode needs no database, Hugging Face token or model weights. See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for limits and checks.

The live console shows decoded swaps, block numbers, transaction receipts, connection age and each pipeline stage. Real buys/sells drive labelled input pulses on the 3D schematic. These pulses are **an illustrative market mapping, not Meta predictions**. Actual model values color the anatomical surface only after the separately hosted GPU worker publishes a valid result. `/evidence` links directly to [MetaTray's adapter](services/tribe/adapter.py), [Meta's pinned inference code](https://github.com/facebookresearch/tribev2/blob/af58661791a351a448a489042a28f6c37e1c14b7/tribev2/demo_utils.py), the [audited Pons V2 source](https://github.com/ponsdotdev/ponsfamily/tree/cb5748a29e4d3a7af1c4e982baa9ed9194d25a8f) and MetaTray's chain decoder.

Direct RPC mode re-reads up to 200 recent blocks and displays up to 200 events (defaults: 60/100); it does not persist a paper ledger or run inference. For those features, deploy Postgres and the persistent indexer, then select `METATRAY_FEED=indexed` and supply `DATABASE_READ_URL` on Vercel. Add the optional GPU worker as described in the deployment guide. The frontend polls RPC snapshots every five seconds and indexed snapshots every two seconds, in addition to the configured block confirmation delay.

Set `METATRAY_PUBLIC_CONTACT_URL` to a public HTTPS page that offers an appropriate private contact route for terms/privacy requests, then rebuild. No personal contact details are included in the source. The privacy notice must match the deployment's actual provider and retention settings.

## What is implemented

| Component | Behavior |
| --- | --- |
| Observatory | Split hero with cortex/stimulus/receipt tabs, optional camera rotation, responsive dashboard, market chart, activity table and paper account |
| Cortical atlas | Up to 24 completed TRIBE epochs with their exact market-window regime, trade count, quote volume, price change and model-response magnitude; any epoch can reopen its full surface |
| Shareable receipts | JSON session receipt, 1200 × 630 visual market/model receipt, and direct links to completed prediction IDs |
| Live input stream | Read-only RPC discovery, confirmed recent swaps, block/hash receipts, missing-setting and outage states, trade-driven illustrative 3D pulses |
| Demo | Reproducible synthetic prices; working paper policies; clearly labeled schematic with no invented cortical output |
| Pons V2 adapter | Factory discovery, curve buys/sells and the derived future Uniswap V4 pool; automatic observation across graduation |
| V3 adapter | Explicit pool selection for a compatible existing market |
| Chain worker | Mined-log ingestion, bounded catch-up, optional WebSocket notifications, confirmation delay, canonical parent checks and reorg rollback |
| Paper engine | Cash/units/cost basis, simulated fees/slippage, realized P/L, exposure target, cooldown, three policies |
| Model worker | Durable leases, real audiovisual rendering, official TRIBE inference call, output validation, fsaverage5 geometry, prediction receipts |
| Handoff | Vercel configuration, Dockerfiles, Compose, SQL migration, CI, tests, operator smoke test and detailed documentation |

There is no token contract, wallet connection, private-key field or order-submission path. The application observes your independently deployed token. It does not buy tokens, alter supply, collect fees or issue rewards.

## Scientific meaning

TRIBE v2 is an encoding model for predicted fMRI responses to sensory stimuli. Its public inference interface returns an averaged-subject response on a cortical surface. It does not provide a human connectome, consciousness, emotions, price forecasts or a validated trading policy. [Official repository](https://github.com/facebookresearch/tribev2)

MetaTray's proposed market experiment is an extension outside the release's demonstrated financial validation. Read [SCIENCE.md](docs/SCIENCE.md) before describing the project publicly. The released TRIBE code and weights are CC BY-NC 4.0; a token-related commercial deployment needs a suitable rights basis. This ZIP contains original integration code and references, not TRIBE weights or a commercial license.

## Start the deployment handoff here

1. [AGENT_HANDOFF.md](AGENT_HANDOFF.md): ordered implementation and deployment checklist.
2. [DEPLOYMENT.md](docs/DEPLOYMENT.md): Vercel, database, indexer, GPU worker and environment reference.
3. [SCIENCE.md](docs/SCIENCE.md): supported claims, input construction, timing, limitations and research protocol.
4. [ARCHITECTURE.md](docs/ARCHITECTURE.md): data contracts, repository map, queue and rollback semantics.
5. [VERIFICATION.md](docs/VERIFICATION.md): what was tested and what remains unverified.

## Project boundaries

- No token or chain is preselected. Configure this project's deployment explicitly.
- All portfolio values use the configured quote asset, not an assumed USD price.
- The token feed can update frequently; GPU processing is asynchronous and must be benchmarked. A 15-second queue interval is not a 15-second inference guarantee.
- Momentum is the independent comparison policy. Cortical mode requires a fresh actual model result and uses its response-change magnitude only to scale an authored momentum rule.
- A result that is too old can still be inspected as delayed output. It cannot authorize a cortical paper decision.
- Credentials belong in private deployment environments. No personal information or live deployment credentials are supplied.

Original project files are covered by [LICENSE](LICENSE). Dependency and model terms are described in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
