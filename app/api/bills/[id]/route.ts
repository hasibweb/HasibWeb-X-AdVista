import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';

const schema = z.object({
  status: z.enum(['due', 'partial', 'paid']).optional(),
  note: z.string().nullable().optional(),
  followUpStatus: z.enum(['message_send', 'pay_later', 'partially_paid']).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const bill = await prisma.monthlyBill.update({ where: { id }, data: input });
    return NextResponse.json({ bill });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    await prisma.monthlyBill.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
