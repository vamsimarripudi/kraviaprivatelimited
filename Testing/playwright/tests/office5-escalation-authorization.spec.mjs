import {test,expect} from "@playwright/test";
test("anonymous callers cannot read or operate private IT escalations",async({request})=>{
 const get=await request.get("/api/office-chat/support/escalations");
 expect([401,403,404,503]).toContain(get.status());
 expect(get.headers()["cache-control"]).toContain("no-store");
 expect(get.status()).not.toBe(200);
 const post=await request.post("/api/office-chat/support/escalations",{
  headers:{Origin:"https://untrusted.example.invalid"},
  data:{action:"CREATE",ticket_id:"00000000-0000-4000-8000-000000000011",
  recipient_id:"00000000-0000-4000-8000-000000000012",level:2,
  reason:"Untrusted request should never be accepted",
  request_nonce:"00000000-0000-4000-8000-000000000013"}});
 expect(post.status()).toBe(403);
 expect(post.headers()["cache-control"]).toContain("no-store");
});
