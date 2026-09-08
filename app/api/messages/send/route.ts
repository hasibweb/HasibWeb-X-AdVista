import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';
import { HasibWebWaClient } from '@/lib/whatsapp';

const schema = z.object({
  messageIds: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const input = schema.parse(await request.json());
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ['HASIBWEB_WA_API_KEY', 'HASIBWEB_WA_SESSION_ID'] } },
    });
    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
    const wa = new HasibWebWaClient({
      apiKey: settingMap.get('HASIBWEB_WA_API_KEY'),
      sessionId: settingMap.get('HASIBWEB_WA_SESSION_ID'),
    });
    const results = [];

    for (const id of input.messageIds) {
      const message = await prisma.waMessage.findUniqueOrThrow({ where: { id } });
      if (!message.selected) continue;

      await prisma.waMessage.update({ where: { id }, data: { status: 'sending', error: null } });

      try {
        const result = await wa.sendText({
          chatId: message.chatId,
          text: message.body,
          idempotencyKey: message.idempotencyKey,
        });
        const updated = await prisma.waMessage.update({
          where: { id },
          data: {
            status: 'sent',
            selected: false,
            waMessageId: result.messageId,
            waTimestamp: result.timestamp,
            sentAt: new Date(),
          },
        });
        results.push({ id, status: updated.status });
      } catch (error) {
        const updated = await prisma.waMessage.update({
          where: { id },
          data: { status: 'failed', error: error instanceof Error ? error.message : 'Send failed' },
        });
        results.push({ id, status: updated.status, error: updated.error });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return jsonError(error);
  }
}
