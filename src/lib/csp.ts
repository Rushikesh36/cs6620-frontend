// Content Security Policy, set with <meta> tags because the site is static files on S3 and cannot
// send headers. Limits of that approach are in the README: meta tags cannot set
// frame-ancestors, report-uri or sandbox, and only protect what loads after they are read.

/**
 * Everything except where the page may send requests. That part depends on the API address in
 * config.json, which is only known at run time (see `connectPolicy`).
 *
 * 'unsafe-inline' is needed because a static Next.js page carries its start-up data in inline
 * scripts, and Tailwind and Radix set inline styles.
 */
export const BASE_POLICY = [
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** Pre-signed upload links point at the team's S3 bucket, whose name is not known up front. */
export const UPLOAD_SOURCE = 'https://*.amazonaws.com';

/**
 * Where requests may go: this site, the configured API and S3 for uploads. Added as a second
 * policy once config.json is loaded. The browser applies every policy it has been given, so
 * this can only make things stricter.
 */
export function connectPolicy(apiBaseUrl: string): string {
  const apiOrigin = new URL(apiBaseUrl).origin;
  return `connect-src 'self' ${apiOrigin} ${UPLOAD_SOURCE}`;
}
