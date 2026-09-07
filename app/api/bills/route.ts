import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api';
import { normalizeMonth, paidAmount } from '@/lib/billing';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const month = normalizeMonth(url.searchParams.get('month') || new Date().toISOString().slice(0, 7));
  const bills = await prisma.monthlyBill.findMany({
    where: scope === 'due' ? { status: { in: ['due', 'partial'] } } : { month },
    orderBy: scope === 'due' ? [{ month: 'asc' }, { client: { name: 'asc' } }] : { client: { name: 'asc' } },
    include: {
      client: { include: { sites: { orderBy: { domain: 'asc' } } } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
  });

  const billsWithAmounts = bills.map((bill) => {
    const paid = paidAmount(bill.payments);
    return {
      ...bill,
      paidAmount: paid,
      dueAmount: Math.max(bill.totalAmount - paid, 0),
    };
  });

  return NextResponse.json({
    bills: scope === 'due' ? billsWithAmounts.filter((bill) => bill.dueAmount > 0) : billsWithAmounts,
  });
}
