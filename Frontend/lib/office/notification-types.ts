/** Unified Office event metadata. Access to source records is always enforced by destination APIs. */
export type OfficeNotificationCategory =
  | "chat" | "support" | "department" | "approval" | "hr" | "finance" | "vault" | "system";
export type OfficeNotificationPriority = "NORMAL" | "HIGH" | "CRITICAL";
export type OfficeNotificationSound = "orbit" | "prism" | "flux" | "beacon";

export type OfficeNotice = {
  id: string;
  request_id?: string | null;
  kind: string;
  title: string;
  body: string;
  status: "UNREAD" | "READ" | "DISMISSED";
  created_at: string;
  read_at?: string | null;
  source_kind?: string | null;
  source_id?: string | null;
  target_path?: string | null;
  priority?: OfficeNotificationPriority | null;
  event_key?: string | null;
};

export type OfficeNotificationPreferences = {
  sound_enabled: boolean;
  volume: number;
  quiet_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  browser_enabled: boolean;
  categories: Record<OfficeNotificationCategory, boolean>;
};
export const notificationCategories: OfficeNotificationCategory[] = [
  "chat","support","department","approval","hr","finance","vault","system"
];
export const defaultNotificationPreferences: OfficeNotificationPreferences = {
  sound_enabled:false, volume:0.45, quiet_enabled:false,
  quiet_start:"22:00",quiet_end:"07:00",browser_enabled:false,
  categories:{chat:true,support:true,department:true,approval:true,
    hr:true,finance:true,vault:true,system:true}
};
export function notificationCategory(kind: string): OfficeNotificationCategory {
  const k=kind.toUpperCase();
  if(k.includes("CHAT")||k.includes("MENTION")||k.includes("MESSAGE"))return "chat";
  if(k.includes("SUPPORT")||k.includes("IT_")||k.includes("TICKET"))return "support";
  if(k.includes("APPROVAL")||k.includes("DECISION"))return "approval";
  if(k.includes("DEPARTMENT")||k.includes("TRANSFER")||k.includes("REQUEST"))return "department";
  if(k.includes("HR_")||k.includes("LEAVE")||k.includes("ATTENDANCE")||k.includes("EMPLOYEE"))return "hr";
  if(k.includes("FINANCE")||k.includes("PAYROLL")||k.includes("PAYS"))return "finance";
  if(k.includes("VAULT")||k.includes("DOCUMENT"))return "vault";
  return "system";
}
export function notificationSound(notice: Pick<OfficeNotice,"kind" | "priority">): OfficeNotificationSound {
  if(notice.priority==="CRITICAL")return "beacon";
  const category=notificationCategory(notice.kind);
  if(category==="approval")return "prism";
  if(category==="department"||category==="support")return "flux";
  return "orbit";
}
export function safeNotificationHref(raw: string | null | undefined): string {
  if(!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\x00-\x1f]/.test(raw))return "/office/notifications";
  if(!(/^\/(?:office|finance)\/[a-zA-Z0-9/_?=&%.-]+$/.test(raw)))return "/office/notifications";
  return raw;
}
export function inQuietHours(pref: OfficeNotificationPreferences, date = new Date()): boolean {
  if(!pref.quiet_enabled)return false;
  const minutes = new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Kolkata"})
    .format(date).split(":").map(Number);
  const now=minutes[0]*60+minutes[1];
  const parse=(s:string)=>{const p=s.split(":").map(Number);return p[0]*60+p[1];};
  const start=parse(pref.quiet_start), end=parse(pref.quiet_end);
  if(start===end)return false;
  return start<end ? now>=start&&now<end : now>=start||now<end;
}
