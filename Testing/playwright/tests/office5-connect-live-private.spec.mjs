import {test,expect} from "@playwright/test";
const conversation="00000000-0000-4000-8000-000000000001";
test("anonymous callers cannot subscribe to a private Connect event stream",async({request})=>{
 const response=await request.get("/api/office-chat/conversations/"+conversation+"/events");
 expect([401,403,404,503]).toContain(response.status());
 expect(response.headers()["cache-control"]).toContain("no-store");
 expect(response.headers()["content-type"]||"").not.toContain("text/event-stream");
 const body=await response.text();
 expect(body).not.toContain("MESSAGE_CHANGED");
 expect(body).not.toContain("office_chat_change_events");
});
test("anonymous browser cannot read another employee's transient typing or session data",async({request})=>{
 const result=await request.get("/api/office-chat/conversations/"+conversation+"/typing");
 expect([401,403,404,503]).toContain(result.status());
 expect(result.headers()["cache-control"]).toContain("no-store");
 const body=await result.text();
 expect(body).not.toContain("last_signal");
 expect(body).not.toContain("display_name");
});
test("foreign origins cannot write typing or presence signals",async({request})=>{
 const response=await request.post("/api/office-chat/conversations/"+conversation+"/typing",{
  headers:{Origin:"https://external.example.invalid"},
  data:{typing:true},
 });
 expect(response.status()).toBe(403);
 expect(response.headers()["cache-control"]).toContain("no-store");
});
test("live event endpoints validate event replay cursors",async({request})=>{
 const result=await request.get(
  "/api/office-chat/conversations/"+conversation+"/events?since=1%3Bselect%20*%20from%20people");
 expect(result.status()).toBe(400);
 expect(result.headers()["cache-control"]).toContain("no-store");
});
