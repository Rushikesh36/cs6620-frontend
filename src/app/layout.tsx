import type { Metadata } from 'next';
import Script from 'next/script';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { ConfigProvider } from '@/lib/config-provider';
import { MockGate } from '@/lib/mock-gate';
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
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <ThemeProvider>
          <ConfigProvider>
            <MockGate>
              <AuthProvider>{children}</AuthProvider>
            </MockGate>
          </ConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
