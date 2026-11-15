import {describe,expect,it} from "vitest";
import {
  notificationCategory,notificationSound,safeNotificationHref,inQuietHours,
  defaultNotificationPreferences,
} from "../lib/office/notification-types";

describe("Unified notification policy boundaries",()=>{
  it("maps each workflow to the approved original KRAVIA tone",()=>{
    expect(notificationSound({kind:"CHAT_MESSAGE",priority:"NORMAL"})).toBe("orbit");
    expect(notificationSound({kind:"APPROVAL_REQUIRED",priority:"HIGH"})).toBe("prism");
    expect(notificationSound({kind:"DEPARTMENT_REQUEST",priority:"NORMAL"})).toBe("flux");
    expect(notificationSound({kind:"IT_TICKET",priority:"NORMAL"})).toBe("flux");
    expect(notificationSound({kind:"SECURITY_ALERT",priority:"CRITICAL"})).toBe("beacon");
  });
  it("classifies all company event categories",()=>{
    expect(notificationCategory("CHAT_MENTION")).toBe("chat");
    expect(notificationCategory("SUPPORT_CASE")).toBe("support");
    expect(notificationCategory("DEPARTMENT_REQUEST")).toBe("department");
    expect(notificationCategory("APPROVAL_REQUIRED")).toBe("approval");
    expect(notificationCategory("HR_WORKFLOW")).toBe("hr");
    expect(notificationCategory("FINANCE_WORKFLOW")).toBe("finance");
    expect(notificationCategory("VAULT_REQUEST")).toBe("vault");
  });
  it("prevents external and script notification redirection",()=>{
    expect(safeNotificationHref("javascript:alert(1)")).toBe("/office/notifications");
    expect(safeNotificationHref("//evil.example/path")).toBe("/office/notifications");
    expect(safeNotificationHref("/office/chat/dm/abc")).toBe("/office/chat/dm/abc");
    expect(safeNotificationHref("/finance/dashboard")).toBe("/finance/dashboard");
    expect(safeNotificationHref("/admin")).toBe("/office/notifications");
  });
  it("defaults to silent, opt-in notification audio and supports overnight quiet hours",()=>{
    expect(defaultNotificationPreferences.sound_enabled).toBe(false);
    expect(defaultNotificationPreferences.browser_enabled).toBe(false);
    expect(inQuietHours(defaultNotificationPreferences)).toBe(false);
    const quiet={...defaultNotificationPreferences,quiet_enabled:true};
    expect(inQuietHours(quiet,new Date("2026-11-15T18:00:00Z"))).toBe(true);
    expect(inQuietHours(quiet,new Date("2026-11-15T09:00:00Z"))).toBe(false);
  });
});
