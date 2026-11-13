import { test, expect } from "@playwright/test";

const widths=[360,390,430,768,900,1024,1280,1440,1920];
for(const surface of ["office","finance"]){
 test("Office 5.0 "+surface+" sign-in responsive evidence, 360–1920px",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Screenshots are produced once from desktop Chromium");
  test.setTimeout(180_000);
  for(const theme of ["light","dark"]){
   for(const width of widths){
    await page.setViewportSize({width,height:Math.max(844,Math.round(width*0.6))});
    await page.goto("/"+surface+"/login",{waitUntil:"domcontentloaded"});
    await page.evaluate((value)=>window.localStorage.setItem("kravia.office.appearance",value),theme);
    await page.reload({waitUntil:"domcontentloaded"});
    await expect(page.locator(".kravia-office")).toHaveAttribute("data-office-theme",theme);
    await expect(page.getByRole("heading",{name:surface==="office"?"Sign in to KRAVIA Office":"Sign in to KRAVIA Finance"})).toBeVisible();
    if(surface==="finance")await expect(page.getByText("AAL2 required")).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow,"Horizontal page overflow at "+surface+"/"+theme+"/"+width).toBeLessThanOrEqual(1);
    await page.screenshot({path:testInfo.outputPath("office5-"+surface+"-"+theme+"-"+width+".png"),fullPage:true,animations:"disabled"});
   }
  }
 });
}
