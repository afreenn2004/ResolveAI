
import { describe, it, expect } from "vitest";
import { checkPaymentSafety } from "./payment-safety";

describe("ResolveAI Payment Safety", () => {
  const validPayment = {
    amount: 1000,
    milestoneAmount: 1000,
    remainingAuthorizedAmount: 3000,
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
      amount: 1500,
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
      amount: 3500,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks fractional-cent payment amounts", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      amount: 1000.5,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks zero payment amounts", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      amount: 0,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks negative payment amounts", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      amount: -100,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks invalid remaining authorization amounts", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      remainingAuthorizedAmount: 1000.5,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks invalid milestone amounts", () => {
    const result = checkPaymentSafety({
      ...validPayment,
      milestoneAmount: 0,
    });

    expect(result.allowed).toBe(false);
  });
});
