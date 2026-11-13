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
