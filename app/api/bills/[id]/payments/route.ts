import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { paidAmount, resolveBillStatus } from '@/lib/billing';
import { prisma } from '@/lib/db';

const schema = z.object({
  amount: z.coerce.number().int().positive(),
  paidAt: z.string().optional(),
  method: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          billId: id,
          amount: input.amount,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          method: input.method || null,
          note: input.note || null,
        },
      });
      const bill = await tx.monthlyBill.findUniqueOrThrow({
        where: { id },
        include: { payments: true },
      });
      const status = resolveBillStatus(bill.totalAmount, paidAmount(bill.payments), bill.status);
      const updatedBill = await tx.monthlyBill.update({ where: { id }, data: { status } });
      return { payment, bill: updatedBill };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
