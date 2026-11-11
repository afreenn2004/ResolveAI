import {
  validateRequiredSections,
  validateCitations,
  containsPromptInjection,
} from "./evidence-rules";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { appendAuditEventInTransaction } from "@/lib/audit";

const VALIDATOR_VERSION = "1.0.0";
const MAX_CONTENT_LENGTH = 20000;

// Demo source fixtures. These are controlled test records,
// not claims that external sources have been independently verified.
const SOURCE_FIXTURES = [
  {
    id: "SRC-001",
    title: "Research Methods and Evidence",
    topics: ["research", "methodology", "evidence", "sources"],
  },
  {
    id: "SRC-002",
    title: "Data Analysis and Interpretation",
    topics: ["data", "analysis", "findings", "statistics"],
  },
  {
    id: "SRC-003",
    title: "Technology and Artificial Intelligence",
    topics: ["technology", "artificial intelligence", "AI", "software"],
  },
  {
    id: "SRC-004",
    title: "Limitations and Research Reliability",
    topics: ["limitations", "reliability", "bias", "quality"],
  },
  {
    id: "SRC-005",
    title: "Recommendations and Decision Making",
    topics: ["recommendations", "decisions", "strategy", "findings"],
  },
] as const;

const MILESTONE_REQUIREMENTS: Record<
  number,
  {
    requiredSections: string[];
    minimumCitations: number;
    minimumLength: number;
    relevanceTerms: string[];
  }
> = {
  1: {
    requiredSections: [
      "Research Questions",
      "Sources",
      "Source Summaries",
    ],
    minimumCitations: 2,
    minimumLength: 300,
    relevanceTerms: [
      "research",
      "source",
      "evidence",
      "methodology",
    ],
  },
  2: {
    requiredSections: [
      "Methodology",
      "Key Findings",
      "Evidence and Limitations",
    ],
    minimumCitations: 2,
    minimumLength: 300,
    relevanceTerms: [
      "analysis",
      "findings",
      "evidence",
      "data",
    ],
  },
  3: {
    requiredSections: [
      "Executive Summary",
      "Findings",
      "Recommendations",
      "References",
    ],
    minimumCitations: 2,
    minimumLength: 300,
    relevanceTerms: [
      "findings",
      "recommendations",
      "research",
      "evidence",
    ],
  },
};

type CheckResult = {
  name: string;
  passed: boolean;
  critical: boolean;
  message: string;
};

type ValidationStatus = "PASS" | "FAIL" | "HUMAN_REVIEW";

function hashContent(content: string): string {
  return createHash("sha256")
    .update(content.trim().replace(/\s+/g, " "))
    .digest("hex");
}

function validateRelevance(
  content: string,
  relevanceTerms: string[]
): CheckResult {
  const normalized = content.toLowerCase();

  const matchingTerms = relevanceTerms.filter((term) =>
    normalized.includes(term.toLowerCase())
  );

  const passed = matchingTerms.length >= 2;

  return {
    name: "CONTENT_RELEVANCE",
    passed,
    critical: true,
    message: passed
      ? `Relevant subject terms found: ${matchingTerms.join(", ")}`
      : "The submission does not contain enough milestone-related subject terms.",
  };
}

function validateSourceFixtureRelevance(
  content: string
): CheckResult {
  const citationIds = [
    ...new Set(
      [...content.matchAll(/\[(SRC-\d{3})\]/g)].map(
        (match) => match[1]
      )
    ),
  ];

  const citedSources = SOURCE_FIXTURES.filter((source) =>
    citationIds.includes(source.id)
  );

  const normalized = content.toLowerCase();

  const relevantSources = citedSources.filter((source) =>
    source.topics.some((topic) =>
      normalized.includes(topic.toLowerCase())
    )
  );

  const passed =
    citedSources.length >= 2 &&
    relevantSources.length >= 2;

  return {
    name: "SOURCE_RELEVANCE",
    passed,
    critical: true,
    message: passed
      ? `${relevantSources.length} cited fixture sources have matching topics.`
      : "At least two cited sources must match topics in the submission.",
  };
}


