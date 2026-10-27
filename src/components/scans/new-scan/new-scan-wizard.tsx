'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useRecentProjects } from '@/hooks/use-recent-projects';
import { scanTypeSchema, type ScanType } from '@/lib/api/schemas';
import { validateProjectId } from '@/lib/validation/project-id';
import { ProjectStep } from './project-step';
import { ReviewStep } from './review-step';
import { ScanTypeStep } from './scan-type-step';
import { TargetStep } from './target-step';
import { UploadStep } from './upload-step';
import { StepIndicator } from './step-indicator';

type Step = 0 | 1 | 2 | 3;

function stepTitle(step: Step, scanType: ScanType | null): string {
  if (step === 0) return 'Choose a scan type';
  if (step === 1) return 'Name the project';
  if (step === 2) return scanType === 'DAST' ? 'Choose a test app' : 'Upload your code';
  return 'Review and start';
}

function stepLabels(scanType: ScanType | null): string[] {
  const third = scanType === 'SAST' ? 'Upload code' : scanType === 'DAST' ? 'Choose app' : 'Source';
  return ['Scan type', 'Project', third, 'Review'];
}

export function NewScanWizard() {
  // "?type=SAST&project=my-app" pre-fills the form, for "Start the same scan again".
  const params = useSearchParams();
  const presetType = scanTypeSchema.safeParse(params.get('type'));
  const presetProject = params.get('project') ?? '';
  // Only used to pre-select a card: it must still match the allow-list from the server.
  const presetTarget = params.get('target');

  const [scanType, setScanType] = useState<ScanType | null>(
    presetType.success ? presetType.data : null,
  );
  const [projectId, setProjectId] = useState(
    validateProjectId(presetProject) === null ? presetProject : '',
  );
  const [file, setFile] = useState<File | null>(null);
  const [targetId, setTargetId] = useState<string | null>(
    presetTarget && presetTarget.length <= 100 ? presetTarget : null,
  );
  const [step, setStep] = useState<Step>(presetType.success ? 1 : 0);
  const { projects: recentProjects, remember } = useRecentProjects();

  // Moving to a new step moves keyboard and screen reader focus to its heading.
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  return (
    <div className="max-w-2xl space-y-8">
      <StepIndicator steps={stepLabels(scanType)} current={step} />

      <section aria-labelledby="step-title" className="space-y-6">
        <h2
          id="step-title"
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {stepTitle(step, scanType)}
        </h2>

        {step === 0 && (
          <ScanTypeStep value={scanType} onChange={setScanType} onContinue={() => setStep(1)} />
        )}

        {step === 1 && (
          <ProjectStep
            initialValue={projectId}
            recentProjects={recentProjects}
            onBack={() => setStep(0)}
            onContinue={(id) => {
              setProjectId(id);
              remember(id);
              setStep(2);
            }}
          />
        )}

        {step === 2 && scanType === 'SAST' && (
          <UploadStep
            file={file}
            onFileChange={setFile}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 2 && scanType === 'DAST' && (
          <TargetStep
            value={targetId}
            onChange={setTargetId}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && scanType && (
          <ReviewStep
            scanType={scanType}
            projectId={projectId}
            file={file}
            targetId={targetId}
            onBack={() => setStep(2)}
          />
        )}
      </section>
    </div>
  );
}
