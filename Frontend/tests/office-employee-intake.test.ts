import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("../lib/office/employee-intake-server.ts", import.meta.url),"utf8");
const files = readFileSync(new URL("../lib/office/employee-intake-files.ts", import.meta.url),"utf8");
const intakeApi = readFileSync(new URL("../app/api/office-employee-intake/route.ts", import.meta.url),"utf8");
const uploadApi = readFileSync(new URL("../app/api/office-employee-intake/upload/route.ts", import.meta.url),"utf8");
const photoApi = readFileSync(new URL("../app/api/office-employee-intake/photo/route.ts", import.meta.url),"utf8");
const interfaceCode = readFileSync(new URL("../components/office-employee-intake.tsx", import.meta.url),"utf8");
const page = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url),"utf8");
const schema = readFileSync(new URL("../../Database/supabase/migrations/202611120003_verified_employee_intake_and_ids.sql", import.meta.url),"utf8");

describe("KRAVIA verified private employee onboarding",()=>{
  it("never exposes bank ciphertext and encrypts it with a dedicated AES-GCM key",()=>{
    expect(server).toContain('createCipheriv("aes-256-gcm",key,iv)');
    expect(server).toContain("OFFICE_EMPLOYEE_DATA_ENCRYPTION_KEY");
    expect(server).toContain('bank_account_ciphertext:encrypted');
    expect(server).toContain('bank_account_last4:bank?bank.slice(-4)');
    expect(server).toContain("Raw banking values, confidential scans and passwords are never included");
    expect(server).toContain("Independent reviewer required");
    expect(server).toContain('resolveOfficePermission(current.admin,current.identity,permission');
  });
  it("enforces same-origin, AAL2, private scanning and authenticating all private photo access",()=>{
    expect(intakeApi).toContain("officeMutationIsSameOrigin(request)");
    expect(uploadApi).toContain("officeMutationIsSameOrigin(request)");
    expect(photoApi).toContain("readEmployeePhoto(employee||undefined)");
    expect(files).toContain('"/api/v1/security/file-scan"');
    expect(files).toContain('verdict.sha256!==digest');
    expect(files).toContain("verdict.byte_size!==bytes.length");
    expect(files).toContain('const bucket = "office-employee-intake"');
    expect(files).toContain('cacheControl:"0"');
    expect(files).toContain('if(!path.startsWith(state.employee_user_id+"/")');
  });
  it("does not guess employment dates or issue an ID before independent approval",()=>{
    expect(schema).toContain("bank_verified_at is null");
    expect(schema).toContain("task_code='APPOINTMENT_SIGNED'");
    expect(schema).toContain("v_employment.start_date is null");
    expect(schema).toContain("p_actor=p_employee");
    expect(schema).toContain("public.office_department_permission_verdict");
    expect(schema).toContain("office_employee_mail_outbox");
    expect(schema).toContain("'PENDING'");
    expect(schema).toContain("enable row level security");
    expect(schema).toContain("from public,anon,authenticated");
    expect(schema).toContain("employee_user_id uuid primary key");
    expect(schema).toContain("employment_id uuid not null unique");
    expect(server).toContain('randomBytes(8).toString("hex").toUpperCase()');
  });
  it("keeps HR reviewer data scoped, with separate profile and recruiting access",()=>{
    expect(intakeApi).toContain('params.get("directory")==="1"');
    expect(server).toContain("employeeIntakeDirectory");
    expect(server).toContain('"people.update"');
    expect(server).toContain('"payroll.payment.prepare"');
    expect(page).toContain('<OfficeEmployeeIntake view="self"/>');
    expect(page).toContain('<OfficeEmployeeIntake view="hr"/>');
    expect(interfaceCode).toContain("Save private draft");
    expect(interfaceCode).toContain("Upload scanned photo");
    expect(interfaceCode).toContain("Verify onboarding");
    expect(interfaceCode).toContain("Issue permanent ID");
    expect(interfaceCode).toContain("Employee ID email remains pending");
    expect(interfaceCode).not.toContain("Send email to employee now");
  });
});
