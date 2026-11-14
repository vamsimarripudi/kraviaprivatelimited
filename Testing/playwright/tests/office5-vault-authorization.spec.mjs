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


test("Connect and Vault page bodies cannot be viewed before KRAVIA AAL2 login",async ({page})=>{
 // Next.js may carry a redirect in its streamed response while the fetch
 // URL stays unchanged. Verify the actual browser navigation and visible UI.
 for(const path of ["/office/chat","/office/k-vault"]){
  await page.goto(path);
  await expect(page).toHaveURL(/\/office\/login(?:\?|$)/);
  await expect(page.getByRole("heading",{name:"Sign in to KRAVIA Office"})).toBeVisible();
  await expect(page.getByText("My conversations")).toHaveCount(0);
  await expect(page.getByText("My current grants")).toHaveCount(0);
 }
});

test("independent Vault verification queue requires explicit membership, source grants and a reviewer",async({request})=>{
 const id="00000000-0000-4000-8000-000000000001";
 const url="/api/office-vault/verification";
 const read=await request.get(url);
 expect([401,403,404,503]).toContain(read.status());
 expect(read.status()).not.toBe(200);
 expect(read.headers()["cache-control"]).toContain("no-store");
 const leaked=await read.text();
 expect(leaked).not.toContain("registration_code");
 expect(leaked).not.toContain("grant_category");
 const crossOrigin=await request.post(url,{headers:{Origin:"https://untrusted.example.invalid"},
   data:{record_id:id,decision:"ACTIVE",note:"Unsafe validation attempt",
    evidence_reference:"Unverified outside reference"}});
 expect(crossOrigin.status()).toBe(403);
 expect(crossOrigin.headers()["cache-control"]).toContain("no-store");
 const anonymous=await request.post(url,{data:{record_id:id,decision:"ACTIVE",
  note:"Cannot bypass independent review",evidence_reference:"Unknown reference"}});
 expect([401,403,404,503]).toContain(anonymous.status());
 expect(anonymous.headers()["cache-control"]).toContain("no-store");
});
