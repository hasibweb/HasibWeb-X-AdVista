import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from './auth';

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'Request failed';
  return NextResponse.json({ error: message }, { status });
}
