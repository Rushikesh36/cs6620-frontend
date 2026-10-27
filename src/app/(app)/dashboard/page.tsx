import type { Metadata } from 'next';
import { Dashboard } from '@/components/dashboard/dashboard';

export const metadata: Metadata = { title: 'Dashboard · Unified Security Hub' };

export default function DashboardPage() {
  return <Dashboard />;
}
