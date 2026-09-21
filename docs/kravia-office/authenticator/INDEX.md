# KRAVIA Authenticator documentation

This folder is the canonical documentation pack for the KRAVIA Authenticator used by KRAVIA Office and KRAVIA Finance.

## Documents

- [Architecture and security](./ARCHITECTURE_AND_SECURITY.md)
- [Test strategy](./TEST_STRATEGY.md)
- [Physical-device acceptance](./PHYSICAL_DEVICE_ACCEPTANCE.md)
- [Release and rollout](./RELEASE_AND_ROLLOUT.md)
- [Codex execution prompt: Playwright + free native-mobile testing](./CODEX_EXECUTE_PLAYWRIGHT_MOBILE_TESTING.md)

## Source locations

- Native application: `Authenticator/`
- First-party identity/MFA backend: `Backend/backend/identity_auth.py`
- Identity persistence: `Backend/backend/auth_models.py`
- Office MFA BFF: `Frontend/app/api/office-auth/mfa/route.ts`
- Office login/MFA UI: `Frontend/components/workspace-login-form.tsx`
- Authenticator quality workflow: `.github/workflows/authenticator.yml`

## Locked product decisions

- KRAVIA Authenticator is mandatory for every admitted Office/Finance role.
- First factor is the KRAVIA-owned Office password.
- Password success creates only an AAL1 session.
- TOTP success promotes the current session to AAL2.
- The authenticator is an offline native credential vault, not an Office client.
- No role-specific MFA bypass is permitted.
- Android and iOS use the same TOTP profile and package identity family.
- Production employee distribution must use persistent KRAVIA-controlled signing identities.
- Test APK signatures must never be treated as production trust identities.
