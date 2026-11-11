import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const register = readFileSync(new URL("../components/office-register-form.tsx", import.meta.url), "utf8");
const signIn = readFileSync(new URL("../components/workspace-login-form.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-auth/invited-email/route.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const model = readFileSync(new URL("../../Backend/backend/auth_models.py", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../Backend/backend/migrations/versions/d912ab4e8f30_v29_invited_web_email_otp.py", import.meta.url), "utf8");

describe("Invited employee mailbox verification", () => {
  it("guides new employees to their registered mailbox instead of requiring a nonexistent Authenticator seed", () => {
    expect(register).toContain('setPhase("email")');
    expect(register).toContain("Check your corporate email");
    expect(register).toContain('"/api/office-auth/invited-email"');
    expect(register).toContain("Email verification code");
    expect(register).toContain("Send email verification code");
    expect(register).toContain('mode === "invite"');
    expect(signIn).toContain('setPhase("email")');
    expect(signIn).toContain("Verify email and enter Office");
    expect(signIn).toContain('auth.mfa.enrolled');
  });
  it("keeps Founder and privileged accounts on the existing Authenticator path", () => {
    expect(signIn).toContain('!auth.founder');
    expect(signIn).toContain('["MEMBER", "OPERATIONS", "CS"]');
    expect(signIn).toContain('setPhase("activate")');
    expect(signIn).toContain('setPhase("verify")');
    expect(backend).toContain('INVITED_EMAIL_OTP_ELIGIBLE_ROLES');
    expect(backend).toContain('user.founder_slot or user.mfa_secret_ciphertext');
  });
  it("binds the challenge to a previously registered Office identity and its current browser session", () => {
    expect(backend).toContain('OfficeAuthInvite.status == "ACCEPTED"');
    expect(backend).toContain('browser_session_id=session.id');
    expect(backend).toContain('challenge.browser_session_id != session.id');
    expect(backend).toContain("EMAIL_OTP_MAX_ATTEMPTS");
    expect(model).toContain("browser_session_id = Column(String(36), nullable=True)");
    expect(migration).toContain('op.add_column("office_email_otp_challenges"');
  });
  it("keeps verified invited email sessions distinct from Authenticator activation", () => {
    expect(migration).toContain('email_otp_verified_at');
    expect(backend).toContain('session.email_otp_verified_at = now');
    expect(backend).toContain('not _invited_web_email_otp_allowed(db, user)');
    expect(backend).toContain('INVITED_EMAIL_OTP_SESSION_TTL_SECONDS');
    expect(backend).toContain('challenge.channel not in {"authenticator_mobile", "play_reviewer_mobile"}');
    expect(route).toContain('officeMutationIsSameOrigin');
    expect(route).toContain('officeIdentityIsProvisioned');
    expect(auth).toContain('requestInvitedWebEmailOtp');
    expect(auth).toContain('verifyInvitedWebEmailOtp');
    expect(auth).toContain('writeOfficeSessionCookies');
  });
  it("does not accept user-specified recipients or expose the generated code in API responses", () => {
    expect(route).not.toContain("recipient_email");
    expect(backend).toContain("recipient_email=user.email");
    expect(backend).toContain('"challenge_token": challenge_token');
    expect(backend).not.toContain('"code": code');
  });
});
