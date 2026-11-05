import { describe, expect, it } from "vitest";
import { safePublicReturnPath } from "../lib/public-access/return-path";
import { inspectPublicResource } from "../lib/public-access/inspect-resource";

describe("KRAVIA public resources security",()=>{
  it("blocks external, protocol-relative, Office and script redirects",()=>{
    expect(safePublicReturnPath("https://evil.example/")).toBe("/resources");
    expect(safePublicReturnPath("//evil.example/")).toBe("/resources");
    expect(safePublicReturnPath("/office/dashboard")).toBe("/resources");
    expect(safePublicReturnPath("/%2f%2fevil")).toBe("/resources");
    expect(safePublicReturnPath("/api/public-resources/company-overview/download")).toBe("/api/public-resources/company-overview/download");
  });
  it("accepts only validated PDF/UTF8, rejects executable and forged formats",()=>{
    const encoder=new TextEncoder();
    expect(inspectPublicResource(encoder.encode("sample publication"),"text/plain").valid).toBe(true);
    expect(inspectPublicResource(encoder.encode("<script>bad</script>"),"text/plain").valid).toBe(false);
    expect(inspectPublicResource(encoder.encode("=HYPERLINK(\"https://bad.example\")"),"text/csv").valid).toBe(false);
    expect(inspectPublicResource(encoder.encode("PDF-MAGIC"),"application/pdf").valid).toBe(false);
    expect(inspectPublicResource(new Uint8Array(0),"text/plain").valid).toBe(false);
    expect(inspectPublicResource(encoder.encode("contents"),"text/html").valid).toBe(false);
  });
});
