# MetaTray website design

MetaTray uses a dark editorial layout with a prominent interactive cortical viewer. The interface, branding and content belong to this independent project. Scientific attribution identifies the upstream model and its sources.

The flat ASCII wordmark `[tray]_` appears in the header and footer, paired with the `meta` product prefix so the complete name reads as MetaTray. Cool-white type and restrained cyan/periwinkle terminal accents replace the generic brain glyph. A crisp `[t]` terminal mark remains legible in the favicon. The mark deliberately avoids Meta's infinity silhouette and does not imply affiliation.

## Visual system

| Element | Specification |
| --- | --- |
| Canvas | Near-black `#09090b`; neutral panel surfaces; no large colored gradients |
| Typography | Self-hosted Inter for headings and prose; Geist Mono for controls, figures and labels |
| Hero | Large white two-line desktop heading; explanatory text and two actions at left; interactive observatory at right |
| Layout | Bordered outer frame, inset dashed vertical rails, generous section spacing |
| Actions | Off-white primary buttons with dark text; bracket-corner secondary hero action |
| Product panels | Fine square outlines, restrained stacked-frame treatment, compact tab strip |
| Signal colors | Cyan and coral encode model sign and separate market-receipt direction; labels and position distinguish the layers |
| Footer | Large outlined METATRAY wordmark, independent-project statement and useful navigation |

## Page structure

1. Dismissible announcement and primary navigation: Observatory, The science, How it works.
2. Split hero: introduction, entry actions and cortex/stimulus/receipt viewer. A compact recent-event feed sits beneath the viewer.
3. Factual stack strip: Pons market adapter, TRIBE v2 model reference, paper-only trading. These are capability labels, not endorsements.
4. Observatory: mode and connection state, market statistics, price chart, sensory input, event table, simulated account, paper decisions and optional actual prediction receipt.
5. Expandable questions explaining model meaning, update timing, paper-only behavior and schematic geometry.
6. Explanatory page cards and a footer with research, product and legal navigation, plus the current data mode.

Dedicated routes provide About MetaTray, the science, the trade-to-response path, the science-grounded lore, model setup, code evidence, terms and privacy. Informational routes use the same shared header/footer and a readable article layout with section anchors, a table of contents, source links and related-page navigation. Product copy identifies Meta TRIBE as the upstream research model without implying sponsorship.

The phone layout stacks the hero, removes the duplicate receipt callout and wraps dense status lines. Wide trade tables scroll inside their own panel. Navigation remains available without a hover menu.

## Interaction contracts

- Hero tabs support click, keyboard focus and left/right arrow navigation. Only the selected view is mounted.
- The 3D view uses Three.js and OrbitControls. Drag or arrow keys rotate; plus/minus zooms; the reset control restores the camera. Automatic camera motion has an explicit pause/resume control and respects the system's reduced-motion preference. Recent confirmed event receipts map deterministically to exterior points around the cortical surface; buys/sells create distinct cyan/coral expanding particles, and relative quote value changes their size only within a narrow unit-independent range. A bounded seen-event history prevents an old receipt from replaying as new.
- If an actual model surface and a current transaction are visible together, a persistent label distinguishes the model-colored fsaverage5 surface from the separately overlaid market-input pulse.
- Camera motion never generates or modifies model values. The default geometry is labeled illustrative. No model result means no response trace.
- The stimulus tab explains the input currently represented by the market context. Exact generated inputs belong to their completed job receipts.
- Receipt exports retain the existing snapshot and prediction schema. A missing model result remains null.
- Market-event buttons and table rows open the same inspectable receipt dialog. Escape closes it and returns focus.
- The observatory action scrolls to the market dashboard. Informational links navigate to real App Router pages with their own URL and metadata.
- The live market feed and asynchronous prediction publication keep their original timing and backend contracts. This visual revision does not make inference instantaneous.

## Files to edit

| File | Responsibility |
| --- | --- |
| `src/app/globals.css` | Tokens, layout rails, components, responsive sizing and reduced-motion CSS |
| `src/app/layout.tsx` | Self-hosted font imports and page metadata |
| `src/components/dashboard.tsx` | Page composition, view state, market and account controls |
| `src/components/site-chrome.tsx` | Shared navigation, product branding and footer links |
| `src/components/information-page.tsx` | Server-rendered article layout and table of contents |
| `src/lib/information-pages.tsx` | Explanatory content, Meta attribution, terms and privacy |
| `src/components/cortex.tsx` | Three.js rendering, camera controls, schematic and actual-surface paths |
| `src/components/chart.tsx` | Neutral price chart and actual response trace |
| `scripts/browser-check.mjs` | Production browser story, responsive checks and screenshots |

Keep content truthful when extending the design. A public launch still needs separately verified chain inputs and an authorized, benchmarked model service before it can display actual predicted responses to real token activity.
