import { isAutomationActionAllowed, type AutomationAction } from "@/lib/corporate/automation";

type AdminClient = NonNullable<ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>>;
type EventRow = { id: string; event_type: string; entity_type: string; entity_id: string | null; payload: Record<string, unknown>; attempts: number };
type Definition = { id: string; key: string; conditions: Array<{ field: string; operator: string; value?: unknown }>; actions: AutomationAction[]; requires_human_approval: boolean };

function conditionsMatch(conditions: Definition["conditions"], payload: Record<string, unknown>) {
  return conditions.every((condition) => {
    const value = payload[condition.field];
    if (condition.operator === "exists") return value !== undefined && value !== null && value !== "";
    if (condition.operator === "equals") return value === condition.value;
    return true; // Date thresholds are calculated by reviewed scheduled definitions, not guessed in the worker.
  });
}

export async function runAutomationBatch(admin: AdminClient, limit = 25) {
  const { data: events, error } = await admin.from("corporate_events").select("id,event_type,entity_type,entity_id,payload,attempts").in("processing_status", ["PENDING", "FAILED"]).order("occurred_at", { ascending: true }).limit(limit);
  if (error) throw new Error("Automation event queue could not be read.");
  const outcomes: Array<{ eventId: string; status: string }> = [];
  for (const event of (events ?? []) as EventRow[]) {
    const claimed = await admin.from("corporate_events").update({ processing_status: "PROCESSING", attempts: event.attempts + 1, locked_at: new Date().toISOString(), locked_by: "cron" }).eq("id", event.id).in("processing_status", ["PENDING", "FAILED"]).select("id").maybeSingle();
    if (!claimed.data) continue;
    try {
      const { data: definitions } = await admin.from("automation_definitions").select("id,key,conditions,actions,requires_human_approval").eq("enabled", true).eq("trigger_type", "DOMAIN_EVENT").contains("trigger_config", { eventType: event.event_type });
      for (const definition of (definitions ?? []) as Definition[]) {
        if (!conditionsMatch(definition.conditions, event.payload)) continue;
        const runKey = `${event.id}:${definition.id}`;
        const { data: run, error: runError } = await admin.from("automation_runs").insert({ automation_id: definition.id, event_id: event.id, trigger_type: "DOMAIN_EVENT", idempotency_key: runKey, status: "STARTED" }).select("id").maybeSingle();
        if (runError && !runError.message.includes("duplicate")) throw runError;
        if (!run) continue;
        for (const [ordinal, action] of definition.actions.entries()) {
          if (!isAutomationActionAllowed(action)) continue;
          const { data: actionRun } = await admin.from("automation_run_actions").insert({ run_id: run.id, ordinal, action_type: action.type, detail: action, status: "PENDING" }).select("id").single();
          if (!actionRun) throw new Error("Automation action history could not be created.");
          if (action.type === "CREATE_NOTIFICATION" || action.type === "REQUEST_EVIDENCE" || action.type === "CREATE_ASSIGNMENT") {
            const role = action.type === "CREATE_NOTIFICATION" ? action.recipientRole : action.targetRole;
            let recipients = admin.from("profiles").select("id").eq("is_active", true);
            if (role) recipients = recipients.eq("role", role);
            const { data: profiles } = await recipients;
            await Promise.all((profiles ?? []).map((profile: { id: string }) => admin.from("notifications").insert({ profile_id: profile.id, category: "Corporate", title: action.title, body: "summary" in action ? action.summary : "A Corporate Office task requires review.", entity_type: event.entity_type, entity_id: event.entity_id })));
          }
          await admin.from("automation_run_actions").update({ status: "COMPLETED" }).eq("id", actionRun.id);
        }
        await admin.from("automation_runs").update({ status: "COMPLETED", finished_at: new Date().toISOString(), outcome: { humanApprovalRequired: definition.requires_human_approval } }).eq("id", run.id);
      }
      await admin.from("corporate_events").update({ processing_status: "COMPLETED", last_error: null }).eq("id", event.id);
      outcomes.push({ eventId: event.id, status: "COMPLETED" });
    } catch (cause) {
      const finalAttempt = event.attempts + 1 >= 3;
      const message = cause instanceof Error ? cause.message.slice(0, 500) : "Unknown automation error";
      await admin.from("corporate_events").update({ processing_status: finalAttempt ? "DEAD_LETTER" : "FAILED", last_error: message }).eq("id", event.id);
      if (finalAttempt) await admin.from("automation_dead_letters").insert({ event_id: event.id, reason: message });
      outcomes.push({ eventId: event.id, status: finalAttempt ? "DEAD_LETTER" : "FAILED" });
    }
  }
  return outcomes;
}

