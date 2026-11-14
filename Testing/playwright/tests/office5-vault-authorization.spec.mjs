import { test, expect } from "@playwright/test";

test("private Vault audit and grant registers fail closed without an Office session", async ({ request }) => {
 for (const path of ["/api/office-vault/activity", "/api/office-vault/access"]) {
  const response = await request.get(path);
  expect([401,403,503], path).toContain(response.status());
  expect(response.status(), path).not.toBe(200);
  expect(response.headers()["cache-control"], path).toContain("no-store");
  const body = await response.text();
  expect(body, path).not.toContain("office_vault_access_grants");
 }
});

test("anonymous Vault document previews and downloads never expose protected files",async ({ request }) => {
 const id = "00000000-0000-4000-8000-000000000001";
 for (const path of [
  "/api/office-vault/documents/" + id + "/preview",
  "/api/office-vault/documents/" + id + "/download",
 ]) {
  const response = await request.get(path);
  expect([401,403,404,503],path).toContain(response.status());
  expect(response.status(),path).not.toBe(200);
  expect(response.headers()["cache-control"],path).toContain("no-store");
 }
});

test("cross-site scripts cannot request, grant or revoke Vault access", async({request})=>{
 const id="00000000-0000-4000-8000-000000000001";
 const cases=[
  {action:"REQUEST",category:"documents",operation:"READ",justification:"Access governed records",until:"2027-01-01T00:00:00Z"},
  {action:"REVIEW",request_id:id,approve:true,note:"External reviewer"},
  {action:"REVOKE",grant_id:id,reason:"Unauthorized revocation"},
 ];
 for(const payload of cases){
  const response=await request.post("/api/office-vault/access",{
   headers:{Origin:"https://untrusted.example.invalid"},data:payload,
  });
  expect(response.status()).toBe(403);
  expect(response.headers()["cache-control"]).toContain("no-store");
 }
});
