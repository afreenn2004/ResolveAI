
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuditChain } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const agreementId = request.nextUrl.searchParams.get("agreementId");

    if (!agreementId) {
      return NextResponse.json(
        {
          success: false,
          message: "An agreementId query parameter is required.",
        },
        { status: 400 }
      );
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      select: { id: true },
    });

    if (!agreement) {
      return NextResponse.json(
        { success: false, message: "Agreement not found." },
        { status: 404 }
      );
    }

    const [events, verification] = await Promise.all([
      prisma.auditEvent.findMany({
        where: { agreementId },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      }),
      verifyAuditChain(agreementId),
    ]);

    return NextResponse.json({
      success: true,
      agreementId,
      verification,
      events,
    });
  } catch (error) {
    console.error("Failed to retrieve audit trail:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve the audit trail.",
      },
      { status: 500 }
    );
  }
}
