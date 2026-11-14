import {test,expect} from "@playwright/test";
const id="00000000-0000-4000-8000-000000000001";
test("Connect approval, admin and Vault document screens require actual AAL2 Office identity",async({page},testInfo)=>{
 test.skip(testInfo.project.name!=="chromium","Route boundary runs once per browser suite");
 for(const target of [
  "/office/chat/approvals",
  "/office/chat/approvals/"+id,
  "/office/chat/admin/integrations",
  "/office/k-vault/company",
  "/office/k-vault/documents",
  "/office/k-vault/documents/"+id,
  "/office/k-vault/records/"+id,
 ]){
   await page.goto(target,{waitUntil:"domcontentloaded"});
   await expect(page).toHaveURL(/\/office\/login(?:\?|$)/);
   await expect(page.getByText("Decision safeguards")).toHaveCount(0);
   await expect(page.getByText("Authorized document inventory")).toHaveCount(0);
 }
});
test("untrusted callers cannot make source approval or mail-policy decisions",async({request})=>{
 const untrusted={Origin:"https://unauthorized.example.invalid"};
 const routes=[
  {url:"/api/office-work/requests/"+id+"/decision",method:"patch",data:{decision:"APPROVE",note:"Untrusted request"}},
  {url:"/api/office-employee-mail-policy",method:"post",data:{enabled:true,reason:"Untrusted activation attempt"}},
  {url:"/api/office-lifecycle-mail-policy",method:"post",data:{event_code:"ONB-05",enabled:true,reason:"Untrusted delivery routing"}},
 ];
 for(const {url,method,data} of routes){
  const response=method==="patch"?await request.patch(url,{headers:untrusted,data}):
   await request.post(url,{headers:untrusted,data});
  expect(response.status(),url).toBe(403);
  const body=await response.text();
  expect(body,url).not.toContain("access_token");
  expect(body,url).not.toContain("provider_secret");
 }
});
test("anonymous requests cannot inspect governed mail delivery outcomes",async({request})=>{
 for(const url of ["/api/office-employee-mail-policy","/api/office-lifecycle-mail-policy"]){
  const response=await request.get(url);
  expect([401,403,503],url).toContain(response.status());
  expect(response.headers()["cache-control"],url).toContain("no-store");
  expect(await response.text(),url).not.toContain("counts_by_source");
 }
});