export async function validateAndSaveEvidence(input: {
  milestoneId: string;
  content: string;
  submittedBy?: string;
}) {
  const content = input.content.trim();

  if (!input.milestoneId || !content) {
    throw new Error("Milestone ID and evidence content are required.");
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(
      `Evidence cannot exceed ${MAX_CONTENT_LENGTH} characters.`
    );
  }

  return await prisma.$transaction(async (tx) => {
    const milestone = await tx.milestone.findUnique({
      where: { id: input.milestoneId },
      include: { agreement: true },
    });

    if (!milestone) {
      throw new Error("Milestone not found.");
    }

    // Acquire the same agreement-level lock used by payment capture.
    const lockResult = await tx.agreement.updateMany({
      where: {
        id: milestone.agreementId,
        captureInProgress: false,
      },
      data: {
        captureInProgress: true,
      },
    });

    if (lockResult.count !== 1) {
      throw new Error(
        "Evidence cannot be changed while payment capture is in progress or requires reconciliation."
      );
    }

    // Recheck payment state after acquiring the lock.
    const currentMilestone = await tx.milestone.findUnique({
      where: { id: input.milestoneId },
    });

    if (!currentMilestone) {
      throw new Error("Milestone not found.");
    }

    if (
      currentMilestone.capturedAmount > 0 ||
      currentMilestone.capturedAt !== null
    ) {
      throw new Error(
        "Evidence cannot be resubmitted after this milestone has been paid."
      );
    }

    const requirements =
      MILESTONE_REQUIREMENTS[currentMilestone.sequence];

    if (!requirements) {
      throw new Error("No validation rules exist for this milestone.");
    }

    const contentHash = hashContent(content);

    const previousSubmission =
      await tx.evidenceSubmission.findFirst({
        where: {
          milestoneId: currentMilestone.id,
          contentHash,
        },
      });

    const checks: CheckResult[] = [];

    checks.push({
      name: "CONTENT_LENGTH",
      passed: content.length >= requirements.minimumLength,
      critical: true,
      message:
        content.length >= requirements.minimumLength
          ? "Minimum content length satisfied."
          : `At least ${requirements.minimumLength} characters are required.`,
    });

    checks.push(
      validateRequiredSections(
        content,
        requirements.requiredSections
      )
    );

    checks.push(
      validateCitations(
        content,
        requirements.minimumCitations
      )
    );

    checks.push(
      validateRelevance(
        content,
        requirements.relevanceTerms
      )
    );

    checks.push(validateSourceFixtureRelevance(content));

    checks.push({
      name: "DUPLICATE_CONTENT",
      passed: !previousSubmission,
      critical: true,
      message: previousSubmission
        ? "This exact normalized submission was already received."
        : "No previous identical submission found.",
    });

    const injectionDetected = containsPromptInjection(content);

    checks.push({
      name: "PROMPT_INJECTION_SCREEN",
      passed: !injectionDetected,
      critical: false,
      message: injectionDetected
        ? "Suspicious instruction-like content detected. Human review required."
        : "No known prompt-injection patterns detected.",
    });

    const criticalFailures = checks.filter(
      (check) => check.critical && !check.passed
    );

    const status: ValidationStatus =
      criticalFailures.length > 0
        ? "FAIL"
        : injectionDetected
          ? "HUMAN_REVIEW"
          : "PASS";

    // Preserve every submission, including rejected attempts.
    const submission = await tx.evidenceSubmission.create({
      data: {
        milestoneId: currentMilestone.id,
        submittedBy: input.submittedBy ?? "SELLER_AGENT",
        content,
        contentHash,
        status,
      },
    });

    const validation = await tx.evidenceValidation.create({
      data: {
        submissionId: submission.id,
        status,
        results: JSON.stringify(checks),
        validatorVersion: VALIDATOR_VERSION,
      },
    });

    // A new passing submission requires fresh buyer acceptance.
    if (status === "PASS") {
      await tx.milestone.update({
        where: { id: currentMilestone.id },
        data: {
          evidenceValidated: true,
          buyerAcceptedAt: null,
        },
      });
    }

    // Append the audit event within the same transaction.
    await appendAuditEventInTransaction(tx, {
      agreementId: currentMilestone.agreementId,
      milestoneId: currentMilestone.id,
      eventType: "EVIDENCE_VALIDATED",
      details: {
        submissionId: submission.id,
        validationId: validation.id,
        status,
        contentHash,
        validatorVersion: VALIDATOR_VERSION,
        failedChecks: checks
          .filter((check) => !check.passed)
          .map((check) => check.name),
      },
    });

    // Release the temporary lock before committing.
    await tx.agreement.update({
      where: { id: currentMilestone.agreementId },
      data: { captureInProgress: false },
    });

    return {
      success: true,
      submissionId: submission.id,
      validationId: validation.id,
      status,
      checks,
      message:
        status === "PASS"
          ? "Evidence passed deterministic validation. Buyer acceptance is still required before payment."
          : status === "FAIL"
            ? "Evidence failed one or more mandatory checks."
            : "Evidence requires human review before it can be accepted.",
    };
  });
}