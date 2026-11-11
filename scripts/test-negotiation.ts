import {
  runNegotiation,
} from "../lib/negotiation";

async function main() {
  const result = await runNegotiation({
    agreementTitle: "Research Brief",
    totalBudgetCents: 3000,
    milestoneTitle: "Research and Sources",
    milestoneAmountCents: 1000,
    milestoneDescription:
      "Deliver the required research sections and at least two relevant citations.",
    deliveryProblem:
      "The seller missed the required Sources section and needs additional time to complete it.",
    sellerRequestedExtraCents: 500,
  });

  console.log("\n========== NEGOTIATION RESULT ==========\n");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n========== SAFETY CHECK ==========\n");
  console.log("Approved extra fees:", result.approvedExtraCents);
  console.log("Original milestone amount:", result.originalMilestoneAmountCents);
  console.log("Negotiation rounds:", result.roundsCompleted);
  console.log("Final status:", result.status);
}

main().catch((error) => {
  console.error("Negotiation test failed:", error);
  process.exitCode = 1;
});