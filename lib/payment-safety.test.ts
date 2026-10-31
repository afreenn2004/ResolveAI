
import { describe, it, expect } from "vitest";
import { checkPaymentSafety } from "./payment-safety";

describe("ResolveAI Payment Safety", () => {
  const validPayment = {
    amount: 10,
    milestoneAmount: 10,
    remainingAuthorizedAmount: 30,
    buyerAcceptanceRecorded: true,
    evidenceValidated: true,
    agreementUnchanged: true,
    alreadyCaptured: false,
  };

  it("allows a valid milestone payment", () => {
    const result = checkPaymentSafety(validPayment);

    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("blocks payment without buyer acceptance", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      buyerAcceptanceRecorded: false,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks payment when evidence is missing", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      evidenceValidated: false,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks unauthorized extra fees", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      amount: 15,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks payment when the agreement has changed", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      agreementUnchanged: false,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks duplicate milestone payments", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      alreadyCaptured: true,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks payments exceeding the remaining authorization", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      amount: 35,
    });

    expect(result.allowed).toBe(false);
  });
});
