-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "auditSequence" INTEGER NOT NULL DEFAULT 0,
    "agreementHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Agreement" ("agreementHash", "buyerName", "createdAt", "currency", "id", "sellerName", "status", "title", "totalAmount", "updatedAt", "version") SELECT "agreementHash", "buyerName", "createdAt", "currency", "id", "sellerName", "status", "title", "totalAmount", "updatedAt", "version" FROM "Agreement";
DROP TABLE "Agreement";
ALTER TABLE "new_Agreement" RENAME TO "Agreement";
CREATE TABLE "new_AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agreementId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "eventType" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "previousHash" TEXT,
    "eventHash" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditEvent" (
    "agreementId",
    "createdAt",
    "details",
    "eventHash",
    "eventType",
    "id",
    "milestoneId",
    "previousHash",
    "sequence"
)
SELECT
    "agreementId",
    "createdAt",
    "details",
    "eventHash",
    "eventType",
    "id",
    "milestoneId",
    "previousHash",
    ROW_NUMBER() OVER (
        PARTITION BY "agreementId"
        ORDER BY "createdAt" ASC, "id" ASC
    )
FROM "AuditEvent";
DROP TABLE "AuditEvent";
ALTER TABLE "new_AuditEvent" RENAME TO "AuditEvent";
UPDATE "Agreement"
SET "auditSequence" = (
    SELECT COUNT(*)
    FROM "AuditEvent"
    WHERE "AuditEvent"."agreementId" = "Agreement"."id"
);
CREATE INDEX "AuditEvent_agreementId_createdAt_idx" ON "AuditEvent"("agreementId", "createdAt");
CREATE UNIQUE INDEX "AuditEvent_agreementId_sequence_key" ON "AuditEvent"("agreementId", "sequence");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
