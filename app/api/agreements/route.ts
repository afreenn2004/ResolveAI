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
        },
      },
    });

    if (!agreement) {
      return NextResponse.json(
        { success: false, message: "Demo agreement not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      agreement,
    });
  } catch (error) {
    console.error("Failed to fetch agreement:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch agreement." },
      { status: 500 }
    );
  }
}