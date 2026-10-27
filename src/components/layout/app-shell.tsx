'use client';

import { SessionExpiryBanner } from '@/components/auth/session-expiry-banner';
import { Header } from './header';
import { SidebarNav } from './sidebar-nav';

/**
 * Header on top, sidebar on the left (desktop), page content on the right.
 * The window itself never scrolls: only the content area does, so header and sidebar stay put.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#main-content"
        className="bg-background focus:ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:ring-2"
      >
        Skip to main content
      </a>
      <SessionExpiryBanner />
      <Header />
      <div className="flex min-h-0 flex-1">
        <aside className="border-border hidden w-60 shrink-0 overflow-y-auto border-r p-3 md:block">
          <SidebarNav />
        </aside>
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto p-4 outline-none md:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
