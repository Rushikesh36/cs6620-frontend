'use client';

import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/components/theme/theme-provider';

/** Pop-up messages ("Copied to clipboard"). Follows the app's light/dark/system choice. */
export function Toaster() {
  const { choice } = useTheme();
  return <Sonner theme={choice} position="bottom-right" closeButton />;
}
