import Link from 'next/link';
import { ArrowUpRight, BrainCircuit } from 'lucide-react';

export type SiteSection = 'observatory' | 'science' | 'how-it-works' | 'about' | 'deployment' | 'terms' | 'privacy';

export function SiteHeader({ active, status, warning = false }: {
  active: SiteSection; status?: string; warning?: boolean;
}) {
  return <header className="topbar">
    <Link className="brand" href="/" aria-label="Tray home"><BrainCircuit size={29} strokeWidth={1.8}/><span>tray<span className="brand-dot">.</span></span></Link>
    <nav aria-label="Main navigation">
      {([
        ['observatory', '/', 'Observatory'],
        ['science', '/science', 'The science'],
        ['how-it-works', '/how-it-works', 'How it works']
      ] as const).map(([id, href, label]) => <Link key={id} href={href} className={active === id ? 'nav-active' : ''} aria-current={active === id ? 'page' : undefined}>{label}</Link>)}
    </nav>
    <div className="header-actions">
      {status ? <div className="topbar-status"><span className={`status-dot ${warning ? 'warning' : ''}`}/>{status}</div> : null}
      <Link className="primary-button header-cta" href="/#observatory">Open view <ArrowUpRight size={14}/></Link>
    </div>
  </header>;
}

export function SiteFooter({ mode }: { mode?: 'demo' | 'live' }) {
  return <footer>
    <div className="footer-wordmark" aria-hidden="true">TRAY</div>
    <div className="footer-content">
      <div><Link className="brand" href="/" aria-label="Tray home"><BrainCircuit size={25}/><span>tray.</span></Link><p>A cortical market experiment.<br/>Independent project using Meta TRIBE v2 research software.</p></div>
      <div className="footer-link-groups">
        <div><span>EXPLORE</span><Link href="/">Observatory</Link><Link href="/about">About Tray</Link><Link href="/how-it-works">How it works</Link></div>
        <div><span>RESEARCH</span><Link href="/science">The science</Link><Link href="/deployment">Model setup</Link><a href="https://github.com/fourtyeightTech/metabrain" target="_blank" rel="noreferrer">Source code <ArrowUpRight size={12}/></a></div>
        <div><span>INFORMATION</span><Link href="/terms">Terms of use</Link><Link href="/privacy">Privacy</Link></div>
      </div>
    </div>
    <div className="footer-bottom"><span>© 2026 Tray. Paper trading only.</span><span>{mode ? <><span className="status-dot"/>{mode === 'demo' ? 'DEMO · SYNTHETIC MARKET DATA' : 'ON-CHAIN OBSERVATIONS'}</> : 'META TRIBE v2 · INDEPENDENT INTEGRATION'}</span></div>
  </footer>;
}
