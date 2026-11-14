import {test,expect} from "@playwright/test";
const fake="00000000-0000-4000-8000-000000000097";
test("anonymous employees cannot enumerate private K-Vault secret documents or retrieve encrypted versions",async({request})=>{
 const endpoints=[
  "/api/office-vault/secrets",
  "/api/office-vault/secrets/"+fake+"/preview",
  "/api/office-vault/secrets/"+fake+"/download",
 ];
 for(const url of endpoints){
  const response=await request.get(url);
  expect([401,403,404,503],url).toContain(response.status());
  expect(response.headers()["cache-control"],url).toContain("no-store");
  const body=await response.text();
  expect(body,url).not.toContain("wrapped_key");
  expect(body,url).not.toContain("sealed_path");
  expect(body,url).not.toContain("OFFICE_VAULT_KEYRING");
 }
});
test("cross-site scripts cannot upload, review or retry sealed-file evidence",async({request})=>{
 const origin={Origin:"https://untrusted-source.example.invalid"};
 const uploaded=await request.post("/api/office-vault/secrets",{
  headers:origin,multipart:{title:"Attempted secret",classification:"BOARD",
   file:{name:"fake.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\n%%EOF")}},
 });
 expect(uploaded.status()).toBe(403);
 const actions=[
  {action:"REVIEW",version_id:fake,approve:true,note:"Unauthorized outside review"},
  {action:"RETRY_SCAN",version_id:fake},
 ];
 for(const action of actions){
  const result=await request.patch("/api/office-vault/secrets",{headers:origin,data:action});
  expect(result.status()).toBe(403);
 }
});
test("live Connect conversation events never expose private content to anonymous browsers",async({request})=>{
 const endpoints=[
  "/api/office-chat/conversations/"+fake+"/events",
  "/api/office-chat/conversations/"+fake+"/typing",
 ];
 for(const url of endpoints){
  const response=await request.get(url);
  expect([401,403,404,503],url).toContain(response.status());
  const body=await response.text();
  expect(body).not.toContain("office_chat_messages");
  expect(body).not.toContain("content_key");
 }
 const mutation=await request.post("/api/office-chat/conversations/"+fake+"/typing",{
  headers:{Origin:"https://untrusted-source.example.invalid"},data:{typing:true},
 });
 expect(mutation.status()).toBe(403);
});
test("private locker screen is never available without an AAL2 Office session",async({page})=>{
 await page.goto("/office/k-vault/secrets");
 await expect(page).toHaveURL(/\/office\/login(?:\?|$)/);
 await expect(page.getByText("Secret document locker")).toHaveCount(0);
});
