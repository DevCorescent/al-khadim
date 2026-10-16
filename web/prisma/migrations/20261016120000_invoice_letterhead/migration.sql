-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "from_date" DATE,
ADD COLUMN     "to_date" DATE;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "bank_account_name" TEXT,
ADD COLUMN     "bank_branch" TEXT,
ADD COLUMN     "billing_tax_no" TEXT,
ADD COLUMN     "design_options" JSONB,
ADD COLUMN     "from_email_alt" TEXT,
ADD COLUMN     "from_website" TEXT,
ADD COLUMN     "payment_terms" TEXT;

