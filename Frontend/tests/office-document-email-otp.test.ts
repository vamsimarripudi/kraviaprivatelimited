import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}
const schema = read("../Database/supabase/migrations/202611140001_office_document_email_otp_approval.sql");
const service = read("lib/office/document-otp-server.ts");
const email = read("lib/office/document-otp-email.ts");
const route = read("app/api/office-documents/otp/route.ts");
const ui = read("components/office-document-otp.tsx");
const screen = read("components/internal-workspace-screen.tsx");
const studio = read("components/office-document-studio.tsx");
const studioServer = read("lib/office/document-studio-server.ts");

describe("First-party Office document OTP approvals", () => {
  it("does not synthesize identities, GPS, documents or signature certificates", () => {
    expect(schema).toContain("office_employee_reference_ids");
    expect(schema).toContain("signer_name");
    expect(schema).toContain("approved_at timestamptz NOT NULL DEFAULT now()");
    expect(schema).toContain("BROWSER_REPORTED_UNVERIFIED");
    expect(schema).toContain("INTERNAL_EMAIL_OTP_APPROVED");
    expect(schema).toContain("doc.signed_at IS NULL");
    expect(schema).toContain("doc.subject_type='EMPLOYEE' AND doc.subject_reference=p_actor::text");
    expect(service).toContain('doc.subject_type === "EMPLOYEE"');
    expect(schema).not.toContain("status='SIGNED',signed_at");
    expect(ui).toContain("navigator.geolocation.getCurrentPosition");
    expect(ui).toContain("enableHighAccuracy: true, maximumAge: 0");
    expect(ui).toContain("Location permission was denied. Approval has not been recorded.");
    expect(ui).toContain("Coordinates were reported by the signer");
    expect(ui).toContain("Not a certificate-based digital signature");
  });
  it("binds six-digit OTP, authenticated signer and exact PDF, with short-lived single use", () => {
    expect(service).toContain('randomInt(0, 1_000_000)');
    expect(service).toContain('createHmac("sha256"');
    expect(service).toContain('sessionHash: createHash("sha256")');
    expect(service).toContain("checkedDocument(current");
    expect(service).toContain("office_document_otp_begin");
    expect(service).toContain("office_document_otp_approve");
    expect(service).toContain("challenge.document_instance_id !== input.instanceId");
    expect(schema).toContain("render_sha256");
    expect(schema).toContain("document_instance_id=p_instance");
    expect(schema).toContain("attempt_count+1>=5");
    expect(schema).toContain("status='USED'");
    expect(schema).toContain("UNIQUE(render_id,signer_user_id)");
    expect(schema).toContain("interval '7 minutes'");
    expect(schema).toContain("interval '60 seconds'");
    expect(schema).toContain("interval '2 minutes'");
    expect(schema).toContain("location_source text NOT NULL DEFAULT 'BROWSER_REPORTED_UNVERIFIED'");
  });
  it("never sends OTP with a missing configured Brevo service or returns the OTP to the browser", () => {
    expect(service).toContain("documentOtpMailReady()");
    expect(email).toContain("process.env.BREVO_API_KEY");
    expect(email).toContain("DocumentOtpMailUnknown");
    expect(email).toContain("Idempotency-Key");
    expect(email).toContain("sender: { name: \"KRAVIA Office\", email: sender }");
    expect(route).toContain("officeMutationIsSameOrigin(request)");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain('z.string().regex(/^\\d{6}$/)');
    expect(service).not.toContain("return { code");
  });
  it("provides the OTP action to the authenticated person and stores the green receipt only from database evidence", () => {
    expect(screen).toContain("<OfficeDocumentOtpPanel/>");
    expect(studio).toContain("<OfficeDocumentOtpButton");
    expect(studio).toContain("<OfficeDocumentOtpStamp");
    expect(studioServer).toContain('from("office_document_otp_approvals")');
    expect(studioServer).toContain('eq("signer_user_id", current.identity.userId)');
    expect(ui).toContain("APPROVED · EMAIL OTP");
    expect(ui).toContain("signer_email_masked");
    expect(ui).toContain("accuracy_m");
    expect(ui).toContain("Verified at");
    expect(ui).toContain("Asia/Kolkata");
  });
});
