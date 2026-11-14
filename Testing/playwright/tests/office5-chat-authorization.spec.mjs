import { test, expect } from "@playwright/test";

test("anonymous users cannot list employees, chats or private messages",async({request})=>{
 const id="00000000-0000-4000-8000-000000000001";
 for(const url of ["/api/office-chat/directory","/api/office-chat/conversations",
   "/api/office-chat/conversations/"+id+"/messages"]){
  const result=await request.get(url);
  expect([401,403,404,503],url).toContain(result.status());
  expect(result.status(),url).not.toBe(200);
  expect(result.headers()["cache-control"],url).toContain("no-store");
  const body=await result.text();
  expect(body).not.toContain("office_chat_messages");
  expect(body).not.toContain("office_chat_memberships");
 }
});

test("untrusted origins cannot create groups, DMs or messages",async({request})=>{
 const id="00000000-0000-4000-8000-000000000001";
 const invalid={Origin:"https://untrusted.example.invalid"};
 const attacks=[
  {url:"/api/office-chat/conversations",body:{recipient_user_id:id}},
  {url:"/api/office-chat/groups",body:{title:"Unauthorized group",members:[id]}},
  {url:"/api/office-chat/conversations/"+id+"/messages",body:{body:"Not authorized",client_nonce:id}},
 ];
 for(const {url,body} of attacks){
  const result=await request.post(url,{headers:invalid,data:body});
  expect(result.status(),url).toBe(403);
  expect(result.headers()["cache-control"],url).toContain("no-store");
 }
});


test("anonymous callers cannot search, enumerate mentions or access saved content",async({request})=>{
 const id="00000000-0000-4000-8000-000000000001";
 for(const url of ["/api/office-chat/mentions","/api/office-chat/saved","/api/office-chat/search?q=private",
  "/api/office-chat/threads/"+id,"/api/office-chat/conversations/"+id+"/members",
  "/api/office-chat/messages/"+id+"/revisions"]){
  const result=await request.get(url);
  expect([401,403,404,503],url).toContain(result.status());
  expect(result.headers()["cache-control"],url).toContain("no-store");
 }
});
test("external origins cannot alter saved, mentions, edits or threads",async({request})=>{
 const id="00000000-0000-4000-8000-000000000001";
 const origin={Origin:"https://untrusted.example.invalid"};
 const attacks=[
  request.post("/api/office-chat/saved",{headers:origin,data:{message_id:id,save:true}}),
  request.patch("/api/office-chat/mentions",{headers:origin,data:{message_id:id}}),
  request.post("/api/office-chat/threads/"+id,{headers:origin,data:{body:"Not trusted",client_nonce:id}}),
  request.patch("/api/office-chat/messages/"+id,{headers:origin,data:{body:"Not trusted"}}),
  request.delete("/api/office-chat/messages/"+id,{headers:origin}),
  request.post("/api/office-chat/messages/"+id+"/pin",{headers:origin,data:{pin:true}}),
  request.post("/api/office-chat/messages/"+id+"/reactions",{headers:origin,data:{emoji:"👍",react:true}}),
  request.post("/api/office-chat/conversations/"+id+"/members",{headers:origin,data:{user_id:id}}),
 ];
 for(const call of attacks){
  const result=await call;
  expect(result.status()).toBe(403);
  expect(result.headers()["cache-control"]).toContain("no-store");
 }
});

test("anonymous requests to revisions, pins, reactions and group membership never gain private data",async({request})=>{
 const id="00000000-0000-4000-8000-000000000001";
 for(const url of ["/api/office-chat/messages/"+id+"/revisions",
  "/api/office-chat/conversations/"+id+"/members"]){
  const response=await request.get(url);
  expect([401,403,404,503],url).toContain(response.status());
  expect(response.headers()["cache-control"],url).toContain("no-store");
  expect(await response.text(),url).not.toContain("previous_body");
 }
 for(const {url,data} of [
  {url:"/api/office-chat/messages/"+id+"/pin",data:{pin:true}},
  {url:"/api/office-chat/messages/"+id+"/reactions",data:{emoji:"👍",react:true}},
  {url:"/api/office-chat/conversations/"+id+"/members",data:{user_id:id}},
 ]){
  const response=await request.post(url,{data});
  expect([401,403,404,503],url).toContain(response.status());
  expect(response.headers()["cache-control"],url).toContain("no-store");
 }
});

test("anonymous accounts cannot enumerate communication IAM profile mappings",async({request})=>{
 const response=await request.get("/api/office-chat/governance");
 expect([401,403,503]).toContain(response.status());
 expect(response.headers()["cache-control"]).toContain("no-store");
 const body=await response.text();
 expect(body).not.toContain("profile_mappings");
});

test("anonymous sessions cannot aggregate personal notifications or assigned escalations",async({request})=>{
 for(const url of ["/api/office-notifications","/api/office-chat/support/escalations"]){
  const response=await request.get(url);
  expect([401,403,503],url).toContain(response.status());
  expect(response.headers()["cache-control"],url).toContain("no-store");
 }
});

test("anonymous accounts cannot enumerate channel provisioning or job-assignment counts",async({request})=>{
 const response=await request.get("/api/office-chat/governance/channels");
 expect([401,403,503]).toContain(response.status());
 expect(response.headers()["cache-control"]).toContain("no-store");
 const body=await response.text();
 expect(body).not.toContain("active_assignment_count");
});
