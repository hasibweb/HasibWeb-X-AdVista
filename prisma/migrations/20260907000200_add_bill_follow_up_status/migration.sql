CREATE TYPE "BillFollowUpStatus" AS ENUM ('message_send', 'pay_later', 'partially_paid');

ALTER TABLE "MonthlyBill" ADD COLUMN "followUpStatus" "BillFollowUpStatus" NOT NULL DEFAULT 'pay_later';

CREATE INDEX "MonthlyBill_followUpStatus_idx" ON "MonthlyBill"("followUpStatus");
