import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { normalizeMonth, paidAmount } from '@/lib/billing';
import { prisma } from '@/lib/db';
import { toChatId } from '@/lib/whatsapp';

const siteSchema = z.object({
  domain: z.string().min(2),
  serverLabel: z.string().optional().nullable(),
  monthlyBill: z.coerce.number().int().min(0).optional().default(0),
});

const clientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  whatsapp: z.string().min(8),
  crmTemporaryPassword: z.string().optional().nullable(),
  followUpStatus: z.enum(['message_send', 'pay_later', 'partially_paid']).optional().default('pay_later'),
  monthlyBill: z.coerce.number().int().min(0).optional().default(0),
  clientType: z.enum(['Normal', 'Agency']).optional().default('Normal'),
  notes: z.string().optional().nullable(),
  sites: z.array(siteSchema).default([]),
});

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const url = new URL(request.url);
  const month = normalizeMonth(url.searchParams.get('month') || new Date().toISOString().slice(0, 7));
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      sites: { orderBy: { createdAt: 'asc' } },
      bills: {
        where: { status: { in: ['due', 'partial'] } },
        orderBy: { month: 'asc' },
        include: { payments: true },
      },
    },
  });

  const clientsWithDue = clients.map((client) => {
    const billPerMonth = client.monthlyBill;
    const dueBills = client.bills
      .map((bill) => {
        const paid = paidAmount(bill.payments);
        return {
          id: bill.id,
          month: bill.month,
          totalAmount: bill.totalAmount,
          paidAmount: paid,
          dueAmount: Math.max(bill.totalAmount - paid, 0),
          status: bill.status,
          note: bill.note,
        };
      })
      .filter((bill) => bill.dueAmount > 0);
    const previousDueAmount = dueBills.filter((bill) => bill.month < month).reduce((sum, bill) => sum + bill.dueAmount, 0);

    return {
      ...client,
      bills: undefined,
      dueBills,
      billPerMonth,
      previousDueAmount,
      totalBillAmount: billPerMonth + previousDueAmount,
      totalDueAmount: dueBills.reduce((sum, bill) => sum + bill.dueAmount, 0),
    };
  });

  return NextResponse.json({ clients: clientsWithDue });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const input = clientSchema.parse(await request.json());
    toChatId(input.whatsapp);

    const client = await prisma.client.create({
      data: {
        name: input.name,
        email: input.email || null,
        whatsapp: input.whatsapp,
        crmTemporaryPassword: input.crmTemporaryPassword || null,
        followUpStatus: input.followUpStatus,
        monthlyBill: input.monthlyBill,
        clientType: input.clientType || 'Normal',
        notes: input.notes || null,
        sites: {
          create: input.sites.map((site) => ({
            domain: site.domain,
            serverLabel: site.serverLabel || null,
            monthlyBill: 0,
          })),
        },
      },
      include: { sites: true },
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
