CREATE TYPE "BillStatus" AS ENUM ('due', 'partial', 'paid', 'waived');
CREATE TYPE "MessageStatus" AS ENUM ('draft', 'sending', 'sent', 'failed');
CREATE TYPE "TemplateType" AS ENUM ('reminder', 'confirmation', 'general');

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "whatsapp" TEXT NOT NULL,
  "clientType" TEXT NOT NULL DEFAULT 'Normal',
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Site" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "serverLabel" TEXT,
  "monthlyBill" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyBill" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "status" "BillStatus" NOT NULL DEFAULT 'due',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyBill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TemplateType" NOT NULL DEFAULT 'reminder',
  "body" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaMessage" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "billId" TEXT,
  "templateId" TEXT,
  "month" TEXT NOT NULL,
  "type" "TemplateType" NOT NULL DEFAULT 'reminder',
  "chatId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT true,
  "status" "MessageStatus" NOT NULL DEFAULT 'draft',
  "idempotencyKey" TEXT NOT NULL,
  "waMessageId" TEXT,
  "waTimestamp" INTEGER,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Client_isActive_idx" ON "Client"("isActive");
CREATE INDEX "Client_whatsapp_idx" ON "Client"("whatsapp");
CREATE INDEX "Site_clientId_idx" ON "Site"("clientId");
CREATE INDEX "Site_isActive_idx" ON "Site"("isActive");
CREATE UNIQUE INDEX "MonthlyBill_clientId_month_key" ON "MonthlyBill"("clientId", "month");
CREATE INDEX "MonthlyBill_month_idx" ON "MonthlyBill"("month");
CREATE INDEX "MonthlyBill_status_idx" ON "MonthlyBill"("status");
CREATE INDEX "Payment_billId_idx" ON "Payment"("billId");
CREATE INDEX "MessageTemplate_type_idx" ON "MessageTemplate"("type");
CREATE UNIQUE INDEX "WaMessage_idempotencyKey_key" ON "WaMessage"("idempotencyKey");
CREATE INDEX "WaMessage_month_idx" ON "WaMessage"("month");
CREATE INDEX "WaMessage_status_idx" ON "WaMessage"("status");
CREATE INDEX "WaMessage_clientId_idx" ON "WaMessage"("clientId");

ALTER TABLE "Site" ADD CONSTRAINT "Site_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyBill" ADD CONSTRAINT "MonthlyBill_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "MonthlyBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaMessage" ADD CONSTRAINT "WaMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaMessage" ADD CONSTRAINT "WaMessage_billId_fkey" FOREIGN KEY ("billId") REFERENCES "MonthlyBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaMessage" ADD CONSTRAINT "WaMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
