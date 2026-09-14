# Scientific design and limits

## What MetaTray means by a cortical response

The biological object behind MetaTray is a **learned encoding model**. A recorded sensory experience is transformed into predicted fMRI-like activity on a cortical surface. This is a model output, not a recording from a person, an electrode signal, a simulation of individual neurons or a human connectome.

The [TRIBE v2 paper](https://arxiv.org/abs/2605.04326) describes a multimodal neuroscience model evaluated using more than 1,000 hours of fMRI across 720 subjects. Those aggregate study counts should not be described as 720 individual brains running inside MetaTray. The released checkpoint configuration contains 25 subject heads, and its public inference wrapper averages subject-specific components. [Official inference API](https://github.com/facebookresearch/tribev2/blob/af58661791a351a448a489042a28f6c37e1c14b7/tribev2/demo_utils.py)

The [released configuration](https://huggingface.co/facebook/tribev2/blob/main/config.yaml) uses language, audio and video features; the named feature encoders are Llama 3.2 3B, w2v-BERT 2.0 and V-JEPA 2. The transformer is noncausal. Its surface target is fsaverage5, with approximately 20,000 cortical vertices. A surface vertex is not one neuron.

This integration uses original code around the published API. It does not retrain the model or include experimental participants' recordings, identifying metadata or private research files.

## The exact proposed experiment

**Question:** How does the released encoding model respond to a fixed representation of changing token-market information?

That question is narrower than whether humans want to buy a token. It is also narrower than whether a brain model can trade profitably. The project implements the input/output experiment and a separate paper policy so those propositions are not conflated.

An observation window contains a sequence of market events already recorded in the indexer's database. The renderer creates a new audiovisual experience from them. That choice of representation is part of the experimental treatment. A different chart scale, voice, text or color can change a multimodal model's output even if the underlying market is identical.

### Stimulus protocol: `metatray-market-screen-v1`

| Element | Current implementation | Interpretation |
| --- | --- | --- |
| Video | 640 × 360, 8 frames/second, 30–100 seconds | Authored market-screen replay, not footage from a human viewing session |
| Price chart | Uses events visible at each replay timestamp; no future ticks are drawn | Reconstructs observed market evolution |
| Chart range | Expands with values visible so far | A display choice and possible confound; keep fixed across comparisons |
| Event tones | Buy 660 Hz, sell 330 Hz, short low-volume tones | Published arbitrary mapping of trade direction into sound |
| Spoken text | Local eSpeak NG English narration of factual market and paper-account values | Gives the language/audio encoders semantic input |
| Portfolio narration | Cutoff snapshot narrated near the end of the replay | Does not claim the cutoff portfolio existed at every prior frame |
| Input seed | Most recent observation before the window when available | Provides an opening price without inventing one |
| No seed yet | Blank price region until a first observation is present | Missing data stays missing |

The token-return sentence compares the most recent price with an observation at least 60 seconds earlier, or the first available observation if history is shorter. The narration explicitly says the available recent interval; it is not guaranteed to be an exact one-minute return. Cash, position value and unrealized P/L describe a simulated account in quote-asset units.

The renderer never calls an LLM to embellish the story. It does not describe whales, fear, greed, panic, intelligence or investor identity. Amounts and market direction generate the input; the model output does not write its own supposedly objective stimulus.

### Inference

The worker calls the official `TribeModel.from_pretrained`, `get_events_dataframe(video_path=...)` and `predict(events=...)` interfaces. The upstream preprocessing extracts audio, produces word timings through WhisperX, and prepares the modality features. The adapter pins the source revision and points feature extractors to immutable downloaded snapshots.

The array must have finite values and the expected surface width. The adapter rejects incompatible geometry, missing segment metadata and duplicate output starts. Raw predictions and upstream segment starts/durations are retained in `prediction.npz`. No synthetic value is substituted on failure.

## Five clocks that must not be collapsed

| Clock | Meaning |
| --- | --- |
| Chain timestamp | Timestamp of a mined block containing an observed log |
| Input cutoff | Wall-clock time the indexer seals the job, using only already indexed events |
| Replay time | Time within the generated media, starting at zero |
| Upstream response time | `segment.start` associated with a prediction row by the released pipeline |
| Publication time | Database publication timestamp after rendering, preprocessing and inference |

TRIBE's [README](https://github.com/facebookresearch/tribev2) documents a five-second offset intended to compensate for hemodynamic lag. That scientific alignment is separate from processing delay. MetaTray preserves upstream segment metadata and applies no additional five-second shift. Output time is not labeled as the instantaneous neuronal response to a blockchain transaction.

The supplied model uses context on both sides within its inference window. MetaTray's rolling-window use is therefore labeled **experimental**. All market observations in a job precede its cutoff, but earlier predicted rows can still depend on later parts of that same authored replay. This package does not retrospectively apply those rows to paper decisions during the replayed interval.

Only a result already published and still fresh can influence a new cortical paper decision. The default freshness threshold checks both input cutoff age and result age against 45 seconds. Model latency greater than that threshold means the response remains visible as delayed output while the cortical policy waits. Processing the next window every 15 seconds is a queue policy, not a promise that inference completes every 15 seconds.

## What is displayed

The normal demo shows an explicitly labeled decorative cortex. Its geometry is authored, and it contains no neural predictions.

Once actual inference succeeds, the service supplies fsaverage5 inflated surfaces from Nilearn. Left and right hemispheres are concatenated without reordering their vertices. The camera rotation changes coordinates, not the correspondence between an output column and a vertex.

Teal indicates positive normalized model values and amber negative values. The color scale is fixed at ±2 model units; values outside it saturate visually while raw values are preserved. This is not percent BOLD, firing rate, number of active neurons or statistical significance. Negative values do not mean fear or selling.

The response trace is the mean absolute predicted value across surface vertices for each retained time point. The sizing statistic is the mean absolute difference between the last two time-ordered prediction rows. Both are simple descriptive statistics, not calibrated behavioral scores. The dashboard does not label brain regions as reward, pain or intention.

## The paper policy is a separate hypothesis

| Policy | Decision rule |
| --- | --- |
| Observer | Hold simulated cash; display market and model results |
| Momentum | Compare the current observed price with an observation at least 30 seconds earlier. Above +0.2%, target the exposure cap; below −0.2%, target zero; otherwise hold. |
| Cortical | Use the same market rule but scale positive exposure by `min(1, responseChange / 0.1)`. Require a valid, fresh TRIBE result first. |

The scale denominator `0.1`, momentum thresholds, 30-second cooldown, 1% equity rebalance threshold and default 25% exposure target are authored experimental settings. They have not been fitted to a neuroscience or financial validation set. They do not show that more response means greater confidence. The account is long-only, uses no leverage, and estimates costs with configured fees/slippage. Exposure can drift between rebalances.

Paper fills use approximate observed prices, not an executable quote or AMM simulation. This matters for illiquid tokens, taxes, large orders and graduation. The baseline's demo profits are consequences of a synthetic trajectory and are not performance evidence.

## How to turn this into stronger research

1. Freeze the renderer, model revisions, thresholds and reporting protocol before an evaluation period. Record these choices with every run.
2. Separate market information from presentation. Compare the same market window with chart-only, audio-only, neutral-direction language and the full rendering; use an explicitly versioned protocol for each condition.
3. Add controls: time-shuffled returns, constant-price displays and matched movement without financial language. Distinguish responses to visual motion and speech from anything specific to a market narrative.
4. Benchmark against observer, buy-and-hold and the independent momentum policy using identical event availability, costs and execution assumptions. Use untouched time periods and multiple tokens. Report all attempted policies, not just the best run.
5. Evaluate latency, stale-result frequency, turnover and drawdown alongside P/L. Include failed model jobs and RPC downtime in the report.
6. If making claims about actual human responses to financial risk, validate against a suitable independent human dataset or prospectively designed study. A model-generated surface alone cannot establish that connection.
7. If faster streaming is needed, study a causal or distilled alternative with its own validation. Do not merely change the released causal flag and call it equivalent to the original model.

These are proposed follow-on studies, not capabilities already validated by this package. Token demand, price appreciation and audience interest cannot be inferred from the existence of a brain visualization.

## Public description

Suggested copy:

> MetaTray turns token-market events into a sensory experience and visualizes a model's predicted cortical response. Follow the market, inspect the stimulus, and compare paper policies.

Avoid claims that MetaTray is a living human brain, feels losses, understands its token, has measured buyer emotions, proves a trading edge or is affiliated with Meta. The value of the project is the inspectable connection between public events, a declared stimulus, a real scientific model and a transparent experiment.

## Source and permission record

- [Meta's official TRIBE v2 repository](https://github.com/facebookresearch/tribev2)
- [Paper: A foundation model of vision, audition, and language for in-silico neuroscience](https://arxiv.org/abs/2605.04326)
- [Official checkpoint and model card](https://huggingface.co/facebook/tribev2)
- [Released configuration](https://huggingface.co/facebook/tribev2/blob/main/config.yaml)
- [Source license](https://github.com/facebookresearch/tribev2/blob/main/LICENSE)
- [Nilearn surface dataset interface](https://nilearn.github.io/stable/modules/generated/nilearn.datasets.fetch_surf_fsaverage.html)

The released code and checkpoint are noncommercial. A free public website is not automatically sufficient to establish that a token-promotional model use is permitted. No rights are granted by a setting or a statement in this repository. Keep actual permissions and any account identifiers outside public source.
