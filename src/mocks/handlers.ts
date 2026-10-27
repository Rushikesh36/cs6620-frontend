import { delay, http, HttpResponse, type JsonBodyType } from 'msw';
import { createScanRequestSchema, loginRequestSchema, scanTypeSchema } from '@/lib/api/schemas';
import type { User } from '@/lib/api/schemas';
import { MOCK_UPLOAD_ORIGIN, type MockBackend, type Result } from './backend';

type Params = Readonly<Record<string, string | readonly string[] | undefined>>;
type Context = { request: Request; params: Params; user: User };

const errorResponse = (status: number, error: string) => HttpResponse.json({ error }, { status });

function param(params: Params, name: string): string {
  const value = params[name];
  return (typeof value === 'string' ? value : value?.[0]) ?? '';
}

function fromResult<T extends JsonBodyType>(result: Result<T>) {
  return result.ok ? HttpResponse.json(result.value) : errorResponse(result.status, result.error);
}

/** Mock versions of every endpoint in section 4, answering at `baseUrl` (plus a fake S3). */
export function createHandlers(baseUrl: string, backend: MockBackend) {
  const url = (path: string) => `${baseUrl}${path}`;

  // Adds the fake network delay, the token check and the optional random 500.
  const protectedRoute =
    (handle: (context: Context) => Response | Promise<Response>) =>
    async ({ request, params }: { request: Request; params: Params }) => {
      await delay(backend.options.latencyMs);
      const user = backend.authenticate(request);
      if (!user) return errorResponse(401, 'Your login token is missing or has expired.');
      if (backend.shouldFailRandomly())
        return errorResponse(500, 'Mock server error (random failure is on).');
      return handle({ request, params, user });
    };

  return [
    http.post(url('/login'), async ({ request }) => {
      await delay(backend.options.latencyMs);
      const body = loginRequestSchema.safeParse(await request.json().catch(() => null));
      if (!body.success) return errorResponse(400, 'Enter a username and a password.');
      const result = backend.login(body.data.username, body.data.password);
      return result ? HttpResponse.json(result) : errorResponse(401, 'Wrong username or password.');
    }),

    http.get(
      url('/targets'),
      protectedRoute(() => HttpResponse.json({ targets: backend.targets() })),
    ),

    http.post(
      url('/scans'),
      protectedRoute(async ({ request, user }) => {
        const body = createScanRequestSchema.safeParse(await request.json().catch(() => null));
        if (!body.success) {
          // A DAST request without a target is the one mistake worth naming.
          const missingTarget = body.error.issues.some((issue) => issue.path.includes('targetId'));
          return errorResponse(
            400,
            missingTarget
              ? 'Choose a test app to scan.'
              : 'The request is missing a project ID or has an unknown scan type.',
          );
        }
        return fromResult(backend.createScan(body.data, user));
      }),
    ),

    http.post(
      url('/scans/:jobId/start'),
      protectedRoute(({ params }) => fromResult(backend.startScan(param(params, 'jobId')))),
    ),

    http.get(
      url('/scans/:jobId'),
      protectedRoute(({ params }) => {
        const scan = backend.getScan(param(params, 'jobId'));
        return scan ? HttpResponse.json(scan) : errorResponse(404, 'Scan not found.');
      }),
    ),

    http.get(
      url('/projects/:projectId/scans'),
      protectedRoute(({ request, params }) => {
        const query = new URL(request.url).searchParams;
        const limit = Math.min(
          Math.max(Math.trunc(Number(query.get('limit') ?? 20)) || 20, 1),
          100,
        );
        return fromResult(
          backend.listScans(param(params, 'projectId'), limit, query.get('cursor')),
        );
      }),
    ),

    http.get(
      url('/projects/:projectId/findings'),
      protectedRoute(({ request, params }) => {
        const scanType = scanTypeSchema.safeParse(
          new URL(request.url).searchParams.get('scanType'),
        );
        if (!scanType.success) return errorResponse(400, 'scanType must be SAST or DAST.');
        return HttpResponse.json({
          items: backend.getFindings(param(params, 'projectId'), scanType.data),
        });
      }),
    ),

    // Fake S3. No token check: the real one is secured by the pre-signed URL itself.
    http.put(`${MOCK_UPLOAD_ORIGIN}/uploads/:jobId`, async ({ request, params }) => {
      await delay(backend.options.uploadDelayMs);
      const result = backend.receiveUpload(param(params, 'jobId'), request.headers);
      return result.ok
        ? new HttpResponse(null, { status: 200 })
        : new HttpResponse(result.error, { status: result.status });
    }),
  ];
}
