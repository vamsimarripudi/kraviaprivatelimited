import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const source=readFileSync(new URL("../components/office-connect.tsx",import.meta.url),"utf8");
describe("Connect transient typing UI",()=>{
 it("refreshes current membership-scoped typing only",()=>{
  expect(source).toContain('encodeURIComponent(activeId)+"/typing"');
  expect(source).toContain('setTypingPeople(Array.isArray(body.typing)?body.typing:[])');
  expect(source).toContain("setTypingRefresh(value=>value+1)");
 });
 it("never transmits draft text to the presence service",()=>{
  expect(source).toContain("body:JSON.stringify({typing:isTyping})");
  expect(source).not.toContain("JSON.stringify({typing:isTyping,draft})");
  expect(source).toContain("now-lastTypingSignal.current<1600");
 });
 it("clears typing activity after a pause and preserves privacy",()=>{
  expect(source).toContain("typingIdleTimer");
  expect(source).toContain("setTimeout(()=>signalTyping(false),2200)");
  expect(source).toContain("clearTimeout(typingIdleTimer.current)");
 });
 it("never blocks a valid send on optional typing failures",()=>{
  expect(source).toContain("Presence is optional and never blocks message delivery");
  expect(source).toContain("signalTyping(false)");
 });
});
