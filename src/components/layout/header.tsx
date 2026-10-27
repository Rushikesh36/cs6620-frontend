'use client';

import { LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-provider';
import { useConfig } from '@/lib/config-provider';
import { MobileNav } from './mobile-nav';

export function Header() {
  const { user, logout } = useAuth();
  const { environment } = useConfig();

  return (
    <header className="border-border bg-background flex h-14 shrink-0 items-center gap-2 border-b px-3 md:px-4">
      <MobileNav />
      <div className="flex min-w-0 items-center gap-2">
        <ShieldCheck className="text-primary size-6 shrink-0" aria-hidden />
        <span className="hidden truncate font-semibold sm:inline">Unified Security Hub</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Tells the team which lab account they are looking at. */}
        <Badge
          variant="outline"
          className="max-w-32 truncate font-mono"
          title={`Environment: ${environment}`}
        >
          {environment}
        </Badge>
        {user?.role === 'ci' && <Badge variant="secondary">CI account</Badge>}
        <ThemeToggle />
        {user && (
          <span className="text-muted-foreground hidden items-center gap-1.5 text-sm md:flex">
            <UserIcon className="size-4" aria-hidden />
            {user.username}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => logout()}
          aria-label={user ? `Log out ${user.username}` : 'Log out'}
        >
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
