'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from './site-chrome';
import { FeedConsole } from './feed-console';
import { CorticalAtlas } from './cortical-atlas';
import { META_REPOSITORY, METATRAY_REPOSITORY, transactionUrl } from '@/lib/sources';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, ArrowRight, AudioLines, BookOpen, BrainCircuit, Check, ChevronRight, CircleDot,
  Download, ImageDown, Link as LinkIcon, Pause, Play, Radio, RotateCcw, Wallet, X } from 'lucide-react';
import { PriceChart, ResponseTrace } from './chart';
import { equity } from '@/lib/paper';
import type { MeshData, Policy, PredictionResult, Snapshot } from '@/lib/types';

const Cortex = dynamic(() => import('./cortex'), { ssr: false, loading: () => <div className="cortex-loading">Preparing the cortical view…</div> });
const money = (v: number, digits = 2) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const number = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 3, notation: v > 100000 ? 'compact' : 'standard' });
const short = (s: string) => s ? `${s.slice(0, 8)}…${s.slice(-4)}` : 'Synthetic';

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null); const [error, setError] = useState('');
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false); const [step, setStep] = useState(180);
  const [policy, setPolicy] = useState<Policy>('momentum');
  const [result, setResult] = useState<PredictionResult | null>(null); const [mesh, setMesh] = useState<MeshData | null>(null);
  const [selectedPredictionId, setSelectedPredictionId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [notice, setNotice] = useState('');
  const [heroView, setHeroView] = useState<'cortex' | 'stimulus' | 'receipt'>('cortex');
  const [announcement, setAnnouncement] = useState(true);
  const [range, setRange] = useState(150); const inflight = useRef(false); const latest = useRef({ step, policy });
  latest.current = { step, policy };
  const refresh = useCallback(async () => {
    if (inflight.current) return; inflight.current = true;
    try { const response = await fetch(`/api/snapshot?step=${latest.current.step}&policy=${latest.current.policy}`, { cache: 'no-store', signal: AbortSignal.timeout(25000) });
      const data = await response.json();
      if (data.mode && Array.isArray(data.ticks)) { setSnapshot(data); setReceivedAt(Date.now()); }
      if (!response.ok) throw new Error(data.message || data.error || 'Connection unavailable');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection unavailable'); }
    finally { inflight.current = false; }
  }, []);
  useEffect(() => { void refresh(); }, [refresh, policy]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('prediction');
    if (id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) setSelectedPredictionId(id);
  }, []);
  const pollMs = snapshot?.feed?.pollMs ?? 5000;
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => { if (!document.hidden) { setStep(s => s >= 1200 ? 180 : s + 1); void refresh(); } }, pollMs);
    return () => clearInterval(timer);
  }, [paused, refresh, pollMs]);
  const predictionId = selectedPredictionId ?? snapshot?.prediction?.id;
  useEffect(() => {
    setResult(null);
    if (!predictionId) { setResult(null); return; }
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/predictions/${predictionId}`, { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('Prediction no longer available'); return r.json(); }),
      fetch('/api/mesh', { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('Anatomical mesh unavailable'); return r.json(); })
    ]).then(([p, m]) => { setResult(p); setMesh(m); }).catch(e => {
      if (e.name !== 'AbortError') { setResult(null); setNotice(e.message); }
    });
    return () => controller.abort();
  }, [predictionId]);
  useEffect(() => {
    if (!selected) return;
    const prior = document.activeElement as HTMLElement | null;
    const close = document.querySelector<HTMLButtonElement>('[aria-label="Close event details"]');
    close?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key === 'Tab') {
        const items = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] a[href]')];
        const first = items[0]; const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); prior?.focus(); };
  }, [selected]);
  const exportSession = () => {
    if (!snapshot) return;
    const body = JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(),
      note: 'Paper simulation. Cortex is predicted, not measured. Demo events are synthetic.', snapshot, prediction: result }, null, 2);
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `metatray-${snapshot.mode}-receipt.json`; link.click(); URL.revokeObjectURL(url);
    setNotice('Session receipt exported.');
  };
  const copyPredictionLink = async () => {
    if (!result) return;
    const url = new URL(window.location.href); url.searchParams.set('prediction', result.id); url.hash = 'atlas';
    try { await navigator.clipboard.writeText(url.href); setNotice('Prediction link copied.'); }
    catch { setNotice('Copy unavailable. Use the prediction ID in the data receipt.'); }
  };
  const exportVisualReceipt = () => {
    if (!snapshot) return;
    const output = document.createElement('canvas'); output.width = 1200; output.height = 630;
    const ctx = output.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#09090c'; ctx.fillRect(0, 0, output.width, output.height);
    ctx.strokeStyle = '#2d2d35'; ctx.strokeRect(40, 40, 1120, 550);
    ctx.fillStyle = '#f3f3f7'; ctx.font = '600 52px sans-serif'; ctx.fillText('MetaTray', 78, 112);
    ctx.fillStyle = '#8d8d9d'; ctx.font = '18px monospace'; ctx.fillText(result ? 'META TRIBE v2 / PREDICTED fMRI RESPONSE' : 'LIVE MARKET INPUT / ILLUSTRATIVE PULSE', 80, 150);
    const brain = document.querySelector<HTMLCanvasElement>('.cortex-canvas canvas');
    if (brain) { try { ctx.drawImage(brain, 610, 85, 500, 360); } catch { /* metadata still exports */ } }
    ctx.fillStyle = '#e1e1e7'; ctx.font = '24px sans-serif'; ctx.fillText(`${snapshot.symbol} / ${snapshot.quoteSymbol}`, 80, 225);
    ctx.font = '17px monospace'; ctx.fillStyle = '#aaaab7';
    const lines = result ? [
      `INPUT END  ${new Date(result.inputEnd).toISOString()}`, `MODEL      ${result.modelRevision.slice(0, 32)}`,
      `STIMULUS   ${result.stimulusHash.slice(0, 32)}`, `OUTPUT     ${result.outputHash.slice(0, 32)}`,
      `VERTICES   ${result.vertexCount.toLocaleString('en-US')}`
    ] : [
      `CHAIN      ${snapshot.chainId ?? 'UNCONFIGURED'}`, `BLOCK      ${snapshot.indexedBlock ?? 'WAITING'}`,
      `TX         ${last?.txHash?.slice(0, 34) ?? 'NO EVENT RECEIVED'}`, 'CORTEX     NO MODEL OUTPUT'
    ];
    lines.forEach((line, index) => ctx.fillText(line, 80, 290 + index * 42));
    ctx.fillStyle = '#70dfbc'; ctx.font = '16px monospace'; ctx.fillText('VERIFY THE FULL RECEIPT IN THE METATRAY OBSERVATORY', 80, 555);
    output.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `metatray-${result ? 'cortical' : 'market'}-receipt.png`; link.click(); URL.revokeObjectURL(url); }, 'image/png');
    setNotice('Visual receipt exported.');
  };
  const last = snapshot?.ticks.at(-1); const first = snapshot?.ticks[0]; const price = last?.price ?? 0;
  const change = first && last ? (last.price / first.price - 1) * 100 : 0;
  const accountValue = snapshot ? equity(snapshot.paper, price) : 0;
  const pnl = snapshot ? accountValue - snapshot.paperConfig.initialQuote : 0;
  const predictionAge = result ? Math.max(0, Math.round((Date.now() - result.inputEnd) / 1000)) : null;
  const modelFresh = !paused && !error && predictionAge !== null && snapshot?.connected && !snapshot.stale && predictionAge * 1000 <= snapshot.paperConfig.maxPredictionAgeMs;
  const ticks = snapshot?.ticks ?? []; const volume = ticks.reduce((sum, t) => sum + t.quoteAmount, 0);
  const buyVolume = ticks.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.quoteAmount, 0);
  const quote = snapshot?.quoteSymbol ?? 'QUOTE'; const demo = snapshot?.mode === 'demo';
  const liveInput = !demo && !!snapshot?.connected && !snapshot.stale && !error && !paused && !!last?.txHash;
  const activePolicy = snapshot?.paperConfig.policy ?? policy;
  const selectedTick = ticks.find(t => t.id === selected);
  const openObservatory = () => {
    requestAnimationFrame(() => document.getElementById('observatory')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    }));
  };
  return <div className="site-root">
    <a href="#main-content" className="skip-link">Skip to content</a>
    {announcement ? <div className="announcement"><span>Introducing MetaTray. A cortical market experiment.</span><Link href="/experiment">Open Experiment 001 <ArrowRight size={14}/></Link><button className="announcement-close" aria-label="Dismiss announcement" onClick={() => setAnnouncement(false)}><X size={16}/></button></div> : null}
    <div className="app-shell">
    <SiteHeader active="observatory" status={!snapshot ? 'CONNECTING' : demo ? 'DEMO' : paused ? 'VIEW PAUSED' : snapshot.connected && !error ? 'ON-CHAIN' : snapshot.feed?.phase === 'setup' ? 'SETUP REQUIRED' : 'DISCONNECTED'} warning={!!error || !!snapshot?.stale}/>
    <main id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="research-badge"><span>EXPERIMENT 001</span><i/><span>TRIBE v2</span></div>
            <h1>Token markets.<br/>Cortical responses.</h1>
            <p>MetaTray turns token-market observations into sensory inputs for Meta’s TRIBE v2 cortical-response model. Explore the market, the stimulus, and the resulting experiment.</p>
            <div className="hero-actions"><button className="primary-button" onClick={openObservatory}>Open observatory <ArrowRight size={17}/></button><Link className="bracket-button" href="/science">The science <ArrowUpRight size={16}/></Link></div>
            <div className="hero-note">Real market input. Separately produced and validated model output. Paper only.</div><div className="hero-source-links"><Link href="/lore">Enter the lore</Link><a href={METATRAY_REPOSITORY} target="_blank" rel="noreferrer">MetaTray on GitHub <ArrowUpRight size={13}/></a><a href={META_REPOSITORY} target="_blank" rel="noreferrer">Meta TRIBE v2 <ArrowUpRight size={13}/></a><Link href="/evidence">Code & evidence</Link></div>
            <button className="feature-callout" onClick={() => setHeroView('receipt')}><span className="eyebrow">UNDER THE SURFACE</span><strong>Every response has a receipt. <ArrowUpRight size={16}/></strong><span>Inspect the input, model version, and processing delay.</span></button>
          </div>
          <div className="hero-product">
            <article className="instrument-panel" aria-label="Interactive cortical observatory">
              <div className="instrument-heading"><div className="instrument-tabs" role="tablist" aria-label="Cortical viewer tabs">{(['cortex', 'stimulus', 'receipt'] as const).map(v => <button key={v} id={`tab-${v}`} role="tab" aria-selected={heroView === v} aria-controls={`panel-${v}`} tabIndex={heroView === v ? 0 : -1} onClick={() => setHeroView(v)} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const views = ['cortex', 'stimulus', 'receipt'] as const; const next = views[(views.indexOf(v) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setHeroView(next); requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus()); } }}>{v === 'cortex' ? '3D cortex' : v === 'stimulus' ? 'Stimulus' : 'Receipt'}</button>)}</div><span className={`small-tag ${modelFresh ? 'mint' : ''}`}>{result ? modelFresh ? 'MODEL OUTPUT' : 'DELAYED OUTPUT' : liveInput ? 'MARKET INPUT' : 'NO PREDICTION'}</span></div>
              <div id={`panel-${heroView}`} className="instrument-body" role="tabpanel" aria-labelledby={`tab-${heroView}`}>
                {heroView === 'cortex' ? <Cortex result={result} mesh={mesh} tick={last} ticks={ticks.slice(-8)} quote={quote} liveInput={liveInput}/> : heroView === 'stimulus' ? <div className="hero-stimulus"><span className="eyebrow"><AudioLines size={14}/> THE SENSORY INPUT</span><h2>What the model receives.</h2><p>{snapshot?.stimulus.text ?? 'Waiting for market observations…'}</p><div className="stimulus-format"><span>01 / Market-screen video</span><span>02 / Trade tones + spoken context</span></div><small>{demo ? 'Input preview. No model inference in demo mode.' : 'Preview of current context. Exact model input is retained in each job receipt.'}</small></div> : <div className="hero-receipt"><span className="eyebrow"><BookOpen size={14}/> A RESULT YOU CAN TRACE</span><h2>The prediction receipt.</h2><dl><div><dt>Market source</dt><dd>{demo ? 'Synthetic replay' : 'On-chain observations'}</dd></div><div><dt>Model result</dt><dd>{result ? 'TRIBE v2' : 'Awaiting model service'}</dd></div><div><dt>Input age</dt><dd>{predictionAge !== null ? `${predictionAge} seconds` : 'No result yet'}</dd></div><div><dt>Model revision</dt><dd>{result ? result.modelRevision.slice(0, 16) : 'Not connected'}</dd></div></dl><button className="text-button" onClick={exportSession} disabled={!snapshot}>Download session receipt <Download size={14}/></button><small>{result ? 'Full provenance and hashes are included in the export.' : 'The model has not produced a result for this session.'}</small></div>}
              </div>
              <div className="cortex-caption"><div><span className="small-square"/>{result ? 'Predicted fMRI response · averaged subject' : liveInput ? 'Real trade pulses · illustrative mapping, not Meta output' : 'Illustrative geometry · waiting for a live connection'}</div><span>TRIBE v2</span></div>
              <div className="response-footer"><div><span className="label">RESPONSE TRACE</span><ResponseTrace values={result?.responseTrace}/></div><div className="response-age"><span className="label">INPUT AGE</span><strong>{predictionAge !== null ? `${predictionAge}s` : '—'}</strong><small>{result ? `${(result.latencyMs / 1000).toFixed(1)}s processing` : 'No samples yet'}</small></div></div>
              <div className="model-status-line"><span>{snapshot?.inferenceStatus ?? 'Waiting for service status'}</span><span>{snapshot?.jobs.running ?? 0} running · {snapshot?.jobs.queued ?? 0} queued{snapshot?.jobs.failed ? ` · ${snapshot.jobs.failed} failed` : ''}</span></div>
            </article>
            <div className="event-preview"><div className="event-preview-heading"><span><Radio size={13}/> Market events</span><span>{demo ? 'SYNTHETIC REPLAY' : 'ON-CHAIN FEED'}</span></div>{ticks.slice(-2).reverse().map(t => <button key={t.id} onClick={() => setSelected(t.id)} className="preview-event"><span className={`trade-side ${t.side}`}>{t.side === 'buy' ? <ArrowDownLeft size={12}/> : <ArrowUpRight size={12}/>} {t.side.toUpperCase()}</span><span>{number(t.quoteAmount)} <small>{quote}</small></span><span>{new Date(t.ts).toLocaleTimeString('en-GB')}</span><ChevronRight size={13}/></button>)}{!ticks.length ? <p>Waiting for observed trades.</p> : null}</div>
          </div>
        </section>
        <FeedConsole snapshot={snapshot} error={error} paused={paused} receivedAt={receivedAt} onRefresh={() => void refresh()} onSelect={setSelected}/>
        <div className="research-strip"><p>Market data meets a model of human response.</p><div><span><Radio size={22}/><b>Pons</b><small>MARKET ADAPTER</small></span><span><BrainCircuit size={25}/><b>Meta TRIBE v2</b><small>MODEL INTEGRATION</small></span><span><Wallet size={22}/><b>Paper only</b><small>TRADING MODE</small></span></div></div>
        <section className="lore-sequence" aria-labelledby="lore-sequence-title"><div className="lore-sequence-heading"><span className="section-kicker">[ The first on-chain cortical chronicle ]</span><h2 id="lore-sequence-title">The chain writes the stimulus.</h2><p>Live market input now. Asynchronous model output next. A verifiable experimental record over time.</p></div><div className="lore-steps"><article><span>01 · THE PULSE</span><Radio size={22}/><h3>A confirmed trade enters.</h3><p>The immediate 3D pulse identifies a real market input and carries its transaction receipt.</p></article><article><span>02 · THE EPOCH</span><AudioLines size={22}/><h3>The window becomes experience.</h3><p>Chart motion, trade tones and factual narration form the bounded input to the model.</p></article><article><span>03 · THE CHRONICLE</span><BrainCircuit size={22}/><h3>The Cortical Echo is archived.</h3><p>A validated surface joins the history with its stimulus, model and output hashes.</p></article></div><Link href="/lore">Enter the complete lore <ArrowUpRight size={14}/></Link></section>
        <section className="observatory-intro" id="observatory"><span className="section-kicker">[ Observatory ]</span><h2>Follow the experiment.</h2><p>The market, the sensory input, and MetaTray’s paper decisions.</p><div className="observatory-actions"><button className="secondary-button" onClick={exportSession} disabled={!snapshot}><Download size={14}/> Data receipt</button><button className="secondary-button" onClick={exportVisualReceipt} disabled={!snapshot}><ImageDown size={14}/> Visual receipt</button><button className="secondary-button" onClick={() => void copyPredictionLink()} disabled={!result}><LinkIcon size={14}/> Copy result link</button></div></section>
        <div className={`mode-banner ${error ? 'error-banner' : ''}`} role="status"><div><Radio size={15}/><span>{error || (demo ? 'Synthetic market replay' : snapshot?.stale ? 'Chain feed is stale' : 'Following on-chain market events')}</span><small>{error ? snapshot?.feed?.phase === 'setup' ? 'Required variable names are listed in the live input stream.' : 'Last received values may be stale.' : demo ? 'Demo prices. No model predictions. No real funds.' : snapshot?.message}</small></div><Link href="/deployment">{demo ? 'Connect live services' : 'Service setup'}<ChevronRight size={15}/></Link></div>
        <section className="stats-grid" aria-label="Market and paper account statistics">
          <Stat label={`${snapshot?.symbol ?? 'METATRAY'} / ${quote}`} value={price ? price.toFixed(6) : '—'} detail={`${change >= 0 ? '+' : ''}${change.toFixed(2)}% in displayed history`} positive={change >= 0} icon={<CircleDot size={16}/>}/>
          <Stat label="OBSERVED VOLUME" value={number(volume)} detail={`${quote} · ${ticks.length} displayed trades`} icon={<Activity size={16}/>}/>
          <Stat label="PAPER EQUITY" value={money(accountValue)} detail={`${quote} · simulated account`} icon={<Wallet size={16}/>}/>
          <Stat label="PAPER RETURN" value={`${pnl >= 0 ? '+' : ''}${money(pnl)}`} detail={`${snapshot ? (pnl / snapshot.paperConfig.initialQuote * 100).toFixed(2) : '0.00'}% after simulated costs`} positive={pnl >= 0} icon={<ArrowUpRight size={16}/>}/>
        </section>
        <section className="observatory-grid">
          <article className="panel market-panel"><div className="panel-heading"><div><span className="panel-icon"><Activity size={15}/></span><h2>The market</h2></div><div className="range-control">{[75, 150, 300].map(r => <button key={r} onClick={() => setRange(r)} className={range === r ? 'selected' : ''}>{r === 300 ? 'ALL' : `${r} TX`}</button>)}</div></div>
              <div className="market-price">{price ? price.toFixed(6) : '—'}<small>{quote}</small><span className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span></div>
              <PriceChart ticks={ticks.slice(-range)}/><div className="flow-labels"><span>Buy flow <b>{volume ? Math.round(buyVolume / volume * 100) : 0}%</b></span><span>Sell flow <b>{volume ? Math.round((1 - buyVolume / volume) * 100) : 0}%</b></span></div><div className="flow-bar"><span style={{ width: `${volume ? buyVolume / volume * 100 : 50}%` }}/></div>
            </article>
          <article className="panel stimulus-panel"><div className="panel-heading"><div><span className="panel-icon"><AudioLines size={15}/></span><h2>What MetaTray receives</h2></div><span className="small-tag">MARKET → STIMULUS</span></div><p className="stimulus-copy">{snapshot?.stimulus.text ?? 'Waiting for the market feed…'}</p><div className="stimulus-bottom"><span><span className="tiny-dot"/> Factual language + market-screen video</span><small>{demo ? 'Preview only' : 'GPU worker renders input'}</small></div></article>
        </section>
        <section className="lower-grid">
          <article className="panel trades-panel"><div className="panel-heading"><div><span className="panel-icon"><Radio size={15}/></span><h2>Market activity</h2><span className="count">{ticks.length}</span></div><button className="text-button" onClick={() => setPaused(p => !p)}>{paused ? <Play size={13}/> : <Pause size={13}/>} {paused ? 'Resume view' : 'Pause view'}</button></div>
            <div className="table-scroll"><table><thead><tr><th>TIME</th><th>SIDE</th><th>VALUE / {quote}</th><th>PRICE</th><th>SOURCE</th></tr></thead><tbody>{ticks.slice(-8).reverse().map(t => <tr key={t.id} onClick={() => setSelected(t.id)}><td><button className="trade-inspect-button" type="button" aria-haspopup="dialog" aria-label={`Inspect ${t.side} at ${t.price}`} onClick={event => { event.stopPropagation(); setSelected(t.id); }}>{new Date(t.ts).toLocaleTimeString('en-GB')}</button></td><td><span className={`trade-side ${t.side}`}>{t.side === 'buy' ? <ArrowDownLeft size={12}/> : <ArrowUpRight size={12}/>} {t.side.toUpperCase()}</span></td><td>{number(t.quoteAmount)}</td><td>{t.price.toFixed(6)}</td><td className="muted">{demo ? 'DEMO' : short(t.txHash)}</td></tr>)}</tbody></table>{!ticks.length ? <p className="empty-copy">Real swaps appear here after the configured RPC or indexer receives events.</p> : null}</div>
          </article>
          <article className="panel account-panel"><div className="panel-heading"><div><span className="panel-icon"><Wallet size={15}/></span><h2>MetaTray’s paper account</h2></div><span className="small-tag">SIMULATION</span></div>
            <div className="account-rows"><div><span>Cash balance</span><strong>{money(snapshot?.paper.cash ?? 0)} <small>{quote}</small></strong></div><div><span>Token position</span><strong>{number(snapshot?.paper.units ?? 0)} <small>{snapshot?.symbol ?? 'TOKEN'}</small></strong></div><div><span>Realized P/L</span><strong>{money(snapshot?.paper.realizedPnl ?? 0)}</strong></div><div><span>Simulated fees</span><strong>{money(snapshot?.paper.totalFees ?? 0)}</strong></div></div>
            <label className="policy-label" htmlFor="policy">ACTIVE POLICY</label><select id="policy" value={activePolicy} disabled={!demo} onChange={e => { setPolicy(e.target.value as Policy); latest.current.policy = e.target.value as Policy; }}><option value="observer">Observer · holds cash</option><option value="momentum">Momentum · comparison baseline</option><option value="cortical">Cortical · waits for model output</option></select>
            <p className="policy-note">{activePolicy === 'cortical' ? 'Uses fresh predicted-response changes for position sizing. This authored rule is not a validated financial model.' : activePolicy === 'observer' ? 'Observes the market and maintains a cash-only paper account.' : 'A 30-second momentum baseline. Its decisions do not use cortical activity.'}</p>
            {demo ? <button className="text-button reset-demo" onClick={() => { latest.current.step = 180; setStep(180); void refresh(); }}><RotateCcw size={13}/> Reset replay</button> : <p className="policy-note">Change the policy in the worker configuration, with a fresh paper account.</p>}
          </article>
        </section>
        <section className="panel ledger-panel"><div className="panel-heading"><div><span className="panel-icon"><BookOpen size={15}/></span><h2>Paper decisions</h2></div><span className="label">SIMULATED FILLS · NO ORDERS SENT</span></div><div className="ledger-items">{snapshot?.paper.fills.length ? snapshot.paper.fills.slice(-4).reverse().map(f => <div className="ledger-item" key={f.id}><span className={`trade-side ${f.side}`}>{f.side.toUpperCase()}</span><div><strong>{number(f.quantity)} {snapshot?.symbol ?? 'TOKEN'} at {f.price.toFixed(6)}</strong><small>{f.reason}</small></div><span>{new Date(f.ts).toLocaleTimeString('en-GB')}</span></div>) : <p className="empty-copy">No paper decisions. Observer mode holds cash; cortical mode requires a fresh model prediction.</p>}</div></section>
        <div id="atlas"><CorticalAtlas epochs={snapshot?.epochs ?? []} currentId={predictionId ?? null} quote={quote} onSelect={id => { setSelectedPredictionId(id); setHeroView('cortex'); requestAnimationFrame(() => document.querySelector('.instrument-panel')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })); }}/></div>
        {result ? <details className="panel prediction-receipt"><summary>Inspect the cortical prediction receipt</summary><p>Teal: positive model values. Amber: negative values. Fixed scale: −2 to +2 normalized model units. The trace shows mean absolute response across surface vertices.</p><p>Input cutoff: {new Date(result.inputEnd).toISOString()} · Published: {new Date(result.availableAt).toISOString()}</p><pre>{JSON.stringify(result.manifest, null, 2)}</pre></details> : null}
        <section className="faq-section"><div><span className="section-kicker">[ Questions ]</span><h2>A closer look<br/>at MetaTray.</h2><p>Understand what you’re watching.</p></div><div className="faq-items">{[
          ['Is this a real human brain?', 'MetaTray uses a model that predicts cortical fMRI responses to audiovisual stimuli. It is not a living brain, a human connectome, or a recording from an individual.'],
          ['What changes when someone trades?', 'Configured chain events change the observed market data. The worker turns a recorded window into a sensory stimulus, and a completed model result updates the cortical surface. Processing is asynchronous.'],
          ['Does MetaTray trade real money?', 'No. The account and its fills are simulated. The observer, momentum, and cortical policies can be compared without signing or sending financial transactions.'],
          ['Why am I seeing a schematic?', 'Real buys and sells drive labelled market-input pulses on illustrative geometry. Actual Meta cortical values appear only after the configured TRIBE worker produces a result. Neither a spinning camera nor a market pulse proves model inference.']
        ].map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className="explore-pages" aria-label="Learn about MetaTray"><div><span className="section-kicker">[ Inside MetaTray ]</span><h2>Understand the experiment.</h2></div><div className="explore-grid">{[
        ['/experiment', '01', 'Experiment 001', 'The live Pons input, sensory translation, cortical echo, and proof.'],
        ['/about', '02', 'About MetaTray', 'The idea, the experience, and the boundaries.'],
        ['/science', '03', 'The Meta model', 'Inputs, cortical output, timing, and original sources.'],
        ['/how-it-works', '04', 'From trade to response', 'Follow the data through each stage of the system.'],
        ['/lore', '05', 'The lore', 'The Silence, the Pulse, the Cortical Echo, and the Chronicle.']
      ].map(([href, index, title, description]) => <Link href={href} key={href}><span>{index}<ArrowUpRight size={16}/></span><h3>{title}</h3><p>{description}</p></Link>)}</div><p className="explore-legal">Read the <Link href="/terms">terms of use</Link> and <Link href="/privacy">privacy notice</Link>. Paper trading is simulated; model output is experimental.</p></section>
      <SiteFooter mode={demo ? 'demo' : 'live'}/>
    </main>
    {notice ? <div className="toast" role="status"><Check size={15}/>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15}/></button></div> : null}
    {selectedTick ? <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="event-modal" role="dialog" aria-modal="true" aria-label="Market event details" onClick={e => e.stopPropagation()}><div className="panel-heading"><h2>Event receipt</h2><button className="icon-button" aria-label="Close event details" onClick={() => setSelected(null)}><X size={18}/></button></div><p>{demo ? 'Synthetic demonstration event. It has no blockchain transaction.' : 'Public chain event. No participant identity is inferred.'}</p>{transactionUrl(snapshot?.feed?.explorer, selectedTick.txHash) ? <a className="text-button" href={transactionUrl(snapshot?.feed?.explorer, selectedTick.txHash)!} target="_blank" rel="noreferrer">Verify transaction on explorer <ArrowUpRight size={14}/></a> : null}<pre>{JSON.stringify(selectedTick, null, 2)}</pre></section></div> : null}
    </div>
  </div>;
}

function Stat({ label, value, detail, positive, icon }: { label: string; value: string; detail: string; positive?: boolean; icon: React.ReactNode }) {
  return <article className="stat"><div className="stat-label">{label}{icon}</div><strong>{value}</strong><small className={positive === undefined ? '' : positive ? 'up' : 'down'}>{detail}</small></article>;
}
