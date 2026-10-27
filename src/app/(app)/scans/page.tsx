import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { ScansList } from '@/components/scans/scans-list';

export const metadata: Metadata = { title: 'Scans · Unified Security Hub' };

export default function ScansPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold">Scans</h1>
      {/* useSearchParams needs a Suspense boundary in a statically exported page. */}
      <Suspense fallback={<FullPageLoader />}>
        <ScansList />
      </Suspense>
    </div>
  );
}
