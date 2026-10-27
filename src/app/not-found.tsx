import { FileQuestion } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page not found · Unified Security Hub' };

// S3 serves this page (404.html) for any address that does not exist.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <FileQuestion className="text-primary mx-auto size-12" aria-hidden />
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">
          We couldn&apos;t find the page you were looking for. It may have moved, or the address may
          have a typo.
        </p>
        <Button asChild>
          <Link href="/dashboard/">Go to the dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
