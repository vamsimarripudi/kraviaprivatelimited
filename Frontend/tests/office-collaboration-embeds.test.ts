import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const collaboration = readFileSync(new URL("../lib/office/collaboration-server.ts", import.meta.url), "utf8");
const collaborationRoute = readFileSync(new URL("../app/api/office-work/comments/route.ts", import.meta.url), "utf8");
const embeds = readFileSync(new URL("../lib/office/embed-server.ts", import.meta.url), "utf8");
const embedRoute = readFileSync(new URL("../app/api/office-embeds/route.ts", import.meta.url), "utf8");
const embedFrame = readFileSync(new URL("../components/secure-embed-frame.tsx", import.meta.url), "utf8");
const sourceSql = readFileSync(new URL("../../Backend/spec/identity/SUPABASE_COLLABORATION_EMBEDS.sql", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");

describe("KRAVIA Office collaboration and embedded workspaces", () => {
  it("keeps request collaboration participation-scoped and immutable", () => {
    expect(collaboration).toContain("requestForActor");
    expect(collaboration).toContain('"request.comment"');
    expect(collaboration).toContain('event_type: "COMMENT_ADDED"');
    expect(sourceSql).toContain("office_request_comments_immutable");
    expect(sourceSql).toContain("office_request_comments_deny_client_access");
  });

  it("rejects cross-origin collaboration mutations", () => {
    expect(collaborationRoute).toContain("officeMutationIsSameOrigin(request)");
  });

  it("uses a server-only embed registry with explicit permission gates", () => {
    expect(embeds).toContain('"integration.embed.manage"');
    expect(embeds).toContain("required_permission");
    expect(embedRoute).toContain("officeMutationIsSameOrigin(request)");
    expect(sourceSql).toContain("office_embed_catalog_deny_client_access");
  });

  it("allows only exact HTTPS hosts and never credentials in iframe destinations", () => {
    expect(embeds).toContain('url.protocol !== "https:"');
    expect(embeds).toContain("url.hostname.toLowerCase() !== allowedHost");
    expect(embeds).toContain("url.username || url.password");
    expect(embeds).toContain("Secrets or credentials are not allowed in embed URLs");
    expect(embedFrame).toContain('sandbox="allow-forms allow-scripts allow-same-origin allow-popups"');
    expect(embedFrame).toContain('referrerPolicy="no-referrer"');
  });

  it("wires requests, people and integrations to their enterprise experiences", () => {
    expect(workspace).toContain("RequestCollaborationWorkspace");
    expect(workspace).toContain("OfficeOrganizationChart");
    expect(workspace).toContain("OfficeEmbedRegistry");
  });
});
