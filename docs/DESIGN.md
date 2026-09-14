# Tray website design

Visual reference: [AgentMail](https://www.agentmail.to/), inspected on 2026-09-14. The implementation adapts its dark editorial layout and product-demo placement for Tray. It does not reuse the site's source, assets, logo, endorsements, people or promotional claims.

## Visual system

| Element | Specification |
| --- | --- |
| Canvas | Near-black `#09090b`; neutral panel surfaces; no large colored gradients |
| Typography | Self-hosted Inter for headings and prose; Geist Mono for controls, figures and labels |
| Hero | Large white two-line desktop heading; explanatory text and two actions at left; interactive observatory at right |
| Layout | Bordered outer frame, inset dashed vertical rails, generous section spacing |
| Actions | Off-white primary buttons with dark text; bracket-corner secondary hero action |
| Product panels | Fine square outlines, restrained stacked-frame treatment, compact tab strip |
| Signal colors | Muted green and amber reserved for market direction and model-value meaning |
| Footer | Large outlined TRAY wordmark, independent-project statement and useful navigation |

## Page structure

1. Dismissible announcement and primary navigation: Observatory, The science, Deployment.
2. Split hero: introduction, entry actions and cortex/stimulus/receipt viewer. A compact recent-event feed sits beneath the viewer.
3. Factual stack strip: Pons market adapter, TRIBE v2 model reference, paper-only trading. These are capability labels, not endorsements.
4. Observatory: mode and connection state, market statistics, price chart, sensory input, event table, simulated account, paper decisions and optional actual prediction receipt.
5. Expandable questions explaining model meaning, update timing, paper-only behavior and schematic geometry.
6. Footer with navigation and the current data mode.

The phone layout stacks the hero, removes the duplicate receipt callout and wraps dense status lines. Wide trade tables scroll inside their own panel. Navigation remains available without a hover menu.

## Interaction contracts

- Hero tabs support click, keyboard focus and left/right arrow navigation. Only the selected view is mounted.
- The 3D view uses Three.js and OrbitControls. Drag rotates; the reset control restores the camera. Automatic camera motion has an explicit pause/resume control and respects the system's reduced-motion preference.
- Camera motion never generates or modifies model values. The default geometry is labeled illustrative. No model result means no response trace.
- The stimulus tab explains the input currently represented by the market context. Exact generated inputs belong to their completed job receipts.
- Receipt exports retain the existing snapshot and prediction schema. A missing model result remains null.
- Market-event buttons and table rows open the same inspectable receipt dialog. Escape closes it and returns focus.
- The observatory action scrolls to the market dashboard. The science and deployment actions select their existing informational pages.
- The live market feed and asynchronous prediction publication keep their original timing and backend contracts. This visual revision does not make inference instantaneous.

## Files to edit

| File | Responsibility |
| --- | --- |
| `src/app/globals.css` | Tokens, layout rails, components, responsive sizing and reduced-motion CSS |
| `src/app/layout.tsx` | Self-hosted font imports and page metadata |
| `src/components/dashboard.tsx` | Page composition, view state, market and account controls |
| `src/components/cortex.tsx` | Three.js rendering, camera controls, schematic and actual-surface paths |
| `src/components/chart.tsx` | Neutral price chart and actual response trace |
| `scripts/browser-check.mjs` | Production browser story, responsive checks and screenshots |

Keep content truthful when extending the design. A public launch still needs separately verified chain inputs and an authorized, benchmarked model service before it can display actual predicted responses to real token activity.
