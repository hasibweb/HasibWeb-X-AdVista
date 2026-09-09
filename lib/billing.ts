import { BillStatus, Prisma } from '@prisma/client';

export const money = new Intl.NumberFormat('en-US');

export function normalizeMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Month must use YYYY-MM format.');
  }
  return month;
}

export function prettyMonth(month: string) {
  normalizeMonth(month);
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function resolveBillStatus(totalAmount: number, paidAmount: number, existing: BillStatus = 'due') {
  if (existing === 'waived') return 'waived';
  if (paidAmount <= 0) return 'due';
  if (paidAmount >= totalAmount) return 'paid';
  return 'partial';
}

export function paidAmount(payments: Array<{ amount: number }>) {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export type BillWithClient = Prisma.MonthlyBillGetPayload<{
  include: {
    payments: true;
    client: { include: { sites: true } };
  };
}>;

export function buildTemplateContext(
  bill: BillWithClient,
  settings: { crmName?: string | null; clientDashboardLink?: string | null; previousDueAmount?: number } = {},
) {
  const paid = paidAmount(bill.payments);
  const activeSites = bill.client.sites.filter((site) => site.isActive);
  const billPerMonth = bill.client.monthlyBill;
  const previousDueAmount = Math.max(settings.previousDueAmount ?? bill.totalAmount - paid, 0);
  const valueOrFallback = (value?: string | null) => value?.trim() || 'N/A';

  return {
    client_name: valueOrFallback(bill.client.name),
    month: prettyMonth(bill.month),
    total_bill: money.format(billPerMonth + previousDueAmount),
    bill_per_month: money.format(billPerMonth),
    domains: activeSites.map((site) => site.domain).join(', ') || 'N/A',
    payment_status: bill.status,
    paid_amount: money.format(paid),
    due_amount: money.format(previousDueAmount),
    crm_temporary_password: valueOrFallback(bill.client.crmTemporaryPassword),
    crm_name: valueOrFallback(settings.crmName),
    client_dashboard_link: valueOrFallback(settings.clientDashboardLink),
    phone: valueOrFallback(bill.client.whatsapp),
    email: valueOrFallback(bill.client.email),
  };
}

export function renderTemplate(body: string, context: Record<string, string>) {
  return body.replace(/\{([a-z_]+)\}/g, (_, key: string) => context[key] ?? '');
}
