'use client';

import { useEffect } from 'react';
import { connectPolicy } from '@/lib/csp';

const META_ID = 'connect-policy';

/**
 * Once config.json is known, restricts where this page may send requests. Does nothing in
 * development, where the dev server needs connections a strict policy would block.
 */
export function ConnectPolicy({
  apiBaseUrl,
  enabled = process.env.NODE_ENV === 'production',
}: {
  apiBaseUrl: string;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled || document.getElementById(META_ID)) return;
    const meta = document.createElement('meta');
    meta.id = META_ID;
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = connectPolicy(apiBaseUrl);
    document.head.appendChild(meta);
    // Not removed on cleanup: a policy cannot be taken back once the browser has read it.
  }, [apiBaseUrl, enabled]);

  return null;
}
