
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendAuditEventInTransaction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    let body: { milestoneId?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const { milestoneId } = body;

    if (
      typeof milestoneId !== "string" ||
      !milestoneId.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid milestone ID is required.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const milestone = await tx.milestone.findUnique({
        where: { id: milestoneId },
        select: {
          id: true,
          agreementId: true,
          evidenceValidated: true,
          buyerAcceptedAt: true,
          capturedAmount: true,
          capturedAt: true,
        },
      });

      if (!milestone) {
        return {
          success: false,
          httpStatus: 404,
          message: "Milestone not found.",
        };
      }

      // Repeated acceptance requests must not create duplicate events.
      if (milestone.buyerAcceptedAt) {
        return {
          success: true,
          httpStatus: 200,
          alreadyAccepted: true,
          buyerAcceptedAt: milestone.buyerAcceptedAt,
          message: "Buyer acceptance was already recorded.",
        };
      }

      // Evidence must pass validation before buyer acceptance.
      if (!milestone.evidenceValidated) {
        return {
          success: false,
          httpStatus: 409,
          message:
            "Evidence must pass validation before the buyer can accept this milestone.",
        };
      }

      // Do not accept a milestone that has already been paid.
      if (
        milestone.capturedAmount > 0 ||
        milestone.capturedAt !== null
      ) {
        return {
          success: false,
          httpStatus: 409,
          message:
            "This milestone already has a recorded payment capture.",
        };
      }

      const acceptedAt = new Date();

      // Conditional update prevents overwriting an existing acceptance.
      const update = await tx.milestone.updateMany({
        where: {
          id: milestone.id,
          buyerAcceptedAt: null,
          evidenceValidated: true,
          capturedAmount: 0,
          capturedAt: null,
        },
        data: {
          buyerAcceptedAt: acceptedAt,
        },
      });

      if (update.count !== 1) {
        return {
          success: false,
          httpStatus: 409,
          message:
            "The milestone changed while acceptance was being recorded. Please review it again.",
        };
      }

      // Record acceptance in the same database transaction.
      await appendAuditEventInTransaction(tx, {
        agreementId: milestone.agreementId,
        milestoneId: milestone.id,
        eventType: "BUYER_ACCEPTANCE_RECORDED",
        details: {
          acceptedAt: acceptedAt.toISOString(),
          acceptanceMethod: "DEMO_BUYER_ACTION",
        },
      });

      return {
        success: true,
        httpStatus: 200,
        alreadyAccepted: false,
        buyerAcceptedAt: acceptedAt,
        message:
          "Buyer acceptance recorded successfully. Payment safety checks are still required before capture.",
      };
    });

    const { httpStatus, ...response } = result;

    return NextResponse.json(response, {
      status: httpStatus,
    });
  } catch (error) {
    console.error("Buyer acceptance failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to record buyer acceptance.",
      },
      { status: 500 }
    );
  }
}
