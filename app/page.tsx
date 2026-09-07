import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth';
import LoginForm from './login-form';

export default async function HomePage() {
  if (await isAdminAuthenticated()) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-4">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest">Admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">HasibWeb X AdVista</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
