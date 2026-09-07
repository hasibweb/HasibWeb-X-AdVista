import { NextResponse } from 'next/server';
import { createAdminSession, verifyPassword } from '@/lib/auth';
import { jsonError } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    if (!body.password || !verifyPassword(body.password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
    await createAdminSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, 500);
  }
}
