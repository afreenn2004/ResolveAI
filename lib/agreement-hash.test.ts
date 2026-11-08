import { describe, expect, it } from "vitest";
import { createAgreementHash } from "./agreement-hash";

const agreement = {
  id: "resolveai-demo-agreement",
  title: "Research Brief",
  buyerName: "Demo Buyer",
  sellerName: "Demo Seller",
  totalAmount: 3000,
  currency: "USD",
  milestones: [
    {
      sequence: 1,
      title: "Research and Source Collection",
      description: "Collect relevant sources and research material.",
      amount: 1000,
    },
    {
      sequence: 2,
      title: "Analysis and Findings",
      description: "Analyze the research and present key findings.",
      amount: 1000,
    },
    {
      sequence: 3,
      title: "Final Report and Recommendations",
      description: "Deliver the final report with recommendations.",
      amount: 1000,
    },
  ],
};

describe("createAgreementHash", () => {
  it("produces the same hash for the same agreement", () => {
    expect(createAgreementHash(agreement)).toBe(
      createAgreementHash(agreement)
    );
  });

  it("changes the hash when an agreement term changes", () => {
    const modifiedAgreement = {
      ...agreement,
      totalAmount: 3500,
    };

    expect(createAgreementHash(modifiedAgreement)).not.toBe(
      createAgreementHash(agreement)
    );
  });

  it("produces the same hash regardless of milestone array order", () => {
    const reversedAgreement = {
      ...agreement,
      milestones: [...agreement.milestones].reverse(),
    };

    expect(createAgreementHash(reversedAgreement)).toBe(
      createAgreementHash(agreement)
    );
  });
});