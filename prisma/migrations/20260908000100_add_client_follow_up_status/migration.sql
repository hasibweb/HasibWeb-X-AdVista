ALTER TABLE "Client" ADD COLUMN "followUpStatus" "BillFollowUpStatus" NOT NULL DEFAULT 'pay_later';

CREATE INDEX "Client_followUpStatus_idx" ON "Client"("followUpStatus");
