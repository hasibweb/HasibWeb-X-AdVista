import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api';
import { paidAmount } from '@/lib/billing';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const month = new Date().toISOString().slice(0, 7);
  const [clients, bills, recentMessages, failedMessages] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.monthlyBill.findMany({ where: { month }, include: { payments: true } }),
    prisma.waMessage.findMany({
      take: 8,
      orderBy: { updatedAt: 'desc' },
      include: { client: true },
    }),
    prisma.waMessage.count({ where: { status: 'failed' } }),
  ]);

  const totals = bills.reduce(
    (summary, bill) => {
      const paid = paidAmount(bill.payments);
      summary.total += bill.totalAmount;
      summary.paid += paid;
      summary.due += Math.max(bill.totalAmount - paid, 0);
      summary.statuses[bill.status] += 1;
      return summary;
    },
    { total: 0, paid: 0, due: 0, statuses: { due: 0, partial: 0, paid: 0, waived: 0 } },
  );

  return NextResponse.json({
    month,
    activeClients: clients,
    totals,
    recentMessages,
    failedMessages,
  });
}
