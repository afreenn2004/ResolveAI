-- CreateTable
CREATE TABLE "PaymentAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agreementId" TEXT NOT NULL,
    "paypalOrderId" TEXT NOT NULL,
    "paypalAuthorizationId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderStatus" TEXT NOT NULL,
    "authorizationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentAuthorization_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agreementId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "authorizationId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "paypalRequestId" TEXT NOT NULL,
    "paypalCaptureId" TEXT,
    "requestDetails" TEXT,
    "responseDetails" TEXT,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentOperation_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentOperation_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaymentOperation_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "PaymentAuthorization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAuthorization_paypalOrderId_key" ON "PaymentAuthorization"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAuthorization_paypalAuthorizationId_key" ON "PaymentAuthorization"("paypalAuthorizationId");

-- CreateIndex
CREATE INDEX "PaymentAuthorization_agreementId_createdAt_idx" ON "PaymentAuthorization"("agreementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOperation_idempotencyKey_key" ON "PaymentOperation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOperation_paypalRequestId_key" ON "PaymentOperation"("paypalRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOperation_paypalCaptureId_key" ON "PaymentOperation"("paypalCaptureId");

-- CreateIndex
CREATE INDEX "PaymentOperation_agreementId_createdAt_idx" ON "PaymentOperation"("agreementId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOperation_milestoneId_idx" ON "PaymentOperation"("milestoneId");

-- CreateIndex
CREATE INDEX "PaymentOperation_authorizationId_idx" ON "PaymentOperation"("authorizationId");
