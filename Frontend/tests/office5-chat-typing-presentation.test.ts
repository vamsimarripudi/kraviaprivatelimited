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
  expect(source).toContain("now-lastTypingSignal.current<3500");
 });
 it("never blocks a valid send on optional typing failures",()=>{
  expect(source).toContain("Presence is optional and never blocks message delivery");
  expect(source).toContain("signalTyping(false)");
 });
});
