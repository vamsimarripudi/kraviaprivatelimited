export const automationTriggerTypes = ["SCHEDULE", "DOMAIN_EVENT", "STATE_CHANGE", "DATE_THRESHOLD", "MANUAL"] as const;
export type AutomationTriggerType = (typeof automationTriggerTypes)[number];
export type AutomationSeverity = "INFO" | "ACTION" | "URGENT";
export type CorporateEvent = { id: string; type: string; entityType: string; entityId?: string; actorId?: string; correlationId: string; occurredAt: string; payload: Record<string, unknown> };
export type AutomationAction = { type: "CREATE_NOTIFICATION"; title: string; summary: string; recipientRole?: string } | { type: "CREATE_ASSIGNMENT"; title: string; targetRole: string; dueOffsetDays?: number } | { type: "REQUEST_EVIDENCE"; title: string; targetRole: string } | { type: "CREATE_DATA_QUALITY_FINDING"; title: string; severity: AutomationSeverity };
export type CorporateAutomation = { id: string; key: string; name: string; description: string; triggerType: AutomationTriggerType; triggerConfig: Record<string, unknown>; conditions: Array<{ field: string; operator: "equals" | "exists" | "before_days"; value?: string | number | boolean }>; actions: AutomationAction[]; enabled: boolean; severity?: AutomationSeverity; requiresHumanApproval: boolean; createdAt: string; updatedAt: string };
export const permittedAutomationActions = new Set<AutomationAction["type"]>(["CREATE_NOTIFICATION", "CREATE_ASSIGNMENT", "REQUEST_EVIDENCE", "CREATE_DATA_QUALITY_FINDING"]);
export function stableEventKey(event: Pick<CorporateEvent, "type" | "entityType" | "entityId" | "correlationId">) { return [event.type, event.entityType, event.entityId ?? "none", event.correlationId].join(":"); }
export function isAutomationActionAllowed(action: AutomationAction) { return permittedAutomationActions.has(action.type); }
