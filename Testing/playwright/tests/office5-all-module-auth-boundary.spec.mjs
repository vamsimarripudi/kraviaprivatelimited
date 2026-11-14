import {test,expect} from "@playwright/test";

// Strict source-registered module inventory as of 14 Nov 2026. Every route must
// require an actual authenticated AAL2 Office identity, regardless of pathname.
const office=["dashboard","my-transfers","my-role","info","notifications","tasks","calendar","requests","approvals","manager","department-ownership","decisions","strategy","intelligence","products","portfolio","customers","crm","engineering","governance","compliance","registrations","knowledge","documents","contracts","vendors","recruitment","people","emergency","development","travel","cards","payroll","worktime","budget","assets","devices","it","facilities","support","role-packages","access","data","privacy","ethics","resilience","ai","quality","trust","security","integrations","domains","custody","readiness","audit","settings"];
const finance=["dashboard","my-role","worktime","info","customers","billing","payroll","budget","gst","accounting","banking","payments","expenses","reconciliation","ownership","documents","compliance","cards","insurance","ethics","emergency","ai","audit","settings"];
const batches=(list,size)=>Array.from({length:Math.ceil(list.length/size)},(_,i)=>list.slice(i*size,(i+1)*size));
test.describe("Office 5.0 registered deep links / anonymous authorization",()=>{
 test("catalog has the audit baseline",()=>{
  expect(office).toHaveLength(56);
  expect(finance).toHaveLength(24);
  expect(new Set(office).size).toBe(56);
  expect(new Set(finance).size).toBe(24);
 });
 for(const [workspace,slugs] of [["office",office],["finance",finance]]){
  for(const [index,part] of batches(slugs,8).entries()){
   test(workspace+" batch "+String(index+1)+" denies private access without AAL2",async({page},info)=>{
    test.skip(info.project.name!=="chromium","Run complete registry once in desktop Chromium");
    test.setTimeout(180000);
    for(const slug of part){
     const target="/"+workspace+"/"+slug;
     await page.goto(target,{waitUntil:"domcontentloaded"});
     await expect(page).toHaveURL(new RegExp("/"+workspace+"/login(?:\\?|$)"),{timeout:10000});
     await expect(page.locator(".office-v2.office-modern")).toHaveCount(0);
    }
   });
  }
 }
});
