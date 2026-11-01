
import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  appendAuditEvent,
  verifyAuditChain,
} from "../lib/audit";

async function main() {
  const testAgreementId = "resolveai-audit-test";

  // Remove leftovers from an earlier test, if any.
  await prisma.auditEvent.deleteMany({
    where: { agreementId: testAgreementId },
  });

  await prisma.agreement.deleteMany({
    where: { id: testAgreementId },
  });

  try {
    await prisma.agreement.create({
      data: {
        id: testAgreementId,
        title: "Temporary Audit Test",
        buyerName: "Test Buyer",
        sellerName: "Test Seller",
        totalAmount: 2000,
        currency: "USD",
        agreementHash: "temporary-test-hash",
      },
    });

    await appendAuditEvent({
      agreementId: testAgreementId,
      eventType: "TEST_EVENT_ONE",
      details: { message: "First test event" },
    });

    await appendAuditEvent({
      agreementId: testAgreementId,
      eventType: "TEST_EVENT_TWO",
      details: { message: "Second test event" },
    });

    // Deliberately modify the first event to simulate tampering.
const firstEvent = await prisma.auditEvent.findFirst({
  where: { agreementId: testAgreementId },
  orderBy: [
    { createdAt: "asc" },
    { id: "asc" },
  ],
});

if (!firstEvent) {
  throw new Error("First audit event was not found.");
}

await prisma.auditEvent.update({
  where: { id: firstEvent.id },
  data: {
    details: JSON.stringify({
      message: "This record has been tampered with.",
    }),
  },
});

// Verify that the tampering is detected.
const result = await verifyAuditChain(testAgreementId);

console.log("Tampering verification result:");
console.log(result);

if (result.valid || result.failedEventId !== firstEvent.id) {
  throw new Error("Audit tampering test failed.");
}

console.log("SUCCESS: Audit tampering was detected.");
  } finally {
    await prisma.auditEvent.deleteMany({
      where: { agreementId: testAgreementId },
    });

    await prisma.agreement.deleteMany({
      where: { id: testAgreementId },
    });
  }
}

main()
  .catch((error) => {
    console.error("Audit test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
