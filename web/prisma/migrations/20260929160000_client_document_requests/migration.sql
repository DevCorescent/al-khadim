-- CreateEnum
CREATE TYPE "ClientDocumentStatus" AS ENUM ('REQUESTED', 'UPLOADED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "client_document_requests" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ClientDocumentStatus" NOT NULL DEFAULT 'REQUESTED',
    "filePath" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "uploadedByClientUserId" TEXT,
    "uploadedByName" TEXT,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_document_requests_clientId_createdAt_idx" ON "client_document_requests"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "client_document_requests_status_idx" ON "client_document_requests"("status");

-- AddForeignKey
ALTER TABLE "client_document_requests" ADD CONSTRAINT "client_document_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_document_requests" ADD CONSTRAINT "client_document_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_document_requests" ADD CONSTRAINT "client_document_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
