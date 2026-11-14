import {test,expect} from "@playwright/test";
const session="00000000-0000-4000-8000-000000000001";
test("anonymous callers cannot enumerate private encrypted upload sessions",async({request})=>{
 const response=await request.get("/api/office-vault/secrets/ingress/"+session);
 expect([401,403,404,503]).toContain(response.status());
 expect(response.headers()["cache-control"]).toContain("no-store");
 const body=await response.text();
 expect(body).not.toContain("wrapped_key");
 expect(body).not.toContain("sealed_path");
});
test("cross-site callers cannot start, finish, abort or submit encrypted chunks",async({request})=>{
 const origin={"Origin":"https://untrusted.example.invalid"};
 const base="/api/office-vault/secrets/ingress";
 const requests=[
  request.post(base,{headers:origin,data:{action:"START",title:"Privileged evidence",
   classification:"BOARD",filename:"report.pdf",mime:"application/pdf",bytes:1,sha256:"a".repeat(64)}}),
  request.post(base,{headers:origin,data:{action:"COMPLETE",session_id:session}}),
  request.post(base,{headers:origin,data:{action:"ABORT",session_id:session}}),
  request.put(base+"/"+session+"/parts/0",{
   headers:{...origin,"Content-Type":"application/octet-stream"},data:Buffer.from("sensitive"),
  }),
 ];
 for(const promise of requests){
  const response=await promise;
  expect(response.status()).toBe(403);
  expect(response.headers()["cache-control"]).toContain("no-store");
 }
});
test("invalid chunk index and file body are rejected without acting on storage",async({request})=>{
 const base="/api/office-vault/secrets/ingress/"+session+"/parts";
 const bad=await request.put(base+"/99",{
  headers:{"Content-Type":"application/octet-stream"},data:Buffer.from("file"),
 });
 expect(bad.status()).toBe(404);
 const wrong=await request.put(base+"/0",{
  headers:{"Content-Type":"text/plain"},data:"not a supported part",
 });
 expect(wrong.status()).toBe(415);
});
