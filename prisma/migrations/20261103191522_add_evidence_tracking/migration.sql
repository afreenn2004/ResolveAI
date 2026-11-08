-- CreateTable
CREATE TABLE "EvidenceSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "milestoneId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL DEFAULT 'SELLER_AGENT',
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceSubmission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceValidation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "validatorVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceValidation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "EvidenceSubmission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EvidenceSubmission_milestoneId_createdAt_idx" ON "EvidenceSubmission"("milestoneId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceSubmission_milestoneId_contentHash_idx" ON "EvidenceSubmission"("milestoneId", "contentHash");

-- CreateIndex
CREATE INDEX "EvidenceValidation_submissionId_createdAt_idx" ON "EvidenceValidation"("submissionId", "createdAt");
