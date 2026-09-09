import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';
import { toChatId } from '@/lib/whatsapp';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  whatsapp: z.string().min(8).optional(),
  crmTemporaryPassword: z.string().optional().nullable(),
  followUpStatus: z.enum(['message_send', 'pay_later', 'partially_paid']).optional(),
  clientType: z.enum(['Normal', 'Agency']).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    if (input.whatsapp) toChatId(input.whatsapp);

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...input,
        email: input.email === '' ? null : input.email,
        crmTemporaryPassword: input.crmTemporaryPassword || null,
      },
      include: { sites: true },
    });
    return NextResponse.json({ client });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
