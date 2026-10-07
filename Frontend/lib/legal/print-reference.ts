export type LegalPrintReservation = {
  jobId: string;
  referenceNo: string;
  issuedOn: string;
  attemptCount: number;
};

/** Renders a database-issued ISO date without relying on the device timezone. */
export function formatLegalPrintDate(issuedOn: string) {
  const value = new Date(`${issuedOn}T12:00:00+05:30`);
  if (Number.isNaN(value.getTime())) return issuedOn;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(value);
}
