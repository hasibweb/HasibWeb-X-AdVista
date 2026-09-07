import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireAdmin } from '@/lib/api';
import { prisma } from '@/lib/db';

const defaults = [
  {
    id: 'default-reminder',
    name: 'Monthly bill reminder',
    type: 'reminder' as const,
    isDefault: true,
    body:
      'Assalamu Alaikum {client_name},\n\nYour hosting bill for {month} is {total_bill} BDT.\nDomains: {domains}\nPaid: {paid_amount} BDT\nDue: {due_amount} BDT\n\nPlease pay at your convenience. Thank you.\nHasibWeb X AdVista',
  },
  {
    id: 'default-confirmation',
    name: 'Payment confirmation',
    type: 'confirmation' as const,
    isDefault: true,
    body:
      'Assalamu Alaikum {client_name},\n\nPayment received for {month}.\nTotal bill: {total_bill} BDT\nPaid: {paid_amount} BDT\nCurrent status: {payment_status}\n\nThank you.\nHasibWeb X AdVista',
  },
  {
    id: 'default-account-information',
    name: 'Account information',
    type: 'account_information' as const,
    isDefault: true,
    body:
      'Assalamu Alaikum {client_name},\n\nYour {crm_name} account information:\nDashboard: {client_dashboard_link}\nPhone: {phone}\nEmail: {email}\nTemporary password: {crm_temporary_password}\n\nPlease update your password after logging in.\nHasibWeb X AdVista',
  },
];

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(['reminder', 'confirmation', 'general', 'account_information']).default('reminder'),
  body: z.string().min(1).max(4096),
});

async function ensureDefaultTemplates() {
  for (const template of defaults) {
    await prisma.messageTemplate.upsert({
      where: { id: template.id },
      create: template,
      update: {},
    });
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  await ensureDefaultTemplates();
  const templates = await prisma.messageTemplate.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const input = schema.parse(await request.json());
    const template = await prisma.messageTemplate.create({ data: input });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
