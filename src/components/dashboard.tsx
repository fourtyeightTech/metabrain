'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from './site-chrome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, ArrowRight, AudioLines, BookOpen, BrainCircuit, Check, ChevronRight, CircleDot,
  Download, Pause, Play, Radio, RotateCcw, Wallet, X } from 'lucide-react';
import { PriceChart, ResponseTrace } from './chart';
import { equity } from '@/lib/paper';
import type { MeshData, Policy, PredictionResult, Snapshot } from '@/lib/types';

const Cortex = dynamic(() => import('./cortex'), { ssr: false, loading: () => <div className="cortex-loading">Preparing the cortical view…</div> });
const money = (v: number, digits = 2) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const number = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 3, notation: v > 100000 ? 'compact' : 'standard' });
const short = (s: string) => s ? `${s.slice(0, 8)}…${s.slice(-4)}` : 'Synthetic';

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null); const [error, setError] = useState('');
  const [paused, setPaused] = useState(false); const [step, setStep] = useState(180);
  const [policy, setPolicy] = useState<Policy>('momentum');
  const [result, setResult] = useState<PredictionResult | null>(null); const [mesh, setMesh] = useState<MeshData | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [notice, setNotice] = useState('');
  const [heroView, setHeroView] = useState<'cortex' | 'stimulus' | 'receipt'>('cortex');
  const [announcement, setAnnouncement] = useState(true);
  const [range, setRange] = useState(150); const inflight = useRef(false); const latest = useRef({ step, policy });
  latest.current = { step, policy };
  const refresh = useCallback(async () => {
    if (inflight.current) return; inflight.current = true;
    try { const response = await fetch(`/api/snapshot?step=${latest.current.step}&policy=${latest.current.policy}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Connection unavailable');
      setSnapshot(data); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection unavailable'); }
    finally { inflight.current = false; }
  }, []);
  useEffect(() => { void refresh(); }, [refresh, policy]);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => { if (!document.hidden) { setStep(s => s >= 1200 ? 180 : s + 1); void refresh(); } }, 2000);
    return () => clearInterval(timer);
  }, [paused, refresh]);
  const predictionId = snapshot?.prediction?.id;
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
      if (event.key === 'Tab') { event.preventDefault(); close?.focus(); }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); prior?.focus(); };
  }, [selected]);
  const exportSession = () => {
    if (!snapshot) return;
    const body = JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(),
      note: 'Paper simulation. Cortex is predicted, not measured. Demo events are synthetic.', snapshot, prediction: result }, null, 2);
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `tray-${snapshot.mode}-receipt.json`; link.click(); URL.revokeObjectURL(url);
    setNotice('Session receipt exported.');
  };
  const last = snapshot?.ticks.at(-1); const first = snapshot?.ticks[0]; const price = last?.price ?? 0;
  const change = first && last ? (last.price / first.price - 1) * 100 : 0;
  const accountValue = snapshot ? equity(snapshot.paper, price) : 0;
  const pnl = snapshot ? accountValue - snapshot.paperConfig.initialQuote : 0;
  const predictionAge = snapshot?.prediction ? Math.max(0, Math.round((Date.now() - snapshot.prediction.inputEnd) / 1000)) : null;
  const modelFresh = predictionAge !== null && snapshot && predictionAge * 1000 <= snapshot.paperConfig.maxPredictionAgeMs;
  const ticks = snapshot?.ticks ?? []; const volume = ticks.reduce((sum, t) => sum + t.quoteAmount, 0);
  const buyVolume = ticks.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.quoteAmount, 0);
  const quote = snapshot?.quoteSymbol ?? 'QUOTE'; const demo = snapshot?.mode !== 'live';
  const activePolicy = snapshot?.paperConfig.policy ?? policy;
  const selectedTick = ticks.find(t => t.id === selected);
  const openObservatory = () => {
    requestAnimationFrame(() => document.getElementById('observatory')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    }));
  };
  return <div className="site-root">
    <a href="#main-content" className="skip-link">Skip to content</a>
    {announcement ? <div className="announcement"><span>Introducing Tray. A cortical market experiment.</span><Link href="/science">Explore the science <ArrowRight size={14}/></Link><button className="announcement-close" aria-label="Dismiss announcement" onClick={() => setAnnouncement(false)}><X size={16}/></button></div> : null}
    <div className="app-shell">
    <SiteHeader active="observatory" status={demo ? 'DEMO' : 'ON-CHAIN'} warning={!!error || !!snapshot?.stale}/>
    <main id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="research-badge"><span>EXPERIMENT 001</span><i/><span>TRIBE v2</span></div>
            <h1>Token markets.<br/>Cortical responses.</h1>
            <p>Tray turns token-market observations into sensory inputs for Meta’s TRIBE v2 cortical-response model. Explore the market, the stimulus, and the resulting experiment.</p>
            <div className="hero-actions"><button className="primary-button" onClick={openObservatory}>Open observatory <ArrowRight size={17}/></button><Link className="bracket-button" href="/science">The science <ArrowUpRight size={16}/></Link></div>
            <div className="hero-note">Paper trading only. Predicted cortical activity.</div>
            <button className="feature-callout" onClick={() => setHeroView('receipt')}><span className="eyebrow">UNDER THE SURFACE</span><strong>Every response has a receipt. <ArrowUpRight size={16}/></strong><span>Inspect the input, model version, and processing delay.</span></button>
          </div>
          <div className="hero-product">
            <article className="instrument-panel" aria-label="Interactive cortical observatory">
              <div className="instrument-heading"><div className="instrument-tabs" role="tablist" aria-label="Cortical viewer tabs">{(['cortex', 'stimulus', 'receipt'] as const).map(v => <button key={v} id={`tab-${v}`} role="tab" aria-selected={heroView === v} aria-controls={`panel-${v}`} tabIndex={heroView === v ? 0 : -1} onClick={() => setHeroView(v)} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const views = ['cortex', 'stimulus', 'receipt'] as const; const next = views[(views.indexOf(v) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setHeroView(next); requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus()); } }}>{v === 'cortex' ? '3D cortex' : v === 'stimulus' ? 'Stimulus' : 'Receipt'}</button>)}</div><span className={`small-tag ${modelFresh ? 'mint' : ''}`}>{result ? modelFresh ? 'MODEL OUTPUT' : 'DELAYED OUTPUT' : 'NO PREDICTION'}</span></div>
              <div id={`panel-${heroView}`} className="instrument-body" role="tabpanel" aria-labelledby={`tab-${heroView}`}>
                {heroView === 'cortex' ? <Cortex result={result} mesh={mesh}/> : heroView === 'stimulus' ? <div className="hero-stimulus"><span className="eyebrow"><AudioLines size={14}/> THE SENSORY INPUT</span><h2>What the model receives.</h2><p>{snapshot?.stimulus.text ?? 'Waiting for market observations…'}</p><div className="stimulus-format"><span>01 / Market-screen video</span><span>02 / Trade tones + spoken context</span></div><small>{demo ? 'Input preview. No model inference in demo mode.' : 'Preview of current context. Exact model input is retained in each job receipt.'}</small></div> : <div className="hero-receipt"><span className="eyebrow"><BookOpen size={14}/> A RESULT YOU CAN TRACE</span><h2>The prediction receipt.</h2><dl><div><dt>Market source</dt><dd>{demo ? 'Synthetic replay' : 'On-chain observations'}</dd></div><div><dt>Model result</dt><dd>{result ? 'TRIBE v2' : 'Awaiting model service'}</dd></div><div><dt>Input age</dt><dd>{predictionAge !== null ? `${predictionAge} seconds` : 'No result yet'}</dd></div><div><dt>Model revision</dt><dd>{result ? result.modelRevision.slice(0, 16) : 'Not connected'}</dd></div></dl><button className="text-button" onClick={exportSession} disabled={!snapshot}>Download session receipt <Download size={14}/></button><small>{result ? 'Full provenance and hashes are included in the export.' : 'The model has not produced a result for this session.'}</small></div>}
              </div>
              <div className="cortex-caption"><div><span className="small-square"/>{result ? 'Predicted fMRI response · averaged subject' : 'Illustrative geometry · not neural activity'}</div><span>TRIBE v2</span></div>
              <div className="response-footer"><div><span className="label">RESPONSE TRACE</span><ResponseTrace values={result?.responseTrace}/></div><div className="response-age"><span className="label">INPUT AGE</span><strong>{predictionAge !== null ? `${predictionAge}s` : '—'}</strong><small>{result ? `${(result.latencyMs / 1000).toFixed(1)}s processing` : 'No samples yet'}</small></div></div>
              <div className="model-status-line"><span>{snapshot?.inferenceStatus ?? 'Waiting for service status'}</span><span>{snapshot?.jobs.running ?? 0} running · {snapshot?.jobs.queued ?? 0} queued{snapshot?.jobs.failed ? ` · ${snapshot.jobs.failed} failed` : ''}</span></div>
            </article>
            <div className="event-preview"><div className="event-preview-heading"><span><Radio size={13}/> Market events</span><span>{demo ? 'SYNTHETIC REPLAY' : 'ON-CHAIN FEED'}</span></div>{ticks.slice(-2).reverse().map(t => <button key={t.id} onClick={() => setSelected(t.id)} className="preview-event"><span className={`trade-side ${t.side}`}>{t.side === 'buy' ? <ArrowDownLeft size={12}/> : <ArrowUpRight size={12}/>} {t.side.toUpperCase()}</span><span>{number(t.quoteAmount)} <small>{quote}</small></span><span>{new Date(t.ts).toLocaleTimeString('en-GB')}</span><ChevronRight size={13}/></button>)}{!ticks.length ? <p>Waiting for observed trades.</p> : null}</div>
          </div>
        </section>
        <div className="research-strip"><p>Market data meets a model of human response.</p><div><span><Radio size={22}/><b>Pons</b><small>MARKET ADAPTER</small></span><span><BrainCircuit size={25}/><b>Meta TRIBE v2</b><small>MODEL INTEGRATION</small></span><span><Wallet size={22}/><b>Paper only</b><small>TRADING MODE</small></span></div></div>
        <section className="observatory-intro" id="observatory"><span className="section-kicker">[ Observatory ]</span><h2>Follow the experiment.</h2><p>The market, the sensory input, and Tray’s paper decisions.</p><button className="secondary-button" onClick={exportSession} disabled={!snapshot}><Download size={14}/> Export receipt</button></section>
        <div className={`mode-banner ${error ? 'error-banner' : ''}`} role="status"><div><Radio size={15}/><span>{error || (demo ? 'Synthetic market replay' : snapshot?.stale ? 'Chain feed is stale' : 'Following on-chain market events')}</span><small>{error ? 'Last received values may be stale.' : demo ? 'Demo prices. No model predictions. No real funds.' : snapshot?.message}</small></div><Link href="/deployment">{demo ? 'Connect live services' : 'Service setup'}<ChevronRight size={15}/></Link></div>
        <section className="stats-grid" aria-label="Market and paper account statistics">
          <Stat label={`${snapshot?.symbol ?? 'TRAY'} / ${quote}`} value={price ? price.toFixed(6) : '—'} detail={`${change >= 0 ? '+' : ''}${change.toFixed(2)}% in displayed history`} positive={change >= 0} icon={<CircleDot size={16}/>}/>
          <Stat label="OBSERVED VOLUME" value={number(volume)} detail={`${quote} · ${ticks.length} displayed trades`} icon={<Activity size={16}/>}/>
          <Stat label="PAPER EQUITY" value={money(accountValue)} detail={`${quote} · simulated account`} icon={<Wallet size={16}/>}/>
          <Stat label="PAPER RETURN" value={`${pnl >= 0 ? '+' : ''}${money(pnl)}`} detail={`${snapshot ? (pnl / snapshot.paperConfig.initialQuote * 100).toFixed(2) : '0.00'}% after simulated costs`} positive={pnl >= 0} icon={<ArrowUpRight size={16}/>}/>
        </section>
        <section className="observatory-grid">
          <article className="panel market-panel"><div className="panel-heading"><div><span className="panel-icon"><Activity size={15}/></span><h2>The market</h2></div><div className="range-control">{[75, 150, 300].map(r => <button key={r} onClick={() => setRange(r)} className={range === r ? 'selected' : ''}>{r === 300 ? 'ALL' : `${r} TX`}</button>)}</div></div>
              <div className="market-price">{price ? price.toFixed(6) : '—'}<small>{quote}</small><span className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span></div>
              <PriceChart ticks={ticks.slice(-range)}/><div className="flow-labels"><span>Buy flow <b>{volume ? Math.round(buyVolume / volume * 100) : 0}%</b></span><span>Sell flow <b>{volume ? Math.round((1 - buyVolume / volume) * 100) : 0}%</b></span></div><div className="flow-bar"><span style={{ width: `${volume ? buyVolume / volume * 100 : 50}%` }}/></div>
            </article>
          <article className="panel stimulus-panel"><div className="panel-heading"><div><span className="panel-icon"><AudioLines size={15}/></span><h2>What Tray receives</h2></div><span className="small-tag">MARKET → STIMULUS</span></div><p className="stimulus-copy">{snapshot?.stimulus.text ?? 'Waiting for the market feed…'}</p><div className="stimulus-bottom"><span><span className="tiny-dot"/> Factual language + market-screen video</span><small>{demo ? 'Preview only' : 'GPU worker renders input'}</small></div></article>
        </section>
        <section className="lower-grid">
          <article className="panel trades-panel"><div className="panel-heading"><div><span className="panel-icon"><Radio size={15}/></span><h2>Market activity</h2><span className="count">{ticks.length}</span></div><button className="text-button" onClick={() => setPaused(p => !p)}>{paused ? <Play size={13}/> : <Pause size={13}/>} {paused ? 'Resume view' : 'Pause view'}</button></div>
            <div className="table-scroll"><table><thead><tr><th>TIME</th><th>SIDE</th><th>VALUE / {quote}</th><th>PRICE</th><th>SOURCE</th></tr></thead><tbody>{ticks.slice(-8).reverse().map(t => <tr key={t.id} tabIndex={0} onClick={() => setSelected(t.id)} onKeyDown={e => { if (e.key === 'Enter') setSelected(t.id); }} aria-label={`Inspect ${t.side} at ${t.price}`}><td>{new Date(t.ts).toLocaleTimeString('en-GB')}</td><td><span className={`trade-side ${t.side}`}>{t.side === 'buy' ? <ArrowDownLeft size={12}/> : <ArrowUpRight size={12}/>} {t.side.toUpperCase()}</span></td><td>{number(t.quoteAmount)}</td><td>{t.price.toFixed(6)}</td><td className="muted">{demo ? 'DEMO' : short(t.txHash)}</td></tr>)}</tbody></table>{!ticks.length ? <p className="empty-copy">Trades appear here when the indexer receives events.</p> : null}</div>
          </article>
          <article className="panel account-panel"><div className="panel-heading"><div><span className="panel-icon"><Wallet size={15}/></span><h2>Tray’s paper account</h2></div><span className="small-tag">SIMULATION</span></div>
            <div className="account-rows"><div><span>Cash balance</span><strong>{money(snapshot?.paper.cash ?? 0)} <small>{quote}</small></strong></div><div><span>Token position</span><strong>{number(snapshot?.paper.units ?? 0)} <small>TRAY</small></strong></div><div><span>Realized P/L</span><strong>{money(snapshot?.paper.realizedPnl ?? 0)}</strong></div><div><span>Simulated fees</span><strong>{money(snapshot?.paper.totalFees ?? 0)}</strong></div></div>
            <label className="policy-label" htmlFor="policy">ACTIVE POLICY</label><select id="policy" value={activePolicy} disabled={!demo} onChange={e => { setPolicy(e.target.value as Policy); latest.current.policy = e.target.value as Policy; }}><option value="observer">Observer · holds cash</option><option value="momentum">Momentum · comparison baseline</option><option value="cortical">Cortical · waits for model output</option></select>
            <p className="policy-note">{activePolicy === 'cortical' ? 'Uses fresh predicted-response changes for position sizing. This authored rule is not a validated financial model.' : activePolicy === 'observer' ? 'Observes the market and maintains a cash-only paper account.' : 'A 30-second momentum baseline. Its decisions do not use cortical activity.'}</p>
            {demo ? <button className="text-button reset-demo" onClick={() => { latest.current.step = 180; setStep(180); void refresh(); }}><RotateCcw size={13}/> Reset replay</button> : <p className="policy-note">Change the policy in the worker configuration, with a fresh paper account.</p>}
          </article>
        </section>
        <section className="panel ledger-panel"><div className="panel-heading"><div><span className="panel-icon"><BookOpen size={15}/></span><h2>Paper decisions</h2></div><span className="label">SIMULATED FILLS · NO ORDERS SENT</span></div><div className="ledger-items">{snapshot?.paper.fills.length ? snapshot.paper.fills.slice(-4).reverse().map(f => <div className="ledger-item" key={f.id}><span className={`trade-side ${f.side}`}>{f.side.toUpperCase()}</span><div><strong>{number(f.quantity)} TRAY at {f.price.toFixed(6)}</strong><small>{f.reason}</small></div><span>{new Date(f.ts).toLocaleTimeString('en-GB')}</span></div>) : <p className="empty-copy">No paper decisions. Observer mode holds cash; cortical mode requires a fresh model prediction.</p>}</div></section>
        {result ? <details className="panel prediction-receipt"><summary>Inspect the cortical prediction receipt</summary><p>Teal: positive model values. Amber: negative values. Fixed scale: −2 to +2 normalized model units. The trace shows mean absolute response across surface vertices.</p><p>Input cutoff: {new Date(result.inputEnd).toISOString()} · Published: {new Date(result.availableAt).toISOString()}</p><pre>{JSON.stringify(result.manifest, null, 2)}</pre></details> : null}
        <section className="faq-section"><div><span className="section-kicker">[ Questions ]</span><h2>A closer look<br/>at Tray.</h2><p>Understand what you’re watching.</p></div><div className="faq-items">{[
          ['Is this a real human brain?', 'Tray uses a model that predicts cortical fMRI responses to audiovisual stimuli. It is not a living brain, a human connectome, or a recording from an individual.'],
          ['What changes when someone trades?', 'Configured chain events change the observed market data. The worker turns a recorded window into a sensory stimulus, and a completed model result updates the cortical surface. Processing is asynchronous.'],
          ['Does Tray trade real money?', 'No. The account and its fills are simulated. The observer, momentum, and cortical policies can be compared without signing or sending financial transactions.'],
          ['Why am I seeing a schematic?', 'The default demo runs without a model service. Its 3D geometry is illustrative. Actual cortical values appear only after the configured TRIBE worker produces a result.']
        ].map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className="explore-pages" aria-label="Learn about Tray"><div><span className="section-kicker">[ Inside Tray ]</span><h2>Understand the experiment.</h2></div><div className="explore-grid">{[
        ['/about', '01', 'About Tray', 'The idea, the experience, and the boundaries.'],
        ['/science', '02', 'The Meta model', 'Inputs, cortical output, timing, and original sources.'],
        ['/how-it-works', '03', 'From trade to response', 'Follow the data through each stage of the system.']
      ].map(([href, index, title, description]) => <Link href={href} key={href}><span>{index}<ArrowUpRight size={16}/></span><h3>{title}</h3><p>{description}</p></Link>)}</div><p className="explore-legal">Read the <Link href="/terms">terms of use</Link> and <Link href="/privacy">privacy notice</Link>. Paper trading is simulated; model output is experimental.</p></section>
      <SiteFooter mode={demo ? 'demo' : 'live'}/>
    </main>
    {notice ? <div className="toast" role="status"><Check size={15}/>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15}/></button></div> : null}
    {selectedTick ? <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="event-modal" role="dialog" aria-modal="true" aria-label="Market event details" onClick={e => e.stopPropagation()}><div className="panel-heading"><h2>Event receipt</h2><button className="icon-button" aria-label="Close event details" onClick={() => setSelected(null)}><X size={18}/></button></div><p>{demo ? 'Synthetic demonstration event. It has no blockchain transaction.' : 'Public chain event. No participant identity is inferred.'}</p><pre>{JSON.stringify(selectedTick, null, 2)}</pre></section></div> : null}
    </div>
  </div>;
}

function Stat({ label, value, detail, positive, icon }: { label: string; value: string; detail: string; positive?: boolean; icon: React.ReactNode }) {
  return <article className="stat"><div className="stat-label">{label}{icon}</div><strong>{value}</strong><small className={positive === undefined ? '' : positive ? 'up' : 'down'}>{detail}</small></article>;
}
