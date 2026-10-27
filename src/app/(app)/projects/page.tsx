import type { Metadata } from 'next';
import { ProjectsOverview } from '@/components/projects/projects-overview';

export const metadata: Metadata = { title: 'Projects · Unified Security Hub' };

export default function ProjectsPage() {
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <ProjectsOverview />
    </div>
  );
}
