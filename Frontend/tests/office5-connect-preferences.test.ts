import {describe,expect,it} from "vitest";
import {defaultConnectPreferences,parseConnectPreferences,parseMotionMode} from "../lib/office/connect-preferences";
describe("Connect device-only preferences and privacy boundaries",()=>{
 it("defaults to showing alerts and mentions shortcuts without opting into mail",()=>{
  expect(defaultConnectPreferences).toEqual({showUnread:true,showMentions:true});
 });
 it("accepts only explicit booleans and avoids arbitrary controls",()=>{
  expect(parseConnectPreferences({showUnread:false,showMentions:true,adminOverride:true}))
   .toEqual({showUnread:false,showMentions:true});
  expect(parseConnectPreferences({showUnread:"false",showMentions:1}))
   .toEqual({showUnread:true,showMentions:true});
 });
 it("treats damaged storage input as safe default",()=>{
  expect(parseConnectPreferences(null)).toEqual({showUnread:true,showMentions:true});
  expect(parseConnectPreferences(["false"])).toEqual({showUnread:true,showMentions:true});
 });
 it("motion preference is tightly limited to system, reduced or full",()=>{
  expect(parseMotionMode("reduced")).toBe("reduced");
  expect(parseMotionMode("full")).toBe("full");
  expect(parseMotionMode("unknown")).toBe("system");
  expect(parseMotionMode(null)).toBe("system");
 });
});
