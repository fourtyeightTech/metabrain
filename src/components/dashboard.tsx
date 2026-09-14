'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, ArrowRight, AudioLines, BookOpen, BrainCircuit, Check, ChevronRight, CircleDot,
  Download, ExternalLink, FlaskConical, Layers3, Pause, Play, Radio, RotateCcw, Terminal, Wallet, X } from 'lucide-react';
import { PriceChart, ResponseTrace } from './chart';
import { equity } from '@/lib/paper';
import type { MeshData, Policy, PredictionResult, Snapshot } from '@/lib/types';

const Cortex = dynamic(() => import('./cortex'), { ssr: false, loading: () => <div className="cortex-loading">Preparing the cortical view…</div> });
const money = (v: number, digits = 2) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const number = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 3, notation: v > 100000 ? 'compact' : 'standard' });
const short = (s: string) => s ? `${s.slice(0, 8)}…${s.slice(-4)}` : 'Synthetic';
type Tab = 'observatory' | 'science' | 'deploy';

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null); const [error, setError] = useState('');
  const [paused, setPaused] = useState(false); const [step, setStep] = useState(180);
  const [policy, setPolicy] = useState<Policy>('momentum'); const [tab, setTab] = useState<Tab>('observatory');
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
    setTab('observatory');
    requestAnimationFrame(() => document.getElementById('observatory')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    }));
  };
  return <div className="site-root">
    {announcement ? <div className="announcement"><span>Introducing Tray. A cortical market experiment.</span><button onClick={() => setTab('science')}>Explore the science <ArrowRight size={14}/></button><button className="announcement-close" aria-label="Dismiss announcement" onClick={() => setAnnouncement(false)}><X size={16}/></button></div> : null}
    <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Tray home"><BrainCircuit size={29} strokeWidth={1.8}/><span>tray<span className="brand-dot">.</span></span></a>
      <nav aria-label="Main navigation">{(['observatory', 'science', 'deploy'] as const).map(t => <button key={t} className={tab === t ? 'nav-active' : ''} onClick={() => setTab(t)}>{t === 'observatory' ? 'Observatory' : t === 'science' ? 'The science' : 'Deployment'}</button>)}</nav>
      <div className="header-actions"><div className="topbar-status"><span className={`status-dot ${error || snapshot?.stale ? 'warning' : ''}`}/>{demo ? 'DEMO' : 'ON-CHAIN'}</div><button className="primary-button header-cta" onClick={openObservatory}>Open view <ArrowUpRight size={14}/></button></div>
    </header>
    <main>
      {tab === 'observatory' ? <>
        <section className="hero">
          <div className="hero-copy">
            <div className="research-badge"><span>EXPERIMENT 001</span><i/><span>TRIBE v2</span></div>
            <h1>Token markets.<br/>Cortical responses.</h1>
            <p>Meet Tray, the paper trader exploring a model of human cortical responses. Watch the market become an experience you can inspect.</p>
            <div className="hero-actions"><button className="primary-button" onClick={openObservatory}>Open observatory <ArrowRight size={17}/></button><button className="bracket-button" onClick={() => setTab('science')}>The science <ArrowUpRight size={16}/></button></div>
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
        <div className="research-strip"><p>Market data meets a model of human response.</p><div><span><Radio size={22}/><b>Pons</b><small>MARKET ADAPTER</small></span><span><BrainCircuit size={25}/><b>TRIBE v2</b><small>MODEL REFERENCE</small></span><span><Wallet size={22}/><b>Paper only</b><small>TRADING MODE</small></span></div></div>
        <section className="observatory-intro" id="observatory"><span className="section-kicker">[ Observatory ]</span><h2>Follow the experiment.</h2><p>The market, the sensory input, and Tray’s paper decisions.</p><button className="secondary-button" onClick={exportSession} disabled={!snapshot}><Download size={14}/> Export receipt</button></section>
        <div className={`mode-banner ${error ? 'error-banner' : ''}`} role="status"><div><Radio size={15}/><span>{error || (demo ? 'Synthetic market replay' : snapshot?.stale ? 'Chain feed is stale' : 'Following on-chain market events')}</span><small>{error ? 'Last received values may be stale.' : demo ? 'Demo prices. No model predictions. No real funds.' : snapshot?.message}</small></div><button onClick={() => setTab('deploy')}>{demo ? 'Connect live services' : 'Service setup'}<ChevronRight size={15}/></button></div>
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
      </> : tab === 'science' ? <Science/> : <Deployment/>}
      <footer><div className="footer-wordmark" aria-hidden="true">TRAY</div><div className="footer-content"><div><a className="brand" href="/" aria-label="Tray home"><BrainCircuit size={25}/><span>tray.</span></a><p>A cortical market experiment.<br/>Independent software. No Meta affiliation.</p></div><div className="footer-links"><button onClick={openObservatory}>Observatory <ArrowUpRight size={13}/></button><button onClick={() => setTab('science')}>Scientific boundaries <ArrowUpRight size={13}/></button><button onClick={() => setTab('deploy')}>Deployment guide <ArrowUpRight size={13}/></button></div></div><div className="footer-bottom"><span>© 2026 Tray. Paper trading only.</span><span><span className="status-dot"/>{demo ? 'DEMO · SYNTHETIC MARKET DATA' : 'ON-CHAIN OBSERVATIONS'}</span></div></footer>
    </main>
    {notice ? <div className="toast" role="status"><Check size={15}/>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15}/></button></div> : null}
    {selectedTick ? <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="event-modal" role="dialog" aria-modal="true" aria-label="Market event details" onClick={e => e.stopPropagation()}><div className="panel-heading"><h2>Event receipt</h2><button className="icon-button" aria-label="Close event details" onClick={() => setSelected(null)}><X size={18}/></button></div><p>{demo ? 'Synthetic demonstration event. It has no blockchain transaction.' : 'Public chain event. No participant identity is inferred.'}</p><pre>{JSON.stringify(selectedTick, null, 2)}</pre></section></div> : null}
    </div>
  </div>;
}

