-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'COMPLETED', 'UNDONE');

-- AlterTable ImportJob
ALTER TABLE "ImportJob" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "ImportJob" ADD COLUMN "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ImportJob" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable Asset
ALTER TABLE "Asset" ADD COLUMN "importJobId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_importJobId_idx" ON "Asset"("importJobId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
