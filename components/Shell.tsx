'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

const nav = [
  ['/', 'Overview', '⌂'], ['/capture', 'Quick capture', '＋'], ['/memories', 'Memory library', '▤'], ['/spatial', 'Spatial walk', '⌖'],
  ['/timeline', 'Timeline', '◷'], ['/graph', 'Associative graph', '⌘'], ['/review', 'Memory review', '↻'], ['/settings', 'Parameters', '⚙'],
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [authEnabled, setAuthEnabled] = useState(false);
  useEffect(() => { fetch('/api/auth/status').then(r => r.json()).then(value => setAuthEnabled(value.enabled === true)).catch(() => setAuthEnabled(false)); }, []);
  if (path === '/login') return <>{children}</>;
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">M</span><span>Memory<span className="brand-light">Scape</span><small>PERSONAL KNOWLEDGE GRAPH</small></span></Link>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(([url, label, icon]) => <Link className={`nav-link ${path === url ? 'active' : ''}`} href={url} key={url}><span className="nav-icon">{icon}</span>{label}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="connection"><span className="live-dot" /> Database-native recall</div><div className="course">BCSE497J · Project I<br /><span>Akil · Syon Vijae Thyvalappil</span></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb">MEMORYSCAPE <span>/</span> {nav.find(x => x[0] === path)?.[1]?.toUpperCase() ?? 'WORKSPACE'}</div><div className="top-status"><span className="live-dot" /> Local workspace {authEnabled && <button className="button ghost" onClick={logout}>Sign out</button>}<span className="avatar">MS</span></div></header>
      <section className="page-content">{children}</section>
      <footer className="footer">PostgreSQL · PostGIS · Recursive SQL <span>All recall computation stays in your database</span></footer>
    </main>
  </div>;
}
