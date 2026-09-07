import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { paidAmount, resolveBillStatus } from '@/lib/billing';
import { prisma } from '@/lib/db';

const schema = z.object({
  billIds: z.array(z.string().min(1)).min(1),
  note: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const input = schema.parse(await request.json());
    const uniqueBillIds = [...new Set(input.billIds)];
    const cleanNote = input.note?.trim() || 'Marked as paid from Bills page';

    const result = await prisma.$transaction(async (tx) => {
      const bills = await tx.monthlyBill.findMany({
        where: { id: { in: uniqueBillIds } },
        include: { payments: true },
      });

      let paidCount = 0;
      for (const bill of bills) {
        const paid = paidAmount(bill.payments);
        const due = Math.max(bill.totalAmount - paid, 0);
        if (due <= 0) continue;

        await tx.payment.create({
          data: {
            billId: bill.id,
            amount: due,
            note: cleanNote,
          },
        });

        const nextPaid = paid + due;
        await tx.monthlyBill.update({
          where: { id: bill.id },
          data: { status: resolveBillStatus(bill.totalAmount, nextPaid, bill.status) },
        });
        paidCount += 1;
      }

      return { requested: uniqueBillIds.length, paid: paidCount };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
