import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';

const schema = z.object({
  body: z.string().min(1).max(4096).optional(),
  selected: z.boolean().optional(),
  status: z.enum(['draft', 'sending', 'sent', 'failed']).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const message = await prisma.waMessage.update({ where: { id }, data: input });
    return NextResponse.json({ message });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const message = await prisma.waMessage.findUniqueOrThrow({ where: { id } });
    if (!['draft', 'failed'].includes(message.status)) {
      return NextResponse.json({ error: 'Only draft or failed messages can be deleted.' }, { status: 400 });
    }

    await prisma.waMessage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
