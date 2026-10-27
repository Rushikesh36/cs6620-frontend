import type { Metadata } from 'next';
import Script from 'next/script';
import { BASE_POLICY } from '@/lib/csp';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfigProvider } from '@/lib/config-provider';
import { MockGate } from '@/lib/mock-gate';
import { SessionProviders } from '@/lib/query/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Unified Security Hub',
  description: 'Run code and app security scans and review findings in one place.',
};

// Runs before first paint so a dark-mode user never sees a white flash.
// Fixed constant, no user input.
const THEME_INIT = `try{var t=localStorage.getItem('theme');var d=t==='dark'||((t===null||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the init script adds the "dark" class before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Production only: the dev server needs things a strict policy would block. */}
        {process.env.NODE_ENV === 'production' && (
          <meta httpEquiv="Content-Security-Policy" content={BASE_POLICY} />
        )}
      </head>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <ThemeProvider>
          <TooltipProvider>
            <ConfigProvider>
              <MockGate>
                <SessionProviders>{children}</SessionProviders>
              </MockGate>
            </ConfigProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
