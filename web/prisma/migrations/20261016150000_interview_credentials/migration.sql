-- CreateTable
CREATE TABLE "interview_credentials" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "label" TEXT,
    "login_url" TEXT,
    "username_enc" TEXT,
    "password_enc" TEXT,
    "instructions" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "emailed_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interview_credentials_interview_id_key" ON "interview_credentials"("interview_id");

-- CreateIndex
CREATE INDEX "interview_credentials_expires_at_idx" ON "interview_credentials"("expires_at");

-- AddForeignKey
ALTER TABLE "interview_credentials" ADD CONSTRAINT "interview_credentials_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

