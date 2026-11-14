import {describe,it,expect} from "vitest";
import {parseQrSigninPayload} from "../src/activation";
import {isOfficeUuid} from "../src/identifiers";
import {readFileSync} from "node:fs";
const uuid="00000000-0000-4000-8000-000000000001";
const proof="A".repeat(32);
describe("Authenticator canonical device and QR identity",()=>{
 it("accepts a correctly shaped KRAVIA browser sign-in request",()=>{
  expect(isOfficeUuid(uuid)).toBe(true);
  expect(parseQrSigninPayload("kraviaauth://signin?request="+uuid+"&token="+proof))
   .toEqual({requestId:uuid,scanToken:proof});
 });
 it("rejects all-hyphen, wrong-group and malformed browser identifiers",()=>{
  for(const id of ["------------------------------------",
    "000000000000-4000-8000-000000000001",uuid.slice(1),"not-a-uuid","g0000000-0000-4000-8000-000000000001"]){
   expect(isOfficeUuid(id)).toBe(false);
   expect(()=>parseQrSigninPayload("kraviaauth://signin?request="+id+"&token="+proof)).toThrow();
  }
 });
 it("does not interpret TOTP seeds or attacker parameters as sign-in tokens",()=>{
  for(const value of [
   "otpauth://totp/KRAVIA?secret="+proof,
   "kraviaauth://signin?request="+uuid+"&token="+proof.slice(1),
   "kraviaauth://signin?request="+uuid+"&token="+proof+"&extra=approval",
  ])expect(()=>parseQrSigninPayload(value)).toThrow();
 });
 it("uses the same canonical shape check in native secure storage",()=>{
  const source=readFileSync(new URL("../src/storage.ts",import.meta.url),"utf8");
  expect(source).toContain("isOfficeUuid(value)");
 });
});
