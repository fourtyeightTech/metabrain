import { BrainCircuit, ChevronRight } from 'lucide-react';
import type { CorticalEpoch } from '@/lib/types';

const compact = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2, notation: value >= 10000 ? 'compact' : 'standard' });

export function CorticalAtlas({ epochs, currentId, quote, onSelect }: {
  epochs: CorticalEpoch[]; currentId: string | null; quote: string; onSelect: (id: string) => void;
}) {
  return <section className="atlas-section" aria-labelledby="atlas-title">
    <div className="atlas-heading"><div><span className="section-kicker">[ Cortical epochs ]</span><h2 id="atlas-title">The Cortical Chronicle.</h2><p>A growing atlas of predicted responses to market-authored sensory experiences. Every entry preserves the exact observations from which its stimulus was made.</p></div><span className="small-tag">{epochs.length} VALIDATED EPOCHS</span></div>
    {epochs.length ? <div className="epoch-grid">{epochs.map((epoch, index) => {
      const selected = epoch.id === currentId;
      return <button key={epoch.id} className={`epoch-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(epoch.id)} aria-pressed={selected}>
        <div className="epoch-card-top"><span>EPOCH {String(epochs.length - index).padStart(3, '0')}</span><span className={`epoch-regime ${epoch.regime}`}>{epoch.regime.toUpperCase()}</span></div>
        <div className="epoch-signal" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(4, epoch.meanAbsoluteResponse * 50))}%` }}/></div>
        <strong>{epoch.meanAbsoluteResponse.toFixed(4)} <small>MEAN |RESPONSE|</small></strong>
        <dl><div><dt>Market</dt><dd>{epoch.priceChangePct === null ? '—' : `${epoch.priceChangePct >= 0 ? '+' : ''}${epoch.priceChangePct.toFixed(2)}%`}</dd></div><div><dt>Trades</dt><dd>{epoch.tradeCount}</dd></div><div><dt>Volume</dt><dd>{compact(epoch.observedVolume)} {quote}</dd></div><div><dt>Published</dt><dd>{new Date(epoch.availableAt).toLocaleString('en-GB')}</dd></div></dl>
        <span className="epoch-open">Open cortical surface <ChevronRight size={13}/></span>
      </button>;
    })}</div> : <div className="atlas-empty"><BrainCircuit size={32}/><div><strong>The chronicle begins with the first validated epoch.</strong><p>Confirmed trades may already pulse through the observatory. The first surface appears after the indexed GPU worker publishes valid TRIBE output.</p></div></div>}
    <p className="atlas-note">These surfaces predict an averaged-subject fMRI target. They are not measured visitor brains, emotions, consciousness or market forecasts. Regimes summarize the recorded market window.</p>
  </section>;
}
