import { z } from 'zod';
import { userSchema, type User } from '@/lib/api/schemas';

// sessionStorage, not localStorage: the token is gone when the tab closes.
const STORAGE_KEY = 'ush-session';

/** The banner appears this long before the session ends. */
export const EXPIRY_WARNING_MS = 5 * 60 * 1000;

const sessionSchema = z.object({
  token: z.string().min(1),
  user: userSchema,
  expiresAt: z.number(),
});

export type Session = { token: string; user: User; expiresAt: number };

export function isExpiringSoon(expiresAt: number, nowMs: number = Date.now()): boolean {
  return expiresAt - nowMs <= EXPIRY_WARNING_MS;
}

/** The saved session, or null if there is none, it is damaged, or it has already expired. */
export function readSession(nowMs: number = Date.now()): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.expiresAt <= nowMs) {
      clearSession();
      return null;
    }
    return parsed.data;
  } catch {
    // Storage can be blocked or hold junk. Treat both as "not logged in".
    return null;
  }
}

export function writeSession(session: Session): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Without storage the user stays logged in until they reload the page.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
