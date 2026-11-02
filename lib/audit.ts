
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "./generated/prisma/client";

interface CreateAuditEventInput {
  agreementId: string;
  milestoneId?: string;
  eventType: string;
  details: Record<string, unknown>;
}

function createEventHash(data: {
  agreementId: string;
  milestoneId: string | null;
  eventType: string;
  details: string;
  previousHash: string | null;
  createdAt: Date;
}) {
  const hashInput = JSON.stringify({
    agreementId: data.agreementId,
    milestoneId: data.milestoneId,
    eventType: data.eventType,
    details: data.details,
    previousHash: data.previousHash,
    createdAt: data.createdAt.toISOString(),
  });

  return createHash("sha256")
    .update(hashInput)
    .digest("hex");
}

// Append an event using an existing transaction.
export async function appendAuditEventInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateAuditEventInput
) {
  const previousEvent = await tx.auditEvent.findFirst({
    where: { agreementId: input.agreementId },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });

  const previousHash = previousEvent?.eventHash ?? null;
  const createdAt = new Date();
  const details = JSON.stringify(input.details);

  const eventHash = createEventHash({
    agreementId: input.agreementId,
    milestoneId: input.milestoneId ?? null,
    eventType: input.eventType,
    details,
    previousHash,
    createdAt,
  });

  return tx.auditEvent.create({
    data: {
      agreementId: input.agreementId,
      milestoneId: input.milestoneId ?? null,
      eventType: input.eventType,
      details,
      previousHash,
      eventHash,
      createdAt,
    },
  });
}

// Ordinary audit writes use their own transaction.
export async function appendAuditEvent(
  input: CreateAuditEventInput
) {
  return prisma.$transaction((tx) =>
    appendAuditEventInTransaction(tx, input)
  );
}

export async function verifyAuditChain(agreementId: string) {
  const events = await prisma.auditEvent.findMany({
    where: { agreementId },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  let expectedPreviousHash: string | null = null;

  for (const event of events) {
    if (event.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        checkedEvents: events.length,
        failedEventId: event.id,
        reason: "The previous-hash link does not match.",
      };
    }

    const recalculatedHash = createEventHash({
      agreementId: event.agreementId,
      milestoneId: event.milestoneId,
      eventType: event.eventType,
      details: event.details,
      previousHash: event.previousHash,
      createdAt: event.createdAt,
    });

    if (event.eventHash !== recalculatedHash) {
      return {
        valid: false,
        checkedEvents: events.length,
        failedEventId: event.id,
        reason: "The event contents do not match their stored hash.",
      };
    }

    expectedPreviousHash = event.eventHash;
  }

  return {
    valid: true,
    checkedEvents: events.length,
    failedEventId: null,
    reason: "All audit events passed hash verification.",
  };
}
