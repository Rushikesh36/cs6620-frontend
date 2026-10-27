import type { ScanType, Severity } from '@/lib/api/schemas';

export type PoolFinding = {
  ruleId: string;
  severity: Severity;
  location: string;
  message: string;
};

// The first scan of a project reports the first BASELINE_COUNT entries. Later scans fix
// a few of them and discover new ones from the rest of the list, in this order.

const sast: PoolFinding[] = [
  {
    ruleId: 'python.lang.security.audit.eval-detected.eval-detected',
    severity: 'HIGH',
    location: 'app/views.py:42',
    message:
      'Detected the use of eval(). eval() can run any code, so if the input comes from a user this allows code injection.',
  },
  {
    ruleId: 'python.flask.security.audit.debug-enabled.debug-enabled',
    severity: 'MEDIUM',
    location: 'main.py:9',
    message:
      'Flask app is started with debug=True. Do not deploy this to production, it exposes an interactive debugger.',
  },
  {
    ruleId: 'python.lang.security.audit.insecure-hash-algorithms-md5.insecure-hash-algorithm-md5',
    severity: 'MEDIUM',
    location: 'auth/tokens.py:23',
    message:
      'Detected the MD5 hash algorithm, which is considered insecure. Use SHA-256 or better.',
  },
  {
    ruleId: 'python.lang.best-practice.unspecified-open-encoding.unspecified-open-encoding',
    severity: 'INFO',
    location: 'utils/io.py:12',
    message:
      'open() is called without an explicit encoding, so behaviour depends on the system locale.',
  },
  {
    ruleId: 'python.lang.security.audit.subprocess-shell-true.subprocess-shell-true',
    severity: 'HIGH',
    location: 'utils/backup.py:18',
    message:
      'Found subprocess call with shell=True. A crafted argument could run extra commands on the server.',
  },
  {
    ruleId:
      'python.lang.security.audit.insecure-transport.requests.request-with-http.request-with-http',
    severity: 'LOW',
    location: 'integrations/legacy.py:9',
    message:
      'A request is made to an http:// URL. The traffic is not encrypted and can be read or changed in transit.',
  },
  {
    ruleId: 'python.requests.security.disabled-cert-validation.disabled-cert-validation',
    severity: 'MEDIUM',
    location: 'integrations/webhook.py:64',
    message:
      'Certificate verification is turned off (verify=False), which allows man-in-the-middle attacks.',
  },
  {
    ruleId: 'python.lang.security.audit.formatted-sql-query.formatted-sql-query',
    severity: 'HIGH',
    location: 'db/queries.py:31',
    message:
      'A SQL query is built with string formatting. Use parameterized queries to prevent SQL injection.',
  },
  {
    ruleId: 'python.lang.security.deserialization.avoid-pyyaml-load.avoid-pyyaml-load',
    severity: 'MEDIUM',
    location: 'config/loader.py:15',
    message: 'yaml.load() can build arbitrary Python objects. Use yaml.safe_load() instead.',
  },
  {
    ruleId: 'python.lang.security.deserialization.pickle.avoid-pickle',
    severity: 'HIGH',
    location: 'services/cache.py:56',
    message: 'Avoid pickle: loading data from an untrusted source can execute arbitrary code.',
  },
  {
    ruleId: 'generic.secrets.security.detected-generic-secret.detected-generic-secret',
    severity: 'HIGH',
    location: 'config/settings.py:12',
    message:
      'A hard-coded secret was detected. Move it to a secrets manager or an environment variable.',
  },
  {
    ruleId: 'python.lang.security.audit.insecure-tempfile.mktemp',
    severity: 'LOW',
    location: 'utils/files.py:27',
    message:
      'tempfile.mktemp() is unsafe because another process can create the file before you do. Use mkstemp().',
  },
  {
    ruleId: 'python.lang.security.insecure-file-permissions.insecure-file-permissions',
    severity: 'MEDIUM',
    location: 'utils/files.py:40',
    message: 'A file is made world-writable with chmod 0o777. Restrict the permissions.',
  },
  {
    ruleId:
      'python.lang.best-practice.logging-error-without-handling.logging-error-without-handling',
    severity: 'INFO',
    location: 'services/mailer.py:88',
    message: 'An exception is logged and then silently ignored, which can hide failures.',
  },
];

const dast: PoolFinding[] = [
  {
    ruleId: 'zap.40018.sql-injection',
    severity: 'HIGH',
    location: 'GET /rest/products/search?q',
    message:
      'The q parameter changed the database query when special characters were sent: SQL injection is likely.',
  },
  {
    ruleId: 'zap.10038.content-security-policy-missing',
    severity: 'MEDIUM',
    location: 'GET /',
    message:
      'The response has no Content-Security-Policy header, so the browser cannot block injected scripts.',
  },
  {
    ruleId: 'zap.40012.cross-site-scripting-reflected',
    severity: 'HIGH',
    location: 'GET /api/Feedbacks?comment',
    message:
      'Input from the comment parameter was returned in the page without encoding: reflected cross-site scripting.',
  },
  {
    ruleId: 'zap.10098.cross-domain-misconfiguration',
    severity: 'MEDIUM',
    location: 'GET /api/Products',
    message: 'The server allows requests from any origin (Access-Control-Allow-Origin: *).',
  },
  {
    ruleId: 'zap.10010.cookie-no-httponly',
    severity: 'LOW',
    location: 'POST /rest/user/login',
    message: 'A cookie was set without the HttpOnly flag, so scripts on the page can read it.',
  },
  {
    ruleId: 'zap.10021.x-content-type-options-missing',
    severity: 'LOW',
    location: 'GET /main.js',
    message:
      'The X-Content-Type-Options header is missing, which lets some browsers guess the content type.',
  },
  {
    ruleId: 'zap.10036.server-leaks-version-info',
    severity: 'INFO',
    location: 'GET /',
    message: 'The Server header reveals the software and version in use.',
  },
  {
    ruleId: 'zap.0.directory-browsing',
    severity: 'MEDIUM',
    location: 'GET /ftp/',
    message:
      'Directory listing is enabled, which exposes file names that were not meant to be public.',
  },
  {
    ruleId: 'zap.90022.application-error-disclosure',
    severity: 'MEDIUM',
    location: 'GET /rest/products/1/reviews',
    message: 'An error page includes a stack trace, which reveals how the application is built.',
  },
  {
    ruleId: 'zap.40026.cross-site-scripting-dom',
    severity: 'HIGH',
    location: 'GET /#/track-result?id',
    message:
      'The id value is written into the page by client-side code without being cleaned: DOM-based cross-site scripting.',
  },
  {
    ruleId: 'zap.10096.timestamp-disclosure',
    severity: 'INFO',
    location: 'GET /main.js',
    message:
      'The response contains a Unix timestamp, which can help an attacker understand the system.',
  },
  {
    ruleId: 'zap.10020.anti-clickjacking-missing',
    severity: 'MEDIUM',
    location: 'GET /',
    message: 'The page can be shown inside a frame on another site, which allows clickjacking.',
  },
];

export const FINDING_POOLS: Record<ScanType, PoolFinding[]> = { SAST: sast, DAST: dast };
export const BASELINE_COUNT: Record<ScanType, number> = { SAST: 9, DAST: 8 };
