
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
  // Increment the agreement counter first.
  // This is the database write that serializes competing writers.
  const agreement = await tx.agreement.update({
    where: { id: input.agreementId },
    data: {
      auditSequence: { increment: 1 },
    },
    select: {
      auditSequence: true,
    },
  });

  const sequence = agreement.auditSequence;

  // Find the preceding event using its sequence number.
  const previousEvent = await tx.auditEvent.findFirst({
    where: { agreementId: input.agreementId },
    orderBy: { sequence: "desc" },
  });

  const previousHash = previousEvent?.eventHash ?? null;
  const details = JSON.stringify(input.details);

  // Keep timestamps increasing even if two writes happen very close together.
  const now = new Date();
  const createdAt =
    previousEvent && now <= previousEvent.createdAt
      ? new Date(previousEvent.createdAt.getTime() + 1)
      : now;

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
      sequence,
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
    orderBy: { sequence: "asc" },
  });

  let expectedPreviousHash: string | null = null;
  let expectedSequence = 1;

  for (const event of events) {
    if (event.sequence !== expectedSequence) {
      return {
        valid: false,
        checkedEvents: events.length,
        failedEventId: event.id,
        reason: "The audit event sequence is missing or out of order.",
      };
    }

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
    expectedSequence += 1;
  }

  return {
    valid: true,
    checkedEvents: events.length,
    failedEventId: null,
    reason: "All audit events passed hash verification.",
  };
}
