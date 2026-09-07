import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';

const updateSchema = z.object({
  domain: z.string().min(2).optional(),
  serverLabel: z.string().optional().nullable(),
  monthlyBill: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    const site = await prisma.site.update({
      where: { id },
      data: { ...input, serverLabel: input.serverLabel === '' ? null : input.serverLabel },
    });
    return NextResponse.json({ site });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    await prisma.site.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
