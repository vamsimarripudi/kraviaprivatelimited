import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const read=(file:string)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const dispatch=read("lib/office/notification-dispatch-server.ts");
const frontend=read("components/office-notification-hub.tsx");
const settings=read("components/office-notification-preferences-panel.tsx");
const api=read("app/api/office-notifications/preferences/route.ts");
const channel=read("app/api/office-notifications/events/route.ts");
const audio=read("app/api/office-notifications/sound/[sound]/route.ts");
const migration=read("../Database/supabase/migrations/20261115164000_office_unified_notification_delivery.sql");
const chat=read("lib/office/chat-server.ts");
const workflow=read("lib/office/workflow-server.ts");
const itService=read("lib/office/it-service-server.ts");
const support=read("lib/office/support-server.ts");
const shell=read("components/office-workspace-shell.tsx");
const center=read("components/office-notification-center.tsx");

describe("Office notification event wiring and enterprise privacy",()=>{
  it("uses durable actor-scoped records, deduplicated source keys and restrictive prefs",()=>{
    expect(migration).toContain("office_notification_event_key_uniq");
    expect(migration).toContain("office_notification_preferences");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.office_notification_preferences");
    expect(dispatch).toContain("office_identity_users");
    expect(dispatch).toContain('.eq("status","ACTIVE")');
    expect(dispatch).toContain('writeError.code!=="23505"');
    expect(dispatch).not.toContain('console.log("message body"');
  });
  it("hooks actual chat, approval, IT and support server operations",()=>{
    expect(chat).toContain("dispatchOfficeChatMessage");
    expect(workflow).toContain("dispatchOfficeWorkNotice");
    expect(itService).toContain("dispatchOfficeITNotice");
    expect(support).toContain("dispatchOfficeSupportNotice");
    expect(dispatch).toContain("office_chat_memberships");
    expect(dispatch).toContain("office_job_assignments");
    expect(dispatch).toContain('kind:"APPROVAL_REQUIRED"');
  });
  it("keeps browser alerts opt-in and never grants access from a toast",()=>{
    expect(frontend).toContain("safeNotificationHref");
    expect(frontend).toContain('Notification.permission==="granted"');
    expect(frontend).toContain('document.visibilityState==="visible"');
    expect(frontend).toContain("BroadcastChannel");
    expect(frontend).toContain("kravia.office.alert.");
    expect(frontend).toContain('sound_enabled');
    expect(frontend).toContain("inQuietHours");
    expect(settings).toContain("Notification.requestPermission()");
    expect(api).toContain("officeMutationIsSameOrigin");
    expect(api).toContain("z.object(");
    expect(channel).toContain("getOfficeNotificationCenter");
    expect(shell).toContain("<OfficeNotificationHub hideTrigger/>");
    expect(shell).toContain('openTopbarTool("notifications")');
    expect(frontend).toContain('"kravia-office-open-notifications"');
    expect(center).toContain("safeNotificationHref");
  });
  it("offers all approved original audio tone profiles",()=>{
    for(const tone of ["orbit","prism","flux","beacon"])expect(audio).toContain(tone);
    expect(audio).toContain('Content-Type":"audio/wav');
    expect(audio).toContain("Cache-Control");
  });
});
