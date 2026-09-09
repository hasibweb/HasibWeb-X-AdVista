ALTER TABLE "Client" ADD COLUMN "monthlyBill" INTEGER NOT NULL DEFAULT 0;

UPDATE "Client"
SET "monthlyBill" = COALESCE((
  SELECT SUM("monthlyBill")
  FROM "Site"
  WHERE "Site"."clientId" = "Client"."id"
    AND "Site"."isActive" = true
), 0);
