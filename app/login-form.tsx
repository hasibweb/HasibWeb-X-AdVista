'use client';

import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!response.ok) {
      setError('Invalid admin password.');
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          required
        />
      </label>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <button
        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md bg-forest px-4 py-2 font-semibold text-white hover:bg-ink disabled:opacity-60"
        disabled={loading}
      >
        <LockKeyhole size={18} />
        {loading ? 'Signing in' : 'Sign in'}
      </button>
    </form>
  );
}
