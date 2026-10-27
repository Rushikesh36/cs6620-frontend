import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { NewScanWizard } from '@/components/scans/new-scan/new-scan-wizard';

export const metadata: Metadata = { title: 'New scan · Unified Security Hub' };

export default function NewScanPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New scan</h1>
      {/* useSearchParams needs a Suspense boundary in a statically exported page. */}
      <Suspense fallback={<FullPageLoader />}>
        <NewScanWizard />
      </Suspense>
    </div>
  );
}
