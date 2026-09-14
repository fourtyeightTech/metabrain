import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { SiteFooter, SiteHeader } from './site-chrome';
import { informationPages, type InformationSlug } from '@/lib/information-pages';

export function InformationPage({ slug }: { slug: InformationSlug }) {
  const page = informationPages[slug];
  return <div className="site-root">
    <a href="#article-content" className="skip-link">Skip to content</a>
    <div className="announcement"><span>Tray / A cortical market experiment</span><Link href="/science">Explore the science <ArrowUpRight size={14}/></Link></div>
    <div className="app-shell">
      <SiteHeader active={slug}/>
      <main id="article-content">
        <article className="information-page">
          <Link className="article-back" href="/"><ArrowLeft size={13}/> Observatory</Link>
          <header className="article-hero"><span className="section-kicker">[ {page.eyebrow} ]</span><h1>{page.title}</h1><p>{page.intro}</p>{page.note ? <div className="article-note">{page.note}</div> : null}</header>
          <div className="article-layout">
            <aside className="article-toc"><nav aria-label="On this page"><span>ON THIS PAGE</span>{page.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav></aside>
            <div className="article-body">{page.sections.map((section, index) => <section id={section.id} key={section.id}><span className="article-section-number">{String(index + 1).padStart(2, '0')}</span><h2>{section.title}</h2>{section.body}</section>)}</div>
          </div>
          <div className="article-next"><span>CONTINUE EXPLORING</span><Link href={page.next.href}>{page.next.label}<ArrowUpRight size={18}/></Link></div>
        </article>
        <SiteFooter/>
      </main>
    </div>
  </div>;
}
