import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth';
import DashboardApp from './dashboard-app';

export default async function DashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect('/');
  }

  return <DashboardApp />;
}
