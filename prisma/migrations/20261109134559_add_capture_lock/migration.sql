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
    "captureInProgress" BOOLEAN NOT NULL DEFAULT false,
    "agreementHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Agreement" ("agreementHash", "auditSequence", "buyerName", "createdAt", "currency", "id", "sellerName", "status", "title", "totalAmount", "updatedAt", "version") SELECT "agreementHash", "auditSequence", "buyerName", "createdAt", "currency", "id", "sellerName", "status", "title", "totalAmount", "updatedAt", "version" FROM "Agreement";
DROP TABLE "Agreement";
ALTER TABLE "new_Agreement" RENAME TO "Agreement";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
