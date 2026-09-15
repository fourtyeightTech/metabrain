'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, BrainCircuit, Database, Radio, RefreshCw } from 'lucide-react';
import type { Snapshot } from '@/lib/types';
import { GitHubMark } from './source-marks';
import { META_REPOSITORY, METATRAY_REPOSITORY, PONS_REPOSITORY, transactionUrl } from '@/lib/sources';

export function FeedConsole({ snapshot, error, paused, receivedAt, onRefresh, onSelect }: {
  snapshot: Snapshot | null; error: string; paused: boolean; receivedAt: number | null;
  onRefresh: () => void; onSelect: (id: string) => void;
}) {
  const [clock, setClock] = useState(0);
  useEffect(() => { setClock(Date.now()); const id = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(id); }, []);
  const feed = snapshot?.feed; const demo = snapshot?.mode === 'demo';
  const ticks = snapshot?.ticks ?? []; const last = ticks.at(-1);
  const healthy = !!snapshot?.connected && !snapshot.stale && !error && !paused && !!receivedAt && clock - receivedAt < 15000;
  const age = (ts: number | null | undefined) => ts && clock ? `${Math.max(0, Math.floor((clock - ts) / 1000))}s ago` : 'Not received';
  const status = demo ? 'DEMO INPUT' : paused ? 'VIEW PAUSED' : healthy ? ticks.length ? 'LIVE ON-CHAIN' : 'CONNECTED · WAITING' : 'NOT CONNECTED';
  const visualState = demo ? 'demo' : paused ? 'paused' : healthy ? 'live' : feed?.phase === 'setup' ? 'setup' : error ? 'error' : 'waiting';
  const stages = [
    { number: '01', title: 'Chain events', mark: 'protocol', state: demo ? 'demo' : healthy ? 'ready' : 'waiting',
      detail: demo ? 'Synthetic input' : healthy ? 'Receiving RPC data' : 'Waiting for connection' },
    { number: '02', title: 'Market → stimulus', mark: null, state: ticks.length ? demo ? 'demo' : 'ready' : 'waiting',
      detail: ticks.length ? 'Input preview updating' : 'Waiting for swaps' },
    { number: '03', title: 'Meta TRIBE v2', mark: 'model', state: demo ? 'demo' : snapshot?.jobs.running || snapshot?.jobs.queued ? 'active' : snapshot?.prediction ? 'ready' : 'waiting',
      detail: demo ? 'No inference in demo mode' : feed?.source === 'rpc' ? 'Indexed GPU pipeline required' : !snapshot?.inferenceEnabled ? 'Inference disabled by operator' : snapshot?.jobs.running ? 'Inference running' : snapshot?.jobs.queued ? `${snapshot.jobs.queued} queued` : snapshot?.prediction ? 'Result received' : 'Waiting for a completed worker result' },
    { number: '04', title: 'Cortical output', mark: null, state: snapshot?.prediction ? 'ready' : 'waiting',
      detail: snapshot?.prediction ? `${snapshot.prediction.vertexCount.toLocaleString()} values · check input age` : 'No model result' }
  ] as const;
  return <section className="feed-console" data-state={visualState} aria-labelledby="live-input-title" aria-busy={!snapshot}>
    <div className="feed-console-heading"><div><Radio size={17} aria-hidden="true"/><h2 id="live-input-title">Live input stream</h2></div>
      <span className="feed-status" data-state={visualState} role="status" aria-live="polite" aria-atomic="true">{status}</span>
      <button type="button" className="icon-button" onClick={onRefresh} aria-label="Refresh live feed"><RefreshCw size={14} aria-hidden="true"/></button></div>
    <dl className="feed-metrics">
      <div><dt>TRANSPORT</dt><dd><strong>{feed?.source === 'rpc' ? 'Direct RPC' : feed?.source === 'indexed' ? 'Indexed chain' : demo ? 'Synthetic' : 'Connecting'}</strong><small>{feed ? `Polls every ${feed.pollMs / 1000}s` : 'Checking setup'}</small></dd></div>
      <div><dt>BLOCK</dt><dd><strong>{(feed?.chainHead ?? snapshot?.indexedBlock)?.toLocaleString() ?? '—'}</strong><small>{snapshot?.chainId ? `Chain ${snapshot.chainId}` : 'No chain selected'}</small></dd></div>
      <div><dt>LAST RESPONSE</dt><dd><strong>{age(feed?.checkedAt)}</strong><small>{receivedAt ? `Browser received ${age(receivedAt)}` : 'No response yet'}</small></dd></div>
      <div><dt>LAST SWAP</dt><dd><strong>{age(last?.ts)}</strong><small>{ticks.length} in current window</small></dd></div>
    </dl>
    {feed?.phase === 'setup' ? <div className="connection-setup" role="region" aria-labelledby="connection-setup-title"><strong id="connection-setup-title">Connect your real token</strong><p>{snapshot?.message}</p>
      {feed.missing.length ? <ul className="env-chips" aria-label="Required environment variables">{feed.missing.map(key => <li key={key}><code>{key}</code></li>)}</ul> : null}
      {feed.invalid.length ? <p>Check the format of: {feed.invalid.join(', ')}. Configured values stay private.</p> : null}
      <Link href="/deployment">Open live connection instructions <ArrowUpRight size={14} aria-hidden="true"/></Link></div>
      : <p className="feed-description">{error || snapshot?.message || 'Checking the live connection…'}</p>}
    <ol className="pipeline-stages" aria-label="Data pipeline status">
      {stages.map(stage => <li key={stage.number} data-stage-state={stage.state}><span>{stage.number}</span><b>{stage.mark === 'protocol' ? <Database className="source-mark" aria-hidden="true"/> : stage.mark === 'model' ? <BrainCircuit className="source-mark" aria-hidden="true"/> : null}{stage.title}</b><small>{stage.detail}</small></li>)}
    </ol>
    <section className="incoming-events" aria-labelledby="incoming-events-title">
      <div className="incoming-label"><h3 id="incoming-events-title">DECODED SWAPS / {demo ? 'SYNTHETIC' : 'REAL EVENT RECEIPTS'}</h3><small>{feed?.fromBlock !== null && feed?.fromBlock !== undefined ? `Blocks ${feed.fromBlock}–${feed.toBlock}` : 'Latest observed window'}</small></div>
      <div role="list" aria-label="Latest decoded swaps">{ticks.slice(-6).reverse().map(t => { const url = transactionUrl(feed?.explorer, t.txHash); return <div className="incoming-row" role="listitem" key={t.id}>
        <span className={`trade-side ${t.side}`}>{t.side.toUpperCase()}</span><button type="button" onClick={() => onSelect(t.id)} aria-haspopup="dialog" aria-label={`Inspect ${t.side} event for ${t.quoteAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${snapshot?.quoteSymbol ?? 'quote units'} at block ${t.blockNumber}`}><b>{t.quoteAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} {snapshot?.quoteSymbol}</b><small>{t.venue} · block {t.blockNumber} · log {t.logIndex}</small></button>
        <span className="incoming-hash">{t.txHash ? `${t.txHash.slice(0, 12)}…${t.txHash.slice(-6)}` : 'synthetic event'}{url ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Open transaction ${t.txHash.slice(0, 10)}…${t.txHash.slice(-6)} at block ${t.blockNumber} on explorer (opens in new tab)`}><ArrowUpRight size={13} aria-hidden="true"/></a> : null}</span>
      </div>; })}
      {!ticks.length ? <p className="empty-copy">{healthy ? 'Listening to the configured market. No swaps were found in this block window.' : 'No real events received. Connect the listed services to start the stream.'}</p> : null}
      {feed?.truncated ? <p className="feed-description">High activity: only the newest swaps in the queried block window are displayed.</p> : null}
      </div>
    </section>
    <div className="feed-evidence"><span>Inspect the implementation</span><a href={METATRAY_REPOSITORY} target="_blank" rel="noreferrer" aria-label="MetaTray source on GitHub (opens in new tab)"><GitHubMark className="source-mark"/>MetaTray source <ArrowUpRight size={13} aria-hidden="true"/></a><a href={META_REPOSITORY} target="_blank" rel="noreferrer" aria-label="Meta TRIBE v2 source on GitHub (opens in new tab)"><GitHubMark className="source-mark"/>Meta research <ArrowUpRight size={13} aria-hidden="true"/></a><a href={PONS_REPOSITORY} target="_blank" rel="noreferrer" aria-label="Pons protocol source on GitHub (opens in new tab)"><GitHubMark className="source-mark"/>Pons protocol <ArrowUpRight size={13} aria-hidden="true"/></a><Link href="/evidence">Code & evidence <ArrowUpRight size={13} aria-hidden="true"/></Link></div>
  </section>;
}
