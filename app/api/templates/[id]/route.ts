import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';

const schema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['reminder', 'confirmation', 'general', 'account_information']).optional(),
  body: z.string().min(1).max(4096).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const template = await prisma.messageTemplate.update({ where: { id }, data: input });
    return NextResponse.json({ template });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const template = await prisma.messageTemplate.findUniqueOrThrow({ where: { id } });
    if (template.isDefault) {
      return NextResponse.json({ error: 'Default templates cannot be deleted.' }, { status: 400 });
    }
    await prisma.messageTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