function Stat({ label, value, detail, positive, icon }: { label: string; value: string; detail: string; positive?: boolean; icon: React.ReactNode }) {
  return <article className="stat"><div className="stat-label">{label}{icon}</div><strong>{value}</strong><small className={positive === undefined ? '' : positive ? 'up' : 'down'}>{detail}</small></article>;
}
function Science() {
  return <section className="document-view"><div className="eyebrow"><FlaskConical size={14}/> THE SCIENCE</div><h1>A prediction you can inspect.</h1><p className="document-intro">Tray presents market-derived sensory stimuli to a model trained to predict human fMRI responses. The connection from event to input to output stays visible.</p>
    <div className="science-grid">{[
      ['01', 'The stimulus', 'Executed trades become a market-screen video and a factual spoken update. The input is an authored representation of financial information.'],
      ['02', 'The encoding model', 'Meta TRIBE v2 combines video, audio, and language features to predict an averaged subject’s cortical response. It does not contain a human connectome.'],
      ['03', 'The displayed response', 'Real results use fsaverage5 surface vertices. The decorative default view is labeled schematic and never substitutes invented neural values.'],
      ['04', 'The trading experiment', 'Paper decisions are a separate authored policy. Predicted response change can scale exposure; it is not evidence of emotion or trading skill.']
    ].map(([n, title, body]) => <article className="panel science-card" key={n}><span>{n}</span><h2>{title}</h2><p>{body}</p></article>)}</div>
    <h2>Timing and uncertainty</h2><p>The released model is noncausal within its supplied context. Tray’s rolling-window adapter supplies only observations known at the cutoff and labels this use experimental. Results become available after preprocessing and inference. Paper decisions can only use results that already existed at their decision time.</p>
    <p>Market charts and portfolio changes are not validated financial-response tasks in the TRIBE release. More predicted activity does not establish fear, pleasure, consciousness, or the probability of buying.</p>
    <h2>Research sources</h2><div className="source-links">{[
      ['Meta TRIBE v2 · code and inference interface', 'https://github.com/facebookresearch/tribev2'],
      ['TRIBE v2 · research paper', 'https://arxiv.org/abs/2605.04326'],
      ['Official weights and configuration', 'https://huggingface.co/facebook/tribev2'],
      ['Pons · official contract source', 'https://github.com/ponsdotdev/ponsfamily']
    ].map(([label, href]) => <a href={href} key={href} target="_blank" rel="noreferrer">{label}<ExternalLink size={15}/></a>)}</div>
    <h2>Model permissions</h2><p>TRIBE code and weights are released under CC BY-NC 4.0. This project does not include those weights or grant commercial rights. The operator must establish permission for the intended model use. Token promotion is not automatically noncommercial because an interface is free.</p>
  </section>;
}
function Deployment() {
  return <section className="document-view"><div className="eyebrow"><Terminal size={14}/> DEPLOYMENT</div><h1>Three services. One observatory.</h1><p className="document-intro">The website runs on Vercel. Durable services watch the chain and perform model inference. No wallet key is required.</p>
    <div className="science-grid">{[
      ['01', 'Web application', 'Deploy this repository to Vercel as Next.js. The default demo works without a database, RPC endpoint, or GPU.'],
      ['02', 'Market service', 'Apply the Postgres migration and run the Node indexer on a persistent host. Configure the new token, chain, start block, and verified protocol contracts.'],
      ['03', 'Inference worker', 'Run the Python service on a suitable GPU host with an authorized, revision-pinned TRIBE installation. It consumes jobs from Postgres.'],
      ['04', 'Activate the live view', 'Set TRAY_MODE=live and the database read connection in Vercel. The site reports disconnected services rather than replacing live results with demo data.']
    ].map(([n, title, body]) => <article className="panel science-card" key={n}><span>{n}</span><h2>{title}</h2><p>{body}</p></article>)}</div>
    <h2>Agent handoff</h2><p>The downloadable project includes <code>AGENT_HANDOFF.md</code>, <code>docs/DEPLOYMENT.md</code>, <code>docs/SCIENCE.md</code>, the environment template, migrations, tests, and the GPU service. Start with the handoff and the recorded verification results.</p>
    <pre className="command-block">{'npm ci\nnpm run build\n\n# Persistent market host\nnpm run db:migrate\nnpm run doctor\nnpm run worker'}</pre>
    <h2>Runtime boundaries</h2><p>Vercel serves the frontend and read-only APIs. It does not host the GPU model or the persistent chain subscription. The paper account is a simulation; this package never signs or submits financial transactions.</p>
  </section>;
}
