
import "dotenv/config";
import { createAgreementHash } from "../lib/agreement-hash";
import { PrismaClient } from "../lib/generated/prisma/client";
import { appendAuditEvent } from "../lib/audit";

const prisma = new PrismaClient();

async function main() {
  const agreementDetails = {
    id: "resolveai-demo-agreement",
    title: "Research Brief",
    buyerName: "Demo Buyer",
    sellerName: "Demo Seller",
    totalAmount: 3000,
    currency: "USD",
    milestones: [
      {
        sequence: 1,
        title: "Research and Source Collection",
        description: "Collect relevant sources and research material.",
        amount: 1000,
      },
      {
        sequence: 2,
        title: "Analysis and Findings",
        description: "Analyze the research and present key findings.",
        amount: 1000,
      },
      {
        sequence: 3,
        title: "Final Report and Recommendations",
        description: "Deliver the final report with recommendations.",
        amount: 1000,
      },
    ],
  };

  const agreementHash = createAgreementHash(agreementDetails);

  const agreement = await prisma.agreement.upsert({
    where: { id: agreementDetails.id },
    update: {},
    create: {
      id: agreementDetails.id,
      title: agreementDetails.title,
      buyerName: agreementDetails.buyerName,
      sellerName: agreementDetails.sellerName,
      totalAmount: agreementDetails.totalAmount,
      currency: agreementDetails.currency,
      agreementHash,
      milestones: {
        create: agreementDetails.milestones,
      },
    },
    include: {
      milestones: {
        orderBy: { sequence: "asc" },
      },
    },
  });

  // Record agreement creation only once, even if the seed runs again.
  const existingCreationEvent = await prisma.auditEvent.findFirst({
    where: {
      agreementId: agreement.id,
      eventType: "AGREEMENT_CREATED",
    },
  });

  if (!existingCreationEvent) {
    await appendAuditEvent({
      agreementId: agreement.id,
      eventType: "AGREEMENT_CREATED",
      details: {
        title: agreement.title,
        buyerName: agreement.buyerName,
        sellerName: agreement.sellerName,
        totalAmount: agreement.totalAmount,
        currency: agreement.currency,
        agreementHash: agreement.agreementHash,
        milestoneCount: agreement.milestones.length,
      },
    });

    console.log("Agreement creation audit event recorded.");
  } else {
    console.log("Agreement creation audit event already exists.");
  }

  console.log("ResolveAI demo agreement ready.");
  console.log("Agreement:", agreement.title);
  console.log("Total: $30.00 USD");
  console.log("Milestones:", agreement.milestones.length);

  for (const milestone of agreement.milestones) {
    console.log(
      `${milestone.sequence}. ${milestone.title} - $${(milestone.amount / 100).toFixed(2)}`
    );
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
