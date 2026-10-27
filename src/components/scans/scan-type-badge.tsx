import { FileCode2, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ScanType } from '@/lib/api/schemas';

const LABELS: Record<ScanType, string> = {
  SAST: 'Code scan (SAST)',
  DAST: 'App scan (DAST)',
};

export function ScanTypeBadge({ scanType }: { scanType: ScanType }) {
  const Icon = scanType === 'SAST' ? FileCode2 : Globe;
  return (
    <Badge variant="secondary">
      <Icon aria-hidden />
      {LABELS[scanType]}
    </Badge>
  );
}
