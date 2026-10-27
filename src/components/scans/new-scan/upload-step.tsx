'use client';

import { UploadZone } from '@/components/scans/upload-zone';
import { Button } from '@/components/ui/button';

export function UploadStep({
  file,
  onFileChange,
  onBack,
  onContinue,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <UploadZone file={file} onFileChange={onFileChange} />
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onContinue} disabled={file === null}>
          Continue
        </Button>
      </div>
    </div>
  );
}
