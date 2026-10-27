'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CONFIG_URL, type ConfigError } from '@/lib/config';

export function ConfigErrorScreen({ error, onRetry }: { error: ConfigError; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div role="alert" className="border-border bg-card w-full max-w-lg rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <TriangleAlert className="text-destructive size-6 shrink-0" aria-hidden />
          <h1 className="text-xl font-semibold">Configuration error</h1>
        </div>

        <p className="mt-4">{error.message}</p>
        {error.details.length > 0 && (
          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
            {error.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}

        <div className="bg-muted mt-5 space-y-2 rounded-lg p-4 text-sm">
          <p>
            This site reads its settings from <code className="font-mono">{CONFIG_URL}</code> when
            it starts. It should look like this:
          </p>
          <pre className="overflow-x-auto font-mono text-xs">
            {`{
  "apiBaseUrl": "https://abc123.execute-api.us-east-1.amazonaws.com",
  "environment": "your-lab-name"
}`}
          </pre>
          <p className="text-muted-foreground">
            Deployed site: ask whoever manages the Terraform setup to check that the file was
            uploaded. Running locally: copy{' '}
            <code className="font-mono">public/config.example.json</code> to{' '}
            <code className="font-mono">public/config.json</code>.
          </p>
        </div>

        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </main>
  );
}
