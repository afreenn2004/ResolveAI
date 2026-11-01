
import "dotenv/config";
import { createHash } from "crypto";
import { PrismaClient } from "../lib/generated/prisma/client";

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

  const agreementHash = createHash("sha256")
    .update(JSON.stringify(agreementDetails))
    .digest("hex");

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
