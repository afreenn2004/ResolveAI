
import { checkPaymentSafety } from "./payment-safety";

export interface CapturePreflightInput {
  amount: number;
  milestoneAmount: number;
  remainingAuthorizedAmount: number;
  buyerAcceptanceRecorded: boolean;
  evidenceValidated: boolean;
  agreementHashMatches: boolean;
  alreadyCaptured: boolean;
  milestoneSequence: number;
  completedPreviousMilestones: number;
  authorizationStatus: string;
  hasPendingOperation: boolean;
}

export interface CapturePreflightResult {
  allowed: boolean;
  reasons: string[];
}

export function validateCapturePreflight(
  input: CapturePreflightInput
): CapturePreflightResult {
  const safety = checkPaymentSafety({
    amount: input.amount,
    milestoneAmount: input.milestoneAmount,
    remainingAuthorizedAmount: input.remainingAuthorizedAmount,
    buyerAcceptanceRecorded: input.buyerAcceptanceRecorded,
    evidenceValidated: input.evidenceValidated,
    agreementUnchanged: input.agreementHashMatches,
    alreadyCaptured: input.alreadyCaptured,
  });

  const reasons = [...safety.reasons];

  // Milestones must be captured in sequence.
  if (
    !Number.isSafeInteger(input.milestoneSequence) ||
    input.milestoneSequence !== input.completedPreviousMilestones + 1
  ) {
    reasons.push(
      "Milestones must be captured in their agreed sequence."
    );
  }

  // Only an active or partially captured authorization can be used.
  if (
    !["CREATED", "PARTIALLY_CAPTURED"].includes(
      input.authorizationStatus
    )
  ) {
    reasons.push(
      "PayPal authorization is not in a capturable state."
    );
  }

  // An unresolved operation must be reconciled before another capture.
  if (input.hasPendingOperation) {
    reasons.push(
      "A previous payment operation is unresolved."
    );
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
