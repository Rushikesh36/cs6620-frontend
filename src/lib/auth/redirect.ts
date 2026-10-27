export const DEFAULT_REDIRECT = '/dashboard/';

/**
 * Where to go after login. Only paths inside this site are allowed, so a crafted link like
 * /login?next=https://evil.example can't send someone to another site after they log in.
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) return DEFAULT_REDIRECT;
  // Browsers silently drop tabs and newlines inside URLs, so "/\t/evil.com" would turn into
  // "//evil.com". Refuse control characters and backslashes outright.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return DEFAULT_REDIRECT;

  let url: URL;
  try {
    url = new URL(next, 'http://internal.invalid');
  } catch {
    return DEFAULT_REDIRECT;
  }
  // "//evil.com" parses as a different host: the origin check catches that.
  if (url.origin !== 'http://internal.invalid') return DEFAULT_REDIRECT;
  // Sending a just-logged-in user back to the login page would be a loop.
  if (url.pathname.replace(/\/+$/, '') === '/login') return DEFAULT_REDIRECT;

  return `${url.pathname}${url.search}${url.hash}`;
}
