import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { normalizeMonth } from '@/lib/billing';
import { prisma } from '@/lib/db';

const schema = z.object({ month: z.string() });

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { month } = schema.parse(await request.json());
    const normalizedMonth = normalizeMonth(month);
    const clients = await prisma.client.findMany({
      where: { isActive: true },
    });

    const bills = [];
    for (const client of clients) {
      const totalAmount = client.monthlyBill;
      if (totalAmount <= 0) continue;
      const bill = await prisma.monthlyBill.upsert({
        where: { clientId_month: { clientId: client.id, month: normalizedMonth } },
        create: { clientId: client.id, month: normalizedMonth, totalAmount },
        update: {},
      });
      bills.push(bill);
    }

    return NextResponse.json({ createdOrExisting: bills.length });
  } catch (error) {
    return jsonError(error);
  }
}
