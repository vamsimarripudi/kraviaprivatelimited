/** India Standard Time: 8 November 2026, 00:00 inclusive to 9 November 00:00 exclusive. */
export const DIWALI_START_UTC = Date.UTC(2026, 10, 7, 18, 30, 0, 0);
export const DIWALI_END_UTC = Date.UTC(2026, 10, 8, 18, 30, 0, 0);

export function isDiwaliActive(now: number = Date.now()): boolean {
  return now >= DIWALI_START_UTC && now < DIWALI_END_UTC;
}
