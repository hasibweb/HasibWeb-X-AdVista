import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { buildTemplateContext, normalizeMonth, paidAmount, renderTemplate } from '@/lib/billing';
import { prisma } from '@/lib/db';
import { toChatId } from '@/lib/whatsapp';

const schema = z.object({
  month: z.string(),
  templateId: z.string(),
  type: z.enum(['reminder', 'confirmation', 'general', 'account_information']).default('reminder'),
  clientIds: z.array(z.string().min(1)).min(1, 'Select at least one client.'),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const input = schema.parse(await request.json());
    const month = normalizeMonth(input.month);
    const template = await prisma.messageTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ['CRM_NAME', 'CLIENT_DASHBOARD_LINK'] } },
    });
    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
    const templateSettings = {
      crmName: settingMap.get('CRM_NAME'),
      clientDashboardLink: settingMap.get('CLIENT_DASHBOARD_LINK'),
    };
    const bills = await prisma.monthlyBill.findMany({
      where: {
        month,
        client: { isActive: true },
        clientId: { in: input.clientIds },
      },
      include: {
        payments: true,
        client: { include: { sites: { where: { isActive: true }, orderBy: { domain: 'asc' } } } },
      },
      orderBy: { client: { name: 'asc' } },
    });
    const previousBills = await prisma.monthlyBill.findMany({
      where: {
        month: { lt: month },
        status: { in: ['due', 'partial'] },
        clientId: { in: input.clientIds },
      },
      include: { payments: true },
    });
    const previousDueByClientId = previousBills.reduce((totals, bill) => {
      const due = Math.max(bill.totalAmount - paidAmount(bill.payments), 0);
      if (due > 0) {
        totals.set(bill.clientId, (totals.get(bill.clientId) || 0) + due);
      }
      return totals;
    }, new Map<string, number>());

    const messages = [];
    for (const bill of bills) {
      const idempotencyKey = `advista:${input.type}:${month}:${bill.clientId}`;
      const body = renderTemplate(
        template.body,
        buildTemplateContext(bill, {
          ...templateSettings,
          previousDueAmount: previousDueByClientId.get(bill.clientId) || 0,
        }),
      );
      const message = await prisma.waMessage.upsert({
        where: { idempotencyKey },
        create: {
          clientId: bill.clientId,
          billId: bill.id,
          templateId: template.id,
          month,
          type: input.type,
          chatId: toChatId(bill.client.whatsapp),
          body,
          idempotencyKey,
          status: 'draft',
        },
        update: {
          templateId: template.id,
          body,
          selected: true,
          error: null,
          status: 'draft',
        },
        include: { client: true, bill: true, template: true },
      });
      messages.push(message);
    }

    return NextResponse.json({ generated: messages.length, messages });
  } catch (error) {
    return jsonError(error);
  }
}
