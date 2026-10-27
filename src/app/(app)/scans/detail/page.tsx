import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { ScanDetail } from '@/components/scans/scan-detail';

export const metadata: Metadata = { title: 'Scan details · Unified Security Hub' };

export default function ScanDetailPage() {
  // useSearchParams needs a Suspense boundary in a statically exported page.
  return (
    <Suspense fallback={<FullPageLoader />}>
      <ScanDetail />
    </Suspense>
  );
}
