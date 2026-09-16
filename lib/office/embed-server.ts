import "server-only";
import { requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";

export class OfficeEmbedError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeEmbedError";
  }
}

function validateDestination(rawUrl: string, rawHost: string) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new OfficeEmbedError(400, "Embed URL is invalid"); }
  const allowedHost = rawHost.trim().toLowerCase();
  if (url.protocol !== "https:") throw new OfficeEmbedError(400, "Embedded workspaces require HTTPS");
  if (url.hostname.toLowerCase() !== allowedHost) throw new OfficeEmbedError(400, "Embed hostname must exactly match the approved host");
  if (url.username || url.password) throw new OfficeEmbedError(400, "Credentials are not allowed in embed URLs");
  if (!/^[a-z0-9.-]+$/i.test(allowedHost) || allowedHost === "localhost" || allowedHost.endsWith(".local")) throw new OfficeEmbedError(400, "Embed host is not allowed");
  for (const key of url.searchParams.keys()) {
    if (/(token|secret|password|passwd|api[_-]?key|signature|credential|auth)/i.test(key)) throw new OfficeEmbedError(400, "Secrets or credentials are not allowed in embed URLs");
  }
  url.hash = "";
  return { url: url.toString(), allowedHost };
}

export async function getOfficeEmbedRegistry() {
  const { admin, identity } = await requireOfficeActor();
  const manage = await resolveOfficePermission(admin, identity, "integration.embed.manage", { type: "COMPANY" });
  const { data: rows, error } = await admin.from("office_embed_catalog").select("id,code,title,description,url,allowed_host,required_permission,status,created_at,updated_at").order("title", { ascending: true });
  if (error) throw new OfficeEmbedError(500, "Unable to read embedded workspace registry");
  const visible = [] as typeof rows;
  for (const row of rows ?? []) {
    if (manage.allowed) { visible.push(row); continue; }
    if (row.status !== "ACTIVE") continue;
    const decision = await resolveOfficePermission(admin, identity, row.required_permission, { type: "COMPANY" });
    if (decision.allowed) visible.push(row);
  }
  let permissionOptions: Array<{ code: string; label: string; module: string }> = [];
  if (manage.allowed) {
    const { data, error: permissionError } = await admin.from("office_permission_catalog").select("code,label,module").eq("active", true).order("module", { ascending: true }).order("label", { ascending: true });
    if (permissionError) throw new OfficeEmbedError(500, "Unable to read embed permission catalog");
    permissionOptions = data ?? [];
  }
  return { can_manage: manage.allowed, embeds: visible, permission_options: permissionOptions };
}

export async function upsertOfficeEmbed(input: { code: string; title: string; description?: string; url: string; allowedHost: string; requiredPermission: string; status: "ACTIVE" | "DISABLED" }) {
  const { admin, identity } = await requireOfficeActor();
  const manage = await resolveOfficePermission(admin, identity, "integration.embed.manage", { type: "COMPANY" });
  if (!manage.allowed) throw new OfficeEmbedError(403, manage.reason);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,80}$/.test(code)) throw new OfficeEmbedError(400, "Embed code must use A-Z, 0-9 and underscore");
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) throw new OfficeEmbedError(400, "Embed title must contain 2 to 120 characters");
  const destination = validateDestination(input.url, input.allowedHost);
  const { data: permission, error: permissionError } = await admin.from("office_permission_catalog").select("code,active").eq("code", input.requiredPermission).maybeSingle();
  if (permissionError || !permission || permission.active !== true) throw new OfficeEmbedError(400, "Required permission is not active");

  const { data, error } = await admin.from("office_embed_catalog").upsert({
    code,
    title,
    description: input.description?.trim() || null,
    url: destination.url,
    allowed_host: destination.allowedHost,
    required_permission: input.requiredPermission,
    status: input.status,
    created_by: identity.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "code" }).select("id,code,title,description,url,allowed_host,required_permission,status,created_at,updated_at").single();
  if (error) throw new OfficeEmbedError(500, "Unable to save embedded workspace");
  return { embed: data };
}

export async function setOfficeEmbedStatus(code: string, status: "ACTIVE" | "DISABLED") {
  const { admin, identity } = await requireOfficeActor();
  const manage = await resolveOfficePermission(admin, identity, "integration.embed.manage", { type: "COMPANY" });
  if (!manage.allowed) throw new OfficeEmbedError(403, manage.reason);
  const normalized = code.trim().toUpperCase();
  const { data, error } = await admin.from("office_embed_catalog").update({ status, updated_at: new Date().toISOString() }).eq("code", normalized).select("code,status").maybeSingle();
  if (error) throw new OfficeEmbedError(500, "Unable to update embedded workspace");
  if (!data) throw new OfficeEmbedError(404, "Embedded workspace not found");
  return data;
}
