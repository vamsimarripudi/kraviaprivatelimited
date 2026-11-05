/** Pure newsletter safety rules, shared by the sender and its tests. */
export const NEWSLETTER_DAILY_ATTEMPT_CAP=80;
export function remainingDailyAttempts(attempts:number):number {
  if(!Number.isFinite(attempts)||attempts<0) return 0;
  return Math.max(0,NEWSLETTER_DAILY_ATTEMPT_CAP-Math.floor(attempts));
}
/** Do not mark a campaign complete while delivery outcomes remain unresolved. */
export function canMarkCampaignSent(pending:number,unresolved:number):boolean {
  return Number.isInteger(pending)&&Number.isInteger(unresolved)&&pending===0&&unresolved===0;
}
