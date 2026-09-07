ALTER TYPE "TemplateType" ADD VALUE 'account_information';

ALTER TABLE "Client" ADD COLUMN "crmTemporaryPassword" TEXT;
