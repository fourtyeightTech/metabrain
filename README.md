# Tray the Trader

**A cortical market observatory with paper trading, built around Meta TRIBE v2.**

Application source for [fourtyeightTech/metabrain](https://github.com/fourtyeightTech/metabrain). The Next.js application lives at the repository root.

Tray turns observed token trades into a market-screen video, trade tones and a factual spoken update. An optional, separately hosted TRIBE service predicts cortical responses to that authored experience. The website displays the output alongside the market and a simulated portfolio.

The included demo runs immediately on Vercel. Live data requires your new token's chain and protocol configuration, Postgres and a persistent indexer. Actual cortical output also requires a compatible GPU service, model access and permission for the intended use. No predictions or trading returns from the real model are claimed by this package.

The website uses an AgentMail-inspired visual direction: a near-black canvas, large white typography, monospace controls, fine layout rails and a split hero containing the interactive 3D cortex. Tray has its own branding, content and original UI implementation. Read [DESIGN.md](docs/DESIGN.md) for the design specification.

## Run the website

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. No environment file is needed for the default demo.

```bash
npm run typecheck
npm test
npm run build
npm start
```

## Deploy this repository to Vercel

Import `fourtyeightTech/metabrain` into Vercel, select the Next.js preset, and keep the root directory at `.`. The supplied `vercel.json` defines `npm ci` and `npm run build`. Set `TRAY_MODE=demo` for the initial deployment. The demo needs no database, RPC credentials or model weights.

Live mode is a separate configuration step: deploy the persistent indexer and database, then connect the optional GPU worker as described in [DEPLOYMENT.md](docs/DEPLOYMENT.md). The 3D demo is explicitly illustrative until an actual model result exists.

## What is implemented

| Component | Behavior |
| --- | --- |
| Observatory | Split hero with cortex/stimulus/receipt tabs, optional camera rotation, responsive dashboard, market chart, activity table, paper account, session receipt download |
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

Tray's proposed market experiment is an extension outside the release's demonstrated financial validation. Read [SCIENCE.md](docs/SCIENCE.md) before describing the project publicly. The released TRIBE code and weights are CC BY-NC 4.0; a token-related commercial deployment needs a suitable rights basis. This ZIP contains original integration code and references, not TRIBE weights or a commercial license.

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
