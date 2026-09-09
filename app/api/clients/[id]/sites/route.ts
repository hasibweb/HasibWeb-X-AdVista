import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';

const siteSchema = z.object({
  domain: z.string().min(2),
  serverLabel: z.string().optional().nullable(),
  monthlyBill: z.coerce.number().int().min(0).optional().default(0),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const { id } = await context.params;
    const input = siteSchema.parse(await request.json());
    const site = await prisma.site.create({
      data: {
        clientId: id,
        domain: input.domain,
        serverLabel: input.serverLabel || null,
        monthlyBill: 0,
      },
    });
    return NextResponse.json({ site }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
