/** Kravia's operating financial year is configurable; this utility only supplies the India-default display convention. */
export function financialYearFor(date: Date, startMonth = 3) {
  const year = date.getUTCMonth() < startMonth ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
  return `FY ${year}\u2013${String(year + 1).slice(-2)}`;
}

export function financialYearRange(financialYear: string) {
  const match = /^FY (\d{4})\u2013(\d{2})$/.exec(financialYear);
  if (!match) return null;
  const startYear = Number(match[1]);
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` };
}
