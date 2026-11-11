
import { describe, expect, it } from "vitest";
import { validateCapturePreflight } from "./payment-capture";

const validInput = {
  amount: 1000,
  milestoneAmount: 1000,
  remainingAuthorizedAmount: 3000,
  buyerAcceptanceRecorded: true,
  evidenceValidated: true,
  agreementHashMatches: true,
  alreadyCaptured: false,
  milestoneSequence: 1,
  completedPreviousMilestones: 0,
  authorizationStatus: "CREATED",
  hasPendingOperation: false,
};

describe("validateCapturePreflight", () => {
  it("allows a valid first milestone capture", () => {
    expect(validateCapturePreflight(validInput).allowed).toBe(true);
  });

  it("blocks capture without buyer acceptance", () => {
    const result = validateCapturePreflight({
      ...validInput,
      buyerAcceptanceRecorded: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain(
      "Recorded buyer acceptance is required."
    );
  });

  it("blocks capture without validated evidence", () => {
    const result = validateCapturePreflight({
      ...validInput,
      evidenceValidated: false,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks a changed agreement", () => {
    const result = validateCapturePreflight({
      ...validInput,
      agreementHashMatches: false,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks a duplicate milestone capture", () => {
    const result = validateCapturePreflight({
      ...validInput,
      alreadyCaptured: true,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks capture exceeding the remaining authorization", () => {
    const result = validateCapturePreflight({
      ...validInput,
      amount: 2000,
      remainingAuthorizedAmount: 1000,
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks capture out of milestone sequence", () => {
    const result = validateCapturePreflight({
      ...validInput,
      milestoneSequence: 2,
      completedPreviousMilestones: 0,
    });

    expect(result.allowed).toBe(false);
  });

  it("allows the second milestone after the first is completed", () => {
    const result = validateCapturePreflight({
      ...validInput,
      milestoneSequence: 2,
      completedPreviousMilestones: 1,
      remainingAuthorizedAmount: 2000,
      authorizationStatus: "PARTIALLY_CAPTURED",
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks an invalid authorization status", () => {
    const result = validateCapturePreflight({
      ...validInput,
      authorizationStatus: "VOIDED",
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks an unresolved previous operation", () => {
    const result = validateCapturePreflight({
      ...validInput,
      hasPendingOperation: true,
    });

    expect(result.allowed).toBe(false);
  });
});
