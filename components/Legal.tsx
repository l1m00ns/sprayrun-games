// Shared frame for the legal pages (/terms, /privacy). The game itself locks scrolling, so these pages scroll inside a fixed container.
import type { ReactNode } from 'react';

export const LEGAL_VERSION = '2026-11-26';

export default function Legal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal">
      <article>
        <nav><a href="/">← Reverse Surfers</a><span><a href="/terms">Terms of Service</a> · <a href="/privacy">Privacy Policy</a></span></nav>
        <h1>{title}</h1>
        <p className="meta">Version {LEGAL_VERSION}. These are plain-language documents written for this game. They are not legal advice: the operator should have them reviewed by a lawyer in their country and fill in the operator details below before opening the game to the public.</p>
        {children}
      </article>
    </div>
  );
}
