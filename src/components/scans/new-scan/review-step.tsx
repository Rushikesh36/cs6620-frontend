'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubmitScan, type SubmitStage } from '@/hooks/use-submit-scan';
import { useTargets } from '@/hooks/use-targets';
import type { ScanType } from '@/lib/api/schemas';
import { formatFileSize } from '@/lib/utils/format';
import { SubmitChecklist, type ChecklistItem, type ChecklistState } from './submit-checklist';

const STAGE_LABELS: Record<SubmitStage, string> = {
  create: 'Creating job',
  upload: 'Uploading code',
  start: 'Queuing scan',
};

export function ReviewStep({
  scanType,
  projectId,
  file,
  targetId,
  onBack,
}: {
  scanType: ScanType;
  projectId: string;
  file: File | null;
  targetId: string | null;
  onBack: () => void;
}) {
  const { status, progress, notice, isBusy, submit, retry } = useSubmitScan({
    scanType,
    projectId,
    targetId,
    file,
  });
  const { data: targets } = useTargets();
  const target = targets?.find((t) => t.targetId === targetId);

  const stages: SubmitStage[] =
    scanType === 'SAST' ? ['create', 'upload', 'start'] : ['create', 'start'];
  const percent = Math.round(progress * 100);

  const items: ChecklistItem[] = stages.map((stage, index) => {
    let state: ChecklistState = 'pending';
    if (status.phase === 'done') state = 'done';
    else if (status.phase === 'running' || status.phase === 'failed') {
      const current = stages.indexOf(status.stage);
      if (index < current) state = 'done';
      else if (index === current) state = status.phase === 'failed' ? 'failed' : 'active';
    }
    return { key: stage, label: STAGE_LABELS[stage], state };
  });

  // Screen readers hear the stage, and the upload in 25% steps rather than every percent.
  const announcement =
    status.phase === 'running'
      ? status.stage === 'upload'
        ? `Uploading code, ${Math.floor(percent / 25) * 25} percent`
        : STAGE_LABELS[status.stage]
      : status.phase === 'done'
        ? 'Scan started. Taking you to the scan.'
        : '';

  return (
    <div className="space-y-6">
      <dl className="border-border divide-border divide-y rounded-xl border text-sm">
        <Row
          label="Scan type"
          value={scanType === 'SAST' ? 'Code scan (SAST)' : 'App scan (DAST)'}
        />
        <Row label="Project" value={projectId} mono />
        {scanType === 'SAST' && file && (
          <Row label="Code" value={`${file.name} (${formatFileSize(file.size)})`} mono />
        )}
        {scanType === 'DAST' && (
          <Row
            label="Test app"
            value={target ? `${target.name} (${targetId})` : (targetId ?? '')}
          />
        )}
      </dl>

      {status.phase !== 'idle' && (
        <SubmitChecklist items={items} uploadPercent={scanType === 'SAST' ? percent : null} />
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {notice && (
        <p role="status" className="text-muted-foreground text-sm">
          {notice}
        </p>
      )}

      {status.phase === 'failed' && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-xl border p-4 text-sm"
        >
          <TriangleAlert className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="space-y-3">
            <p className="font-medium">The scan could not be started.</p>
            <p>{status.message}</p>
            {status.stage === 'upload' && !status.uploadExpired && (
              <p className="text-muted-foreground">
                Your scan was created and your file is still selected, so you can try the upload
                again.
              </p>
            )}
            {status.stage === 'upload' && status.uploadExpired && (
              <p className="text-muted-foreground">
                The upload link has expired. We will create a new scan and upload your file again.
              </p>
            )}
            <Button size="sm" onClick={retry}>
              {status.stage === 'upload' && status.uploadExpired
                ? 'Start over with a new scan'
                : status.stage === 'upload'
                  ? 'Retry upload'
                  : 'Try again'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={isBusy}>
          Back
        </Button>
        {status.phase !== 'failed' && (
          <Button type="button" onClick={submit} disabled={isBusy}>
            Start scan
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
      <dt className="text-muted-foreground w-28 shrink-0">{label}</dt>
      <dd className={mono ? 'font-mono break-all' : 'break-words'}>{value}</dd>
    </div>
  );
}
