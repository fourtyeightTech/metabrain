'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Radio, RefreshCw } from 'lucide-react';
import type { Snapshot } from '@/lib/types';
import { META_REPOSITORY, METATRAY_REPOSITORY, transactionUrl } from '@/lib/sources';

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
  return <section className="feed-console" aria-label="Live data feed">
    <div className="feed-console-heading"><div><Radio size={17}/><h2>Live input stream</h2></div>
      <span className={`small-tag ${healthy && !demo ? 'mint' : ''}`}>{demo ? 'DEMO INPUT' : paused ? 'VIEW PAUSED' : healthy ? ticks.length ? 'LIVE ON-CHAIN' : 'CONNECTED · WAITING' : 'NOT CONNECTED'}</span>
      <button className="icon-button" onClick={onRefresh} aria-label="Refresh live feed"><RefreshCw size={14}/></button></div>
    <div className="feed-metrics">
      <div><span>TRANSPORT</span><strong>{feed?.source === 'rpc' ? 'Direct RPC' : feed?.source === 'indexed' ? 'Indexed chain' : demo ? 'Synthetic' : 'Connecting'}</strong><small>{feed ? `Polls every ${feed.pollMs / 1000}s` : 'Checking setup'}</small></div>
      <div><span>BLOCK</span><strong>{(feed?.chainHead ?? snapshot?.indexedBlock)?.toLocaleString() ?? '—'}</strong><small>{snapshot?.chainId ? `Chain ${snapshot.chainId}` : 'No chain selected'}</small></div>
      <div><span>LAST RESPONSE</span><strong>{age(feed?.checkedAt)}</strong><small>{receivedAt ? `Browser received ${age(receivedAt)}` : 'No response yet'}</small></div>
      <div><span>LAST SWAP</span><strong>{age(last?.ts)}</strong><small>{ticks.length} in current window</small></div>
    </div>
    {feed?.phase === 'setup' ? <div className="connection-setup"><strong>Connect your real token</strong><p>{snapshot?.message}</p>
      {feed.missing.length ? <div className="env-chips">{feed.missing.map(key => <code key={key}>{key}</code>)}</div> : null}
      {feed.invalid.length ? <p>Check the format of: {feed.invalid.join(', ')}. Configured values stay private.</p> : null}
      <Link href="/deployment">Open live connection instructions <ArrowUpRight size={14}/></Link></div>
      : <p className="feed-description" role="status">{error || snapshot?.message || 'Checking the live connection…'}</p>}
    <div className="pipeline-stages" aria-label="Data pipeline status">
      <div className={healthy && !demo ? 'ready' : ''}><span>01</span><b>Chain events</b><small>{demo ? 'Synthetic input' : healthy ? 'Receiving RPC data' : 'Waiting for connection'}</small></div>
      <div className={ticks.length && !demo ? 'ready' : ''}><span>02</span><b>Market → stimulus</b><small>{ticks.length ? 'Input preview updating' : 'Waiting for swaps'}</small></div>
      <div className={snapshot?.jobs.running ? 'ready' : ''}><span>03</span><b>Meta TRIBE v2</b><small>{snapshot?.jobs.running ? 'Inference running' : snapshot?.jobs.queued ? `${snapshot.jobs.queued} queued` : snapshot?.prediction ? 'Result received' : 'GPU worker not producing output'}</small></div>
      <div className={snapshot?.prediction ? 'ready' : ''}><span>04</span><b>Cortical output</b><small>{snapshot?.prediction ? `${snapshot.prediction.vertexCount.toLocaleString()} values · check input age` : 'No model result'}</small></div>
    </div>
    <div className="incoming-events" aria-label="Incoming decoded events">
      <div className="incoming-label"><span>DECODED SWAPS / {demo ? 'SYNTHETIC' : 'REAL EVENT RECEIPTS'}</span><small>{feed?.fromBlock !== null && feed?.fromBlock !== undefined ? `Blocks ${feed.fromBlock}–${feed.toBlock}` : 'Latest observed window'}</small></div>
      {ticks.slice(-6).reverse().map(t => { const url = transactionUrl(feed?.explorer, t.txHash); return <div className="incoming-row" key={t.id}>
        <span className={`trade-side ${t.side}`}>{t.side.toUpperCase()}</span><button onClick={() => onSelect(t.id)} title="Inspect raw event receipt"><b>{t.quoteAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} {snapshot?.quoteSymbol}</b><small>{t.venue} · block {t.blockNumber} · log {t.logIndex}</small></button>
        <span className="incoming-hash">{t.txHash ? `${t.txHash.slice(0, 12)}…${t.txHash.slice(-6)}` : 'synthetic event'}{url ? <a href={url} target="_blank" rel="noreferrer" aria-label="Open transaction on explorer"><ArrowUpRight size={13}/></a> : null}</span>
      </div>; })}
      {!ticks.length ? <p className="empty-copy">{healthy ? 'Listening to the configured market. No swaps were found in this block window.' : 'No real events received. Connect the listed services to start the stream.'}</p> : null}
      {feed?.truncated ? <p className="feed-description">High activity: only the newest swaps in the queried block window are displayed.</p> : null}
    </div>
    <div className="feed-evidence"><span>Inspect the implementation</span><a href={METATRAY_REPOSITORY} target="_blank" rel="noreferrer">MetaTray source <ArrowUpRight size={13}/></a><a href={META_REPOSITORY} target="_blank" rel="noreferrer">Meta source <ArrowUpRight size={13}/></a><Link href="/evidence">Code & evidence <ArrowUpRight size={13}/></Link></div>
  </section>;
}
