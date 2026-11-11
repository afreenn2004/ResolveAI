
import {
  runBuyerAgent,
  runSellerAgent,
  type AgentContext,
  type BuyerDecision,
  type SellerProposal,
} from "./agents";

export const MAX_NEGOTIATION_ROUNDS = 3;

export interface NegotiationRound {
  round: number;
  sellerProposal: SellerProposal;
  buyerDecision: BuyerDecision;
}

export interface NegotiationResult {
  status:
    | "AGREED"
    | "UNRESOLVED"
    | "HUMAN_REVIEW";

  roundsCompleted: number;
  rounds: NegotiationRound[];

  originalMilestoneAmountCents: number;
  approvedExtraCents: 0;

  finalPlan: string[];
  finalConditions: string[];
  summary: string;
}

export async function runNegotiation(
  context: AgentContext
): Promise<NegotiationResult> {
  const rounds: NegotiationRound[] = [];

  let previousBuyerResponse: string | undefined;
  let finalPlan: string[] = [];
  let finalConditions: string[] = [];
  let finalStatus: NegotiationResult["status"] = "UNRESOLVED";
  let summary = "Negotiation did not reach an agreement.";

  for (
    let round = 1;
    round <= MAX_NEGOTIATION_ROUNDS;
    round++
  ) {
    const sellerContext: AgentContext = {
      ...context,
      previousBuyerResponse,
    };

    const sellerProposal = await runSellerAgent(sellerContext);

    // AI cannot modify the original agreed milestone amount.
    // Requested extra charges are recorded, never approved.
    if (
      sellerProposal.requestedExtraCents >
      context.sellerRequestedExtraCents
    ) {
      finalStatus = "HUMAN_REVIEW";
      summary = "Seller proposal exceeded the originally declared extra-fee request.";
      break;
    }

    const aiBuyerDecision = await runBuyerAgent(
  sellerContext,
  sellerProposal
);

// Deterministic rule: an extra fee is never approved.
const buyerDecision: BuyerDecision =
  sellerProposal.requestedExtraCents > 0
    ? {
        decision: "COUNTER",
        reason:
          `The seller requested an unauthorized extra fee of ${sellerProposal.requestedExtraCents} cents. It cannot be approved under the original agreement.`,
        counterProposal:
          "Remove the additional fee and complete the missing Sources section under the original agreement.",
        conditions: [
          "No additional fees",
          "Original milestone amount remains unchanged",
          "Complete the missing Sources section",
        ],
      }
    : aiBuyerDecision;

    rounds.push({
      round,
      sellerProposal,
      buyerDecision,
    });

    finalPlan = sellerProposal.deliveryPlan;
    finalConditions = buyerDecision.conditions;

    if (buyerDecision.decision === "HUMAN_REVIEW") {
      finalStatus = "HUMAN_REVIEW";
      summary = buyerDecision.reason;
      break;
    }

    if (buyerDecision.decision === "ACCEPT") {
      // An accepted recovery plan does not authorize payment
      // or change the original agreement.
      finalStatus = "AGREED";
      summary = buyerDecision.reason;
      break;
    }

    if (buyerDecision.decision === "REJECT") {
      finalStatus = "UNRESOLVED";
      summary = buyerDecision.reason;
      break;
    }

    previousBuyerResponse = [
      buyerDecision.reason,
      buyerDecision.counterProposal,
      ...buyerDecision.conditions,
    ].join("\n");
  }

  return {
    status: finalStatus,
    roundsCompleted: rounds.length,
    rounds,
    originalMilestoneAmountCents: context.milestoneAmountCents,
    approvedExtraCents: 0,
    finalPlan,
    finalConditions,
    summary,
  };
}
