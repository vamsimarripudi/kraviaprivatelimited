import {test,expect} from "@playwright/test";
const sample="00000000-0000-4000-8000-000000000001";
test("published Knowledge Center routes deny anonymous Office sessions",async({page},info)=>{
 test.skip(info.project.name!=="chromium","Private route smoke runs on Chromium");
 for(const path of ["/office/chat/support/knowledge",
  "/office/chat/support/knowledge/"+sample]){
  await page.goto(path,{waitUntil:"domcontentloaded"});
  await expect(page).toHaveURL(/\/office\/login(?:\?|$)/);
  await expect(page.getByText("Published, audience-authorized Knowledge Hub versions only")).toHaveCount(0);
 }
});
test("anonymous Knowledge Hub callers cannot enumerate article revisions",async({request})=>{
 const response=await request.get("/api/office-knowledge");
 expect([401,403,404,503]).toContain(response.status());
 expect(response.headers()["cache-control"]).toContain("no-store");
 const body=await response.text();
 expect(body).not.toContain("content_text");
 expect(body).not.toContain("article_versions");
});
test("foreign web origins cannot publish or create corporate articles",async({request})=>{
 const response=await request.post("/api/office-knowledge",{
  headers:{Origin:"https://untrusted.example.invalid"},
  data:{action:"PUBLISH_KNOWLEDGE",version_id:sample},
 });
 expect(response.status()).toBe(403);
});
