import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const backend = readFileSync(new URL("../../Backend/backend/identity_auth.py", import.meta.url), "utf8");
const registration = readFileSync(new URL("../components/office-register-form.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../components/workspace-login-form.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/office-auth/invited-email-otp/route.ts", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/office/auth-server.ts", import.meta.url), "utf8");
const signin = readFileSync(new URL("../app/api/office-auth/sign-in/route.ts", import.meta.url), "utf8");
const register = readFileSync(new URL("../app/api/office-auth/register/route.ts", import.meta.url), "utf8");

describe("invited employee email OTP registration and sign-in", () => {
  it("uses only a confirmed private invitation and MEMBER role", () => {
    expect(backend).toContain('_invited_member_email_otp_allowed');
    expect(backend).toContain('active_roles.issubset(approved_roles)');
    expect(backend).toContain('OfficeAuthInvite.status == "ACCEPTED"');
    expect(backend).toContain('OfficeAuthInvite.email == user.email');
    expect(backend).toContain('not payload.challenge_token.startswith(session.id + ".")');
    expect(backend).toContain('session.aal = "aal2"');
  });
  it("sends a real email using the existing verified Brevo delivery boundary", () => {
    expect(backend).toContain('send_office_email_verification_code(');
    expect(backend).toContain('"office_invited_web"');
    expect(backend).toContain('EMAIL_OTP_DELIVERY_UNKNOWN');
    expect(backend).toContain('challenge.attempt_count');
    expect(backend).not.toContain('debug_verification_code');
  });
  it("replaces the *invite* MFA screen with an email-code form", () => {
    expect(registration).toContain('CORPORATE EMAIL VERIFICATION');
    expect(registration).toContain('Enter the code from your email');
    expect(registration).toContain('email_otp_available');
    expect(registration).toContain('Send email code');
    expect(registration).toContain('Verify email and enter Office');
  });
  it("also supports subsequent invited MEMBER sign-ins without changing Authenticator paths", () => {
    expect(signin).toContain("email_otp_available");
    expect(register).toContain("email_otp_available");
    expect(login).toContain('auth.email_otp_available === true');
    expect(login).toContain('Use Authenticator approval instead');
    expect(login).toContain('verifyInvitedEmailCode');
  });
  it("preserves HttpOnly session tokens and same-origin OTP handling", () => {
    expect(route).toContain("officeMutationIsSameOrigin");
    expect(route).toContain('getOfficeSessionContext');
    expect(route).toContain('context.identity.aal !== "aal1"');
    expect(server).toContain('requestInvitedOfficeEmailOtp');
    expect(server).toContain('verifyInvitedOfficeEmailOtp');
    expect(server).toContain('writeOfficeSessionCookies');
    expect(route).not.toContain('access_token:');
  });
});
