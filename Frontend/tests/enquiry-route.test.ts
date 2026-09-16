import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), insert: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db }));
vi.mock("@/lib/enquiry-intake", async () => import("../lib/enquiry-intake"));
import { POST } from "../app/api/enquiries/route";
const payload = { requestId: "9a0f3ecd-5a15-4cb0-91e6-16c3061c5958", name: "Synthetic Tester", email: "test@example.com", category: "Product enquiry", message: "Synthetic enquiry; no patient data", privacyAcknowledged: "true" };
function request(body = payload) { return new Request("https://example.com/api/enquiries", { method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); db.rpc.mockResolvedValue({ data: true, error: null }); db.from.mockReturnValue(db); db.insert.mockResolvedValue({ error: null }); db.select.mockReturnValue(db); db.eq.mockReturnValue(db); db.maybeSingle.mockResolvedValue({ data: { reference: "exists" }, error: null }); });
describe("corporate enquiry acceptance", () => {
  it("acknowledges only a persisted enquiry", async () => { expect((await POST(request())).status).toBe(201); expect(db.insert).toHaveBeenCalledOnce(); });
  it("acknowledges duplicate retries after checking the stored reference", async () => { db.insert.mockResolvedValue({ error: { code: "23505" } }); expect((await POST(request())).status).toBe(200); expect(db.maybeSingle).toHaveBeenCalledOnce(); });
  it("does not turn storage failure into success", async () => { db.insert.mockResolvedValue({ error: { code: "internal" } }); const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("internal"); });
  it("fails closed when quota is unavailable or exceeded", async () => { db.rpc.mockResolvedValue({ error: { message: "private" } }); expect((await POST(request())).status).toBe(503); db.rpc.mockResolvedValue({ data: false, error: null }); expect((await POST(request())).status).toBe(429); expect(db.insert).not.toHaveBeenCalled(); });
  it("rejects invalid fields and foreign origins", async () => { expect((await POST(request({ ...payload, email: "bad" }))).status).toBe(400); const foreign = request(); foreign.headers.set("origin", "https://untrusted.example"); expect((await POST(foreign)).status).toBe(403); expect(db.insert).not.toHaveBeenCalled(); });
});
