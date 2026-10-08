-- Phase 6 performance indexes for dashboard / reports / needs-review
CREATE INDEX IF NOT EXISTS "Asset_warrantyExpiry_idx" ON "Asset"("warrantyExpiry");
CREATE INDEX IF NOT EXISTS "Asset_createdAt_idx" ON "Asset"("createdAt");
CREATE INDEX IF NOT EXISTS "Asset_departmentId_deletedAt_needsReview_idx" ON "Asset"("departmentId", "deletedAt", "needsReview");

-- Optional trigram indexes for ILIKE search (Neon / Postgres)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Asset_assetTag_trgm_idx" ON "Asset" USING GIN ("assetTag" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Asset_serialNumber_trgm_idx" ON "Asset" USING GIN ("serialNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Asset_assignedToText_trgm_idx" ON "Asset" USING GIN ("assignedToText" gin_trgm_ops);
