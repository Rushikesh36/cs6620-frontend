'use client';

import { FileCode2, Globe, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ScanType } from '@/lib/api/schemas';
import { OptionCard } from './option-card';

const OPTIONS: { type: ScanType; title: string; description: string; icon: LucideIcon }[] = [
  {
    type: 'SAST',
    title: 'Code scan (SAST)',
    description: 'Upload your code as a .zip. We read it for risky patterns without running it.',
    icon: FileCode2,
  },
  {
    type: 'DAST',
    title: 'App scan (DAST)',
    description: 'We attack a running test app from the outside to find weaknesses.',
    icon: Globe,
  },
];

export function ScanTypeStep({
  value,
  onChange,
  onContinue,
}: {
  value: ScanType | null;
  onChange: (type: ScanType) => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="sr-only">Scan type</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map(({ type, title, description, icon }) => (
            <OptionCard
              key={type}
              name="scan-type"
              value={type}
              checked={value === type}
              onChange={() => onChange(type)}
              icon={icon}
              title={title}
              description={description}
            />
          ))}
        </div>
      </fieldset>

      <Button onClick={onContinue} disabled={value === null}>
        Continue
      </Button>
    </div>
  );
}
