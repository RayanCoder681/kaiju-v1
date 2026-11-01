import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo.js';
import { ThemeToggle, LocaleToggle } from './Controls.js';

/** En-tête commun aux surfaces organisateur/accueil (jamais sur la projection). */
export function Shell({ children, surfaceLabel }: { children: ReactNode; surfaceLabel?: string }) {
  return (
    <div className="app-shell min-h-full bg-bg text-fg">
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="site-brand">
            <Logo size={32} />
            <span className="site-brand__word">Kaiju<span>®</span></span>
            {surfaceLabel && <span className="site-brand__surface">{surfaceLabel}</span>}
          </Link>
          <div className="site-header__tools">
            <Link to="/host" className="site-header__host">Espace organisateur <span aria-hidden="true">↗</span></Link>
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
