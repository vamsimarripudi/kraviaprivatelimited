import {test,expect} from "@playwright/test";
const sealedId="00000000-0000-4000-8000-000000000001";
test("secret locker page requires the existing AAL2 Office sign-in",async({page})=>{
 await page.goto("/office/k-vault/secrets",{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(/\/office\/login(?:\?|$)/);
 await expect(page.getByText("Seal company document")).toHaveCount(0);
 await expect(page.getByText("Independent maker-checker")).toHaveCount(0);
});
test("anonymous callers cannot enumerate sealed versions or retrieve private bytes",async({request})=>{
 for(const path of [
  "/api/office-vault/secrets",
  "/api/office-vault/secrets/"+sealedId+"/preview",
  "/api/office-vault/secrets/"+sealedId+"/download",
 ]){
  const res=await request.get(path);
  expect([401,403,404,503],path).toContain(res.status());
  expect(res.status(),path).not.toBe(200);
  expect(res.headers()["cache-control"],path).toContain("no-store");
  const contents=await res.text();
  expect(contents,path).not.toContain("wrapped_key");
  expect(contents,path).not.toContain("sealed_path");
  expect(contents,path).not.toContain("OFFICE_VAULT_KEYRING_JSON");
 }
});
test("untrusted origin cannot seal, approve or rescan a secret",async({request})=>{
 const headers={Origin:"https://untrusted.example.invalid"};
 const create=await request.post("/api/office-vault/secrets",{headers,data:"unauthorized"});
 expect(create.status()).toBe(403);
 const review=await request.patch("/api/office-vault/secrets",{
  headers,data:{action:"REVIEW",version_id:sealedId,approve:true,
    note:"Unauthorized document approval"},
 });
 expect(review.status()).toBe(403);
 const retry=await request.patch("/api/office-vault/secrets",{
  headers,data:{action:"RETRY_SCAN",version_id:sealedId},
 });
 expect(retry.status()).toBe(403);
 for(const response of [create,review,retry])
  expect(response.headers()["cache-control"]).toContain("no-store");
});
