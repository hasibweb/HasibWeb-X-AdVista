import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { normalizeMonth, paidAmount } from '@/lib/billing';
import { prisma } from '@/lib/db';

const schema = z.object({
  month: z.string(),
  amount: z.coerce.number().int().positive(),
  note: z.string().optional().nullable(),
});

const currentMonth = new Date().toISOString().slice(0, 7);

function resolveStatus(totalAmount: number, paid: number) {
  if (paid <= 0) return 'due';
  if (paid >= totalAmount) return 'paid';
  return 'partial';
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const month = normalizeMonth(input.month);
    if (month >= currentMonth) {
      throw new Error('Manual due bills can only be added for previous months.');
    }

    const cleanNote = input.note?.trim() || null;

    const bill = await prisma.$transaction(async (tx) => {
      const existing = await tx.monthlyBill.findUnique({
        where: { clientId_month: { clientId: id, month } },
        include: { payments: true },
      });

      if (!existing) {
        return tx.monthlyBill.create({
          data: {
            clientId: id,
            month,
            totalAmount: input.amount,
            status: 'due',
            note: cleanNote,
          },
        });
      }

      const nextTotal = existing.totalAmount + input.amount;
      const nextNote = [existing.note, cleanNote].filter(Boolean).join('\n');

      return tx.monthlyBill.update({
        where: { id: existing.id },
        data: {
          totalAmount: nextTotal,
          status: resolveStatus(nextTotal, paidAmount(existing.payments)),
          note: nextNote || null,
        },
      });
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
