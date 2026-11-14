import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections, financeSections, preferredLandingPath } from "../lib/office/workspaces";
import { vaultCategories } from "../lib/office/vault-categories";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("../Database/supabase/migrations/202611140001_office_chat_private_messages.sql");
const chat = read("lib/office/chat-server.ts");
const vault = read("app/office/(workspace)/k-vault/[[...segments]]/page.tsx");
const shell = read("components/office-workspace-shell.tsx");
const style = read("app/office/office-experience-5.css");

describe("KRAVIA Office 5.0 source-backed implementation guardrails", () => {
 it("preserves every existing 55 Office and 24 Finance section entry",()=>{
   expect(Object.keys(officeSections)).toHaveLength(55);
   expect(Object.keys(financeSections)).toHaveLength(24);
   expect(preferredLandingPath(["DIRECTOR","FINANCE","HR","MEMBER","PRODUCT_ADMIN"])).toBe("/office/dashboard");
 });
 it("keeps Connect private messages on the approved AAL2 and membership boundary",()=>{
   expect(chat).toContain("requireOfficeActor()");
   expect(chat).toContain('workspaceStatus !== "ACTIVE"');
   expect(chat).toContain('.eq("user_id", current.identity.userId).eq("status", "ACTIVE")');
   expect(chat).toContain("await ownMembership(current, conversationId)");
   expect(chat).not.toMatch(/sendMail|sendEmail|inviteEmployee|externalRecipient/i);
   expect(sql).toContain("alter table public.office_chat_messages enable row level security");
   expect(sql).toContain("revoke all on public.office_chat_conversations");
   expect(sql).toContain("from public,anon,authenticated");
   expect(sql).toContain("grant execute on function public.office_chat_send_message(uuid,uuid,uuid,text) to service_role");
   expect(sql).toContain("on conflict(conversation_id,sender_user_id,client_nonce) do nothing");
 });
 it("does not leak old department channels through saved messages, mentions or search",()=>{
   const server = read("lib/office/chat-server.ts");
   const migration = read("../Database/supabase/migrations/202611140006_office_chat_department_channels.sql");
   const component = read("components/office-connect.tsx");
   expect(server).toContain("const effectiveDepartments=new Set");
   expect(server).toContain('row.kind!=="DEPARTMENT"||effectiveDepartments.has');
   expect(server).toContain('row.kind!=="DEPARTMENT"||assignedDepartments.has');
   expect(component).toContain('"/office/chat/channels/" + encodeURIComponent(item.department_code.toLowerCase())');
   expect(migration).toContain("office_chat_department_message_guard");
 });
 it("enforces same origin on every new communication mutation",()=>{
   const conversation=read("app/api/office-chat/conversations/route.ts");
   const messages=read("app/api/office-chat/conversations/[id]/messages/route.ts");
   for (const source of [conversation,messages]) {
     expect(source).toContain("officeMutationIsSameOrigin(request)");
     expect(source).toContain('"Cache-Control": "no-store"');
   }
 });
 it("does not duplicate statutory or financial sources inside the Vault",()=>{
   expect(vaultCategories.length).toBeGreaterThanOrEqual(8);
   expect(new Set(vaultCategories.map(item=>item.slug)).size).toBe(vaultCategories.length);
   expect(vault).toContain("getOfficeVaultAccess()");
   expect(vault).toContain("getOfficeRegistrationOverview()");
   expect(vault).toContain("getOfficeDocumentStudioOverview()");
   expect(vault).toContain("notFound()");
   expect(vault).toContain("requireOfficeVaultRecord(");
   expect(vault).toContain("/api/office-vault/documents/");
   expect(vault).not.toMatch(/password|private.key|recovery.phrase|bank.pin/i);
 });
 it("keeps Vault activity attributable only to the current verified Office actor",()=>{
   const server=read("lib/office/vault-access-server.ts");
   const activity=read("components/office-vault-activity.tsx");
   expect(server).toContain('export async function getOfficeVaultMyActivity()');
   expect(server).toContain('.eq("actor_user_id",current.identity.userId)');
   expect(activity).toContain('data.scope !== "OWN"');
   expect(server).toContain('resource_scoped:row.resource_id!==null');
   expect(activity).not.toContain('item.resource_id');
   expect(vault).toContain('<OfficeVaultActivity/>');
 });
 it("provides keyboard-first responsive Office and Finance navigation",()=>{
   expect(shell).toContain("office5-mobile-dock");
   expect(shell).toContain("office-mega-panel");
   expect(shell).toContain("isConnect");
   expect(shell).toContain("isVault");
   expect(style).toContain("--office5-rail: 76px");
   expect(style).toContain("--office5-context: 304px");
   expect(style).toContain("@media (max-width: 767px)");
   expect(style).toContain("env(safe-area-inset-bottom");
   expect(style).toContain("prefers-reduced-motion");
   expect(read("app/office/layout.tsx")).toContain('import "./office-experience-5.css"');
   expect(read("app/finance/layout.tsx")).toContain('import "../office/office-experience-5.css"');
   expect(read("app/finance/login/page.tsx")).toContain('<OfficeAuthLayout');
   expect(read("app/finance/login/page.tsx")).toContain('<WorkspaceLoginForm workspace="finance"');
 });
});
