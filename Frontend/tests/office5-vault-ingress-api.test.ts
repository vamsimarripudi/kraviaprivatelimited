import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const ingress=readFileSync(new URL("../app/api/office-vault/secrets/ingress/route.ts",import.meta.url),"utf8");
const part=readFileSync(new URL("../app/api/office-vault/secrets/ingress/[id]/parts/[index]/route.ts",import.meta.url),"utf8");
const status=readFileSync(new URL("../app/api/office-vault/secrets/ingress/[id]/route.ts",import.meta.url),"utf8");
describe("K-Vault staged 10MiB API boundaries",()=>{
 it("requires same origin and strict control request validation",()=>{
  expect(ingress).toContain("officeMutationIsSameOrigin(request)");
  expect(ingress).toContain("z.discriminatedUnion");
  expect(ingress).toContain("completeOfficeVaultSecretIngress");
  expect(ingress).toContain("abortOfficeVaultSecretIngress");
 });
 it("enforces 1MiB per request without trusting Content-Length",()=>{
  expect(part).toContain('SECRET_UPLOAD_PART_SIZE');
  expect(part).toContain("used+value.byteLength>SECRET_UPLOAD_PART_SIZE");
  expect(part).toContain("reader.cancel()");
  expect(part).toContain("bounded.fill(0)");
  expect(part).toContain("value.fill(0)");
 });
 it("does not allow anonymous staging enumeration or cacheable private responses",()=>{
  expect(status).toContain("getOfficeVaultSecretIngress(id)");
  expect(status).toContain('Cache-Control":"private, no-store');
  expect(part).toContain("officeMutationIsSameOrigin(request)");
 });
});
