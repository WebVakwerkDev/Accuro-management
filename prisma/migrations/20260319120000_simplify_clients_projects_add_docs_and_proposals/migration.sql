-- CreateEnum
CREATE TYPE "DocScope" AS ENUM ('GENERAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "ProposalDraftStatus" AS ENUM ('DRAFT', 'READY', 'SENT_TO_N8N');

-- AlterTable
ALTER TABLE "clients"
  DROP COLUMN "vatNumber",
  DROP COLUMN "chamberOfCommerceNumber";

-- AlterTable
ALTER TABLE "project_workspaces"
  DROP COLUMN "dueDate";

-- CreateTable
CREATE TABLE "proposal_drafts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "recipientCompany" TEXT,
    "recipientAddress" TEXT,
    "summary" TEXT NOT NULL,
    "scope" TEXT,
    "priceLabel" TEXT,
    "amount" DECIMAL(10,2),
    "deliveryTime" TEXT,
    "notes" TEXT,
    "payloadJson" JSONB,
    "status" "ProposalDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "DocScope" NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_entries" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_folders" ADD CONSTRAINT "doc_folders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_entries" ADD CONSTRAINT "doc_entries_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "doc_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
