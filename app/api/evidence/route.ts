
import { NextRequest, NextResponse } from "next/server";
import { validateAndSaveEvidence } from "@/lib/evidence-validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { milestoneId, content, submittedBy } = body;

    if (
      typeof milestoneId !== "string" ||
      typeof content !== "string" ||
      !milestoneId.trim() ||
      !content.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Milestone ID and evidence content are required.",
        },
        { status: 400 }
      );
    }

    if (
      submittedBy !== undefined &&
      typeof submittedBy !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid submitter.",
        },
        { status: 400 }
      );
    }

    const result = await validateAndSaveEvidence({
      milestoneId,
      content,
      submittedBy,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Evidence submission failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Evidence submission failed.";

    const status = message === "Milestone not found." ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status }
    );
  }
}
