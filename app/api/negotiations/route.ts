
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runNegotiation } from "@/lib/negotiation";
import { appendAuditEvent } from "@/lib/audit";

const DEMO_AGREEMENT_ID = "resolveai-demo-agreement";

export async function POST(request: Request) {
  let agreementId: string | undefined;
  let milestoneId: string | undefined;

  try {
    const body: unknown = await request.json();

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    if (
      typeof input.milestoneId !== "string" ||
      input.milestoneId.trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, message: "A milestone ID is required." },
        { status: 400 }
      );
    }

    if (
      typeof input.deliveryProblem !== "string" ||
      input.deliveryProblem.trim().length === 0 ||
      input.deliveryProblem.length > 3000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Delivery problem must contain 1–3000 characters.",
        },
        { status: 400 }
      );
    }

    const sellerRequestedExtraCents =
      input.sellerRequestedExtraCents ?? 500;

    if (
      typeof sellerRequestedExtraCents !== "number" ||
      !Number.isSafeInteger(sellerRequestedExtraCents) ||
      sellerRequestedExtraCents < 0 ||
      sellerRequestedExtraCents > 1000000
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid seller fee request." },
        { status: 400 }
      );
    }

    milestoneId = input.milestoneId.trim();

    const agreement = await prisma.agreement.findUnique({
      where: {
        id: DEMO_AGREEMENT_ID,
      },
      include: {
        milestones: {
          orderBy: {
            sequence: "asc",
          },
        },
      },
    });

    if (!agreement) {
      return NextResponse.json(
        { success: false, message: "Demo agreement not found." },
        { status: 404 }
      );
    }

    agreementId = agreement.id;

    const milestone = agreement.milestones.find(
      (item) => item.id === milestoneId
    );

    if (!milestone) {
      return NextResponse.json(
        {
          success: false,
          message: "Milestone not found in this agreement.",
        },
        { status: 404 }
      );
    }

    await appendAuditEvent({
      agreementId: agreement.id,
      milestoneId: milestone.id,
      eventType: "NEGOTIATION_STARTED",
      details: {
        milestoneTitle: milestone.title,
        deliveryProblem: input.deliveryProblem.trim(),
        sellerRequestedExtraCents,
        agreementHash: agreement.agreementHash,
      },
    });

    const result = await runNegotiation({
      agreementTitle: agreement.title,
      totalBudgetCents: agreement.totalAmount,
      milestoneTitle: milestone.title,
      milestoneAmountCents: milestone.amount,
      milestoneDescription: milestone.description,
      deliveryProblem: input.deliveryProblem.trim(),
      sellerRequestedExtraCents,
    });

    for (const round of result.rounds) {
      await appendAuditEvent({
        agreementId: agreement.id,
        milestoneId: milestone.id,
        eventType: "NEGOTIATION_ROUND_COMPLETED",
        details: {
          round: round.round,
          sellerProposal: round.sellerProposal,
          buyerDecision: round.buyerDecision,
        },
      });
    }

    await appendAuditEvent({
      agreementId: agreement.id,
      milestoneId: milestone.id,
      eventType: "NEGOTIATION_FINISHED",
      details: {
        status: result.status,
        roundsCompleted: result.roundsCompleted,
        approvedExtraCents: result.approvedExtraCents,
        originalMilestoneAmountCents:
          result.originalMilestoneAmountCents,
        finalPlan: result.finalPlan,
        summary: result.summary,
        agreementChanged: false,
        paymentAuthorized: false,
        buyerAcceptanceRecorded: false,
      },
    });

    return NextResponse.json({
      success: true,
      agreementChanged: false,
      paymentAuthorized: false,
      buyerAcceptanceRecorded: false,
      result,
    });
  } catch (error) {
    console.error("Negotiation API failed:", error);

    if (agreementId) {
      try {
        await appendAuditEvent({
          agreementId,
          milestoneId,
          eventType: "NEGOTIATION_FAILED",
          details: {
            reason:
              error instanceof Error
                ? error.message
                : "Unknown negotiation error",
            paymentAuthorized: false,
            agreementChanged: false,
          },
        });
      } catch (auditError) {
        console.error(
          "Failed to record negotiation error:",
          auditError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Negotiation could not be completed. No payment was authorized.",
      },
      { status: 500 }
    );
  }
}
