'use client';

import { FolderSearch } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { FindingsPanel } from '@/components/findings/findings-panel';
import { ScansList } from '@/components/scans/scans-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlParams } from '@/hooks/use-url-params';
import { validateProjectId } from '@/lib/validation/project-id';

type Tab = 'SAST' | 'DAST' | 'history';

// Settings that only make sense inside one tab. Switching tabs drops them all.
const TAB_SETTINGS = { severity: null, state: null, q: null, sort: null, page: null, status: null };

export function ProjectDetail() {
  const { params, setParams } = useUrlParams();
  const projectParam = params.get('projectId') ?? '';
  const valid = projectParam !== '' && validateProjectId(projectParam) === null;

  // "?scanType=DAST" (the link from a finished scan) opens that findings tab.
  const tab: Tab =
    params.get('tab') === 'history'
      ? 'history'
      : params.get('scanType') === 'DAST'
        ? 'DAST'
        : 'SAST';

  if (!valid) {
    return (
      <EmptyState
        icon={FolderSearch}
        title="No project selected"
        description="Open a project from the Projects page to see its findings and scan history."
        action={
          <Button asChild variant="outline">
            <Link href="/projects/">Go to projects</Link>
          </Button>
        }
      />
    );
  }

  const changeTab = (next: string) => {
    const chosen = next as Tab;
    setParams({
      ...TAB_SETTINGS,
      tab: chosen === 'history' ? 'history' : null,
      scanType: chosen === 'history' ? null : chosen,
    });
  };

  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Project</h1>
          <p className="font-mono text-lg break-all">{projectParam}</p>
        </div>
        <Button asChild>
          <Link href={`/scans/new/?project=${encodeURIComponent(projectParam)}`}>Start a scan</Link>
        </Button>
      </header>

      <Tabs value={tab} onValueChange={changeTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="SAST">SAST findings</TabsTrigger>
          <TabsTrigger value="DAST">DAST findings</TabsTrigger>
          <TabsTrigger value="history">Scan history</TabsTrigger>
        </TabsList>

        <TabsContent value="SAST">
          <FindingsPanel projectId={projectParam} scanType="SAST" />
        </TabsContent>
        <TabsContent value="DAST">
          <FindingsPanel projectId={projectParam} scanType="DAST" />
        </TabsContent>
        <TabsContent value="history">
          <ScansList showProjectPicker={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
