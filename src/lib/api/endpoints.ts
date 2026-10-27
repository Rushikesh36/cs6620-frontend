import { ApiError, type ApiClient } from './client';
import {
  createScanResponseSchema,
  findingsResponseSchema,
  loginResponseSchema,
  scanListResponseSchema,
  scanSchema,
  startScanResponseSchema,
  targetsResponseSchema,
  type CreateScanRequest,
  type CreateScanResponse,
  type FindingsResponse,
  type LoginRequest,
  type LoginResponse,
  type Scan,
  type ScanListResponse,
  type ScanType,
  type StartScanResponse,
  type TargetsResponse,
} from './schemas';

// Path segments come from user input (project IDs), so always encode them.
const seg = encodeURIComponent;

export type ListScansParams = { limit?: number; cursor?: string | null };

/** One typed function per endpoint in section 4 of the contract. */
export function createEndpoints(client: ApiClient) {
  return {
    login: (credentials: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> =>
      client.request({
        method: 'POST',
        path: '/login',
        body: credentials,
        schema: loginResponseSchema,
        auth: false,
        signal,
      }),

    getTargets: (signal?: AbortSignal): Promise<TargetsResponse> =>
      client.request({ path: '/targets', schema: targetsResponseSchema, signal }),

    createScan: async (
      req: CreateScanRequest,
      signal?: AbortSignal,
    ): Promise<CreateScanResponse> => {
      const response = await client.request({
        method: 'POST',
        path: '/scans',
        body: req,
        schema: createScanResponseSchema,
        signal,
      });
      // The contract promises upload instructions for every SAST job.
      if (req.scanType === 'SAST' && !response.upload) {
        throw new ApiError(
          200,
          "The server didn't send upload instructions for this scan. Please try again.",
          'invalid_response',
        );
      }
      return response;
    },

    startScan: (jobId: string, signal?: AbortSignal): Promise<StartScanResponse> =>
      client.request({
        method: 'POST',
        path: `/scans/${seg(jobId)}/start`,
        schema: startScanResponseSchema,
        signal,
      }),

    getScan: (jobId: string, signal?: AbortSignal): Promise<Scan> =>
      client.request({ path: `/scans/${seg(jobId)}`, schema: scanSchema, signal }),

    getProjectScans: (
      projectId: string,
      params: ListScansParams = {},
      signal?: AbortSignal,
    ): Promise<ScanListResponse> =>
      client.request({
        path: `/projects/${seg(projectId)}/scans`,
        query: { limit: params.limit, cursor: params.cursor },
        schema: scanListResponseSchema,
        signal,
      }),

    getFindings: (
      projectId: string,
      scanType: ScanType,
      signal?: AbortSignal,
    ): Promise<FindingsResponse> =>
      client.request({
        path: `/projects/${seg(projectId)}/findings`,
        query: { scanType },
        schema: findingsResponseSchema,
        signal,
      }),
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
