import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api';
import { normalizeMonth } from '@/lib/billing';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const url = new URL(request.url);
  const month = normalizeMonth(url.searchParams.get('month') || new Date().toISOString().slice(0, 7));
  const messages = await prisma.waMessage.findMany({
    where: { month },
    orderBy: { createdAt: 'desc' },
    include: {
      client: { include: { sites: { where: { isActive: true }, orderBy: { domain: 'asc' } } } },
      bill: { include: { payments: true } },
      template: true,
    },
  });
  return NextResponse.json({ messages });
}
