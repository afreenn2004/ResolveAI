
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const agreement = await prisma.agreement.findUnique({
      where: {
        id: "resolveai-demo-agreement",
      },
      include: {
        milestones: {
          orderBy: {
            sequence: "asc",
          },
          include: {
            evidenceSubmissions: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              select: {
                status: true,
                validations: {
                  orderBy: {
                    createdAt: "desc",
                  },
                  take: 1,
                  select: {
                    status: true,
                  },
                },
              },
            },
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

    const milestones = agreement.milestones.map(
      ({ evidenceSubmissions, ...milestone }) => ({
        ...milestone,
        evidenceStatus:
          evidenceSubmissions[0]?.validations[0]?.status ??
          evidenceSubmissions[0]?.status ??
          "NOT_SUBMITTED",
      })
    );

    return NextResponse.json({
      success: true,
      agreement: {
        ...agreement,
        milestones,
      },
    });
  } catch (error) {
    console.error("Failed to fetch agreement:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch agreement." },
      { status: 500 }
    );
  }
}
