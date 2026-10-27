import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { ProjectDetail } from '@/components/projects/project-detail';

export const metadata: Metadata = { title: 'Project · Unified Security Hub' };

export default function ProjectDetailPage() {
  // useSearchParams needs a Suspense boundary in a statically exported page.
  return (
    <Suspense fallback={<FullPageLoader />}>
      <ProjectDetail />
    </Suspense>
  );
}
