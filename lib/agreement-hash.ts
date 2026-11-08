import { createHash } from "crypto";

export interface AgreementHashInput {
  id: string;
  title: string;
  buyerName: string;
  sellerName: string;
  totalAmount: number;
  currency: string;
  milestones: {
    sequence: number;
    title: string;
    description: string;
    amount: number;
  }[];
}

export function createAgreementHash(
  agreement: AgreementHashInput
): string {
  const normalizedAgreement = {
    id: agreement.id,
    title: agreement.title,
    buyerName: agreement.buyerName,
    sellerName: agreement.sellerName,
    totalAmount: agreement.totalAmount,
    currency: agreement.currency,
    milestones: [...agreement.milestones]
      .sort((a, b) => a.sequence - b.sequence)
      .map((milestone) => ({
        sequence: milestone.sequence,
        title: milestone.title,
        description: milestone.description,
        amount: milestone.amount,
      })),
  };

  return createHash("sha256")
    .update(JSON.stringify(normalizedAgreement))
    .digest("hex");
}