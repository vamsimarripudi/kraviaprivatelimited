export const KRAVIA_ISSUER = "KRAVIA Office" as const;

export type KraviaTotpAccount = {
  version: 1;
  issuer: typeof KRAVIA_ISSUER;
  account: string;
  secret: string;
  algorithm: "SHA1";
  digits: 6;
  period: 30;
  enrolledAt: string;
};
