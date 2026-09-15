import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export type SiteSection = 'observatory' | 'experiment' | 'science' | 'how-it-works' | 'about' | 'deployment' | 'terms' | 'privacy' | 'evidence' | 'lore';

export function SiteHeader({ active, status, warning = false }: {
  active: SiteSection; status?: string; warning?: boolean;
}) {
  return <header className="topbar">
    <Link className="brand" href="/" aria-label="MetaTray home"><span className="brand-meta">meta</span><img className="brand-logo" src="/brand/tray-wordmark.svg" width="282" height="64" alt=""/></Link>
    <nav aria-label="Main navigation">
      {([
        ['observatory', '/', 'Observatory'],
        ['science', '/science', 'The science'],
        ['how-it-works', '/how-it-works', 'How it works']
      ] as const).map(([id, href, label]) => <Link key={id} href={href} className={active === id ? 'nav-active' : ''} aria-current={active === id ? 'page' : undefined}>{label}</Link>)}
    </nav>
    <div className="header-actions">
      {status ? <div className="topbar-status"><span className={`status-dot ${warning ? 'warning' : ''}`}/>{status}</div> : null}
      <Link className="primary-button header-cta" href="/experiment">Open view <ArrowUpRight size={14}/></Link>
    </div>
  </header>;
}

export function SiteFooter({ mode }: { mode?: 'demo' | 'live' }) {
  return <footer>
    <div className="footer-wordmark" aria-hidden="true">METATRAY</div>
    <div className="footer-content">
      <div><Link className="brand footer-brand" href="/" aria-label="MetaTray home"><span className="brand-meta">meta</span><img className="brand-logo" src="/brand/tray-wordmark.svg" width="282" height="64" alt=""/></Link><p>A cortical market experiment.<br/>Independent project using Meta TRIBE v2 research software.</p></div>
      <div className="footer-link-groups">
        <div><span>EXPLORE</span><Link href="/">Observatory</Link><Link href="/experiment">Experiment 001</Link><Link href="/lore">The lore</Link><Link href="/about">About MetaTray</Link><Link href="/how-it-works">How it works</Link></div>
        <div><span>RESEARCH</span><Link href="/science">The science</Link><Link href="/deployment">Model setup</Link><Link href="/evidence">Code & evidence</Link><a href="https://github.com/fourtyeightTech/metabrain" target="_blank" rel="noreferrer">MetaTray source <ArrowUpRight size={12}/></a><a href="https://github.com/facebookresearch/tribev2" target="_blank" rel="noreferrer">Meta source <ArrowUpRight size={12}/></a><a href="https://github.com/ponsdotdev/ponsfamily/tree/cb5748a29e4d3a7af1c4e982baa9ed9194d25a8f" target="_blank" rel="noreferrer">Pons source <ArrowUpRight size={12}/></a></div>
        <div><span>INFORMATION</span><Link href="/terms">Terms of use</Link><Link href="/privacy">Privacy</Link></div>
      </div>
    </div>
    <div className="footer-bottom"><span>© 2026 MetaTray. Paper trading only.</span><span>{mode ? <><span className="status-dot"/>{mode === 'demo' ? 'DEMO · SYNTHETIC MARKET DATA' : 'ON-CHAIN OBSERVATIONS'}</> : 'META TRIBE v2 · INDEPENDENT INTEGRATION'}</span></div>
  </footer>;
}
