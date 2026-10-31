
export interface PaymentSafetyInput {
  amount: number;
  milestoneAmount: number;
  remainingAuthorizedAmount: number;
  buyerAcceptanceRecorded: boolean;
  evidenceValidated: boolean;
  agreementUnchanged: boolean;
  alreadyCaptured: boolean;
}

export interface PaymentSafetyResult {
  allowed: boolean;
  reasons: string[];
}

export function checkPaymentSafety(
  input: PaymentSafetyInput
): PaymentSafetyResult {
  const reasons: string[] = [];

  // Rule 1: Payment must be a valid positive amount.
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    reasons.push("Payment amount must be greater than zero.");
  }

  // Rule 2: Payment cannot exceed the agreed milestone amount.
  if (input.amount > input.milestoneAmount) {
    reasons.push("Payment exceeds the agreed milestone amount.");
  }

  // Rule 3: Payment cannot exceed the remaining authorization.
  if (input.amount > input.remainingAuthorizedAmount) {
    reasons.push("Payment exceeds the remaining authorized amount.");
  }

  // Rule 4: Buyer acceptance must be recorded.
  if (!input.buyerAcceptanceRecorded) {
    reasons.push("Recorded buyer acceptance is required.");
  }

  // Rule 5: Required evidence must pass validation.
  if (!input.evidenceValidated) {
    reasons.push("Milestone evidence has not been validated.");
  }

  // Rule 6: The original agreement must remain unchanged.
  if (!input.agreementUnchanged) {
    reasons.push("The agreed payment terms have changed.");
  }

  // Rule 7: A milestone cannot be paid twice.
  if (input.alreadyCaptured) {
    reasons.push("This milestone has already been captured.");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
