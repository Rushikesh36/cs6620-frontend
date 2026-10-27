import {
  LayoutDashboard,
  ListChecks,
  FolderKanban,
  ScanSearch,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Gets the current path without a trailing slash. */
  isActive: (path: string) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard/',
    icon: LayoutDashboard,
    isActive: (path) => path === '/dashboard',
  },
  {
    label: 'New Scan',
    href: '/scans/new/',
    icon: ScanSearch,
    isActive: (path) => path === '/scans/new',
  },
  {
    label: 'Scans',
    href: '/scans/',
    icon: ListChecks,
    // "/scans/new" belongs to New Scan, so only one item is highlighted at a time.
    isActive: (path) => path === '/scans' || (path.startsWith('/scans/') && path !== '/scans/new'),
  },
  {
    label: 'Projects',
    href: '/projects/',
    icon: FolderKanban,
    isActive: (path) => path === '/projects' || path.startsWith('/projects/'),
  },
];

export function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}
