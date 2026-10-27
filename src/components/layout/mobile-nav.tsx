'use client';

import { Menu, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth/auth-provider';
import { SidebarNav } from './sidebar-nav';

/** The slide-out menu for phones, where the sidebar is hidden. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-5" aria-hidden />
            Unified Security Hub
          </SheetTitle>
          <SheetDescription>{user ? `Logged in as ${user.username}` : 'Menu'}</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
