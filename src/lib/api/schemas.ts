// Single source of truth for the backend contract (section 4 of the spec).
// If the backend changes, update this file; types are inferred from the schemas.
// Unknown extra fields are stripped, so the backend can add fields without breaking us.
import { z } from 'zod';

// ---- shared pieces ----

// Lenient on purpose: accepts any string Date can parse (with or without offset or
// fractional seconds), so a small formatting difference in the backend can't blank a page.
const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be an ISO-8601 date',
});

export const scanTypeSchema = z.enum(['SAST', 'DAST']);
export type ScanType = z.infer<typeof scanTypeSchema>;

export const scanStatusSchema = z.enum(['CREATED', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']);
export type ScanStatus = z.infer<typeof scanStatusSchema>;

/** COMPLETED and FAILED are final: nothing changes after that. */
export const FINAL_STATUSES: readonly ScanStatus[] = ['COMPLETED', 'FAILED'];
export function isFinalStatus(status: ScanStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export const severitySchema = z.enum(['HIGH', 'MEDIUM', 'LOW', 'INFO']);
export type Severity = z.infer<typeof severitySchema>;

export const findingStateSchema = z.enum(['OPEN', 'FIXED']);
export type FindingState = z.infer<typeof findingStateSchema>;

// ---- 4.10 errors ----

export const apiErrorBodySchema = z.object({ error: z.string() });
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

// ---- 4.1 POST /login ----

export const loginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userRoleSchema = z.enum(['user', 'ci']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userSchema = z.object({
  username: z.string(),
  role: userRoleSchema,
});
export type User = z.infer<typeof userSchema>;

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  expiresIn: z.number().int().positive(), // seconds
  user: userSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ---- 4.2 GET /targets ----

export const targetSchema = z.object({
  targetId: z.string().min(1),
  name: z.string(),
  description: z.string(),
});
export type Target = z.infer<typeof targetSchema>;

export const targetsResponseSchema = z.object({ targets: z.array(targetSchema) });
export type TargetsResponse = z.infer<typeof targetsResponseSchema>;

// ---- 4.3 POST /scans ----

export const createScanRequestSchema = z.discriminatedUnion('scanType', [
  z.object({ projectId: z.string().min(1), scanType: z.literal('SAST') }),
  z.object({
    projectId: z.string().min(1),
    scanType: z.literal('DAST'),
    targetId: z.string().min(1),
  }),
]);
export type CreateScanRequest = z.infer<typeof createScanRequestSchema>;

// 4.4: the pre-signed S3 upload instructions (SAST only).
export const uploadInfoSchema = z.object({
  url: z.url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresIn: z.number().int().positive(), // seconds
});
export type UploadInfo = z.infer<typeof uploadInfoSchema>;

// `upload` is present for SAST jobs only; callers check it for the scan type they asked for.
export const createScanResponseSchema = z.object({
  jobId: z.string().min(1),
  status: z.literal('CREATED'),
  upload: uploadInfoSchema.optional(),
});
export type CreateScanResponse = z.infer<typeof createScanResponseSchema>;

// ---- 4.5 POST /scans/{jobId}/start ----

export const startScanResponseSchema = z.object({
  jobId: z.string().min(1),
  status: z.literal('QUEUED'),
});
export type StartScanResponse = z.infer<typeof startScanResponseSchema>;

// ---- 4.6 GET /scans/{jobId} ----

export const scanSummarySchema = z.object({
  new: z.number().int().nonnegative(),
  newHigh: z.number().int().nonnegative(),
  stillOpen: z.number().int().nonnegative(),
  fixed: z.number().int().nonnegative(),
});
export type ScanSummary = z.infer<typeof scanSummarySchema>;

export const scanSchema = z.object({
  jobId: z.string().min(1),
  projectId: z.string().min(1),
  scanType: scanTypeSchema,
  targetId: z.string().nullable(),
  status: scanStatusSchema,
  requestedBy: z.string(),
  // The contract always shows a tag. We also accept null/missing, since a job that
  // hasn't started yet may not have one. Listed in TASKS.md "Backend requests".
  imageTag: z.string().nullish(),
  createdAt: isoDate,
  queuedAt: isoDate.nullable(),
  startedAt: isoDate.nullable(),
  finishedAt: isoDate.nullable(),
  summary: scanSummarySchema.nullable(), // null until COMPLETED
  error: z.string().nullable(),
});
export type Scan = z.infer<typeof scanSchema>;

// ---- 4.7 GET /projects/{projectId}/scans ----

export const scanListResponseSchema = z.object({
  items: z.array(scanSchema),
  nextCursor: z.string().nullable(),
});
export type ScanListResponse = z.infer<typeof scanListResponseSchema>;

// ---- 4.8 GET /projects/{projectId}/findings ----

export const findingSchema = z.object({
  fingerprint: z.string().min(1),
  ruleId: z.string(),
  severity: severitySchema,
  location: z.string(),
  message: z.string(),
  state: findingStateSchema,
  firstSeenJobId: z.string(),
  lastSeenJobId: z.string(),
});
export type Finding = z.infer<typeof findingSchema>;

export const findingsResponseSchema = z.object({ items: z.array(findingSchema) });
export type FindingsResponse = z.infer<typeof findingsResponseSchema>;
