import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

const prisma = new PrismaClient();

async function main() {
  await prisma.messageTemplate.upsert({
    where: { id: 'default-reminder' },
    create: {
      id: 'default-reminder',
      name: 'Monthly bill reminder',
      type: 'reminder',
      isDefault: true,
      body:
        'Assalamu Alaikum {client_name},\n\nYour hosting bill for {month} is {total_bill} BDT.\nDomains: {domains}\nPaid: {paid_amount} BDT\nDue: {due_amount} BDT\n\nPlease pay at your convenience. Thank you.\nHasibWeb X AdVista',
    },
    update: {},
  });

  await prisma.messageTemplate.upsert({
    where: { id: 'default-confirmation' },
    create: {
      id: 'default-confirmation',
      name: 'Payment confirmation',
      type: 'confirmation',
      isDefault: true,
      body:
        'Assalamu Alaikum {client_name},\n\nPayment received for {month}.\nTotal bill: {total_bill} BDT\nPaid: {paid_amount} BDT\nCurrent status: {payment_status}\n\nThank you.\nHasibWeb X AdVista',
    },
    update: {},
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
