
import {
  runBuyerAgent,
  runSellerAgent,
  type AgentContext,
} from "../lib/agents";

async function main() {
  const context: AgentContext = {
    agreementTitle: "Research Brief",
    totalBudgetCents: 3000,
    milestoneTitle: "Research and Sources",
    milestoneAmountCents: 1000,
    milestoneDescription:
      "Deliver the required research sections and at least two relevant citations.",
    deliveryProblem:
      "The seller missed the required Sources section and needs additional time to complete it.",
    sellerRequestedExtraCents: 500,
  };

  console.log("\n========== SELLER AGENT ==========\n");

  const sellerProposal = await runSellerAgent(context);

  console.log(JSON.stringify(sellerProposal, null, 2));

  console.log("\n========== BUYER AGENT ==========\n");

  const buyerDecision = await runBuyerAgent(
    context,
    sellerProposal
  );

  console.log(JSON.stringify(buyerDecision, null, 2));

  console.log("\n========== TEST COMPLETE ==========\n");
}

main().catch((error) => {
  console.error("Agent test failed:", error);
  process.exitCode = 1;
});
