# CODEX EXECUTION — KRAVIA Authenticator Playwright + native mobile testing

## Mission

Audit, implement and execute the end-to-end test suite for KRAVIA Office + KRAVIA Authenticator.

Do not stop at creating test files. Run the tests that the current machine can execute, inspect failures, repair product/test defects, rerun until green, and leave reproducible evidence.

Use only `main`. Do not create additional branches.

Do not make repeated commits. Work locally, run the full relevant suite, then create one final commit after the test implementation and fixes are stable.

Do not add paid testing services as required dependencies.

## Repository scope

Canonical areas:

- `Authenticator/`
- `Backend/backend/identity_auth.py`
- `Backend/backend/auth_models.py`
- `Backend/backend/tests/`
- `Frontend/app/office/`
- `Frontend/app/api/office-auth/`
- `Frontend/components/workspace-login-form.tsx`
- `Frontend/tests/`
- `docs/kravia-office/authenticator/`

Read every document in `docs/kravia-office/authenticator/` before changing code.

## Tooling decision

### Web: Playwright

Use `@playwright/test` for KRAVIA Office/Finance browser E2E.

Use Playwright device emulation for responsive/mobile-browser coverage.

Do **not** claim Playwright mobile-browser emulation is native-app testing.

Playwright's Android device API may be used only for targeted Chrome/WebView experiments if helpful. It is experimental and must not become the primary KRAVIA native-app acceptance runner.

Official reference:

- https://playwright.dev/docs/emulation
- https://playwright.dev/docs/api/class-android

### Native app: Maestro CLI

Primary native-mobile E2E runner: **Maestro CLI**.

Maestro is open-source and supports declarative mobile UI flows.

Use it first for Android native E2E and for iOS when a macOS/Xcode host is available.

Official references:

- https://maestro.dev/
- https://docs.maestro.dev/maestro-cli
- https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli

### Free device runtime

Primary Android runtime:

- Android Studio
- Android Emulator / AVD
- Android SDK platform-tools / ADB

Official reference:

- https://developer.android.com/studio/run/device
- https://developer.android.com/studio/releases/emulator

### Optional fallback

Use Appium only if a required native test cannot be expressed or stabilized in Maestro.

Appium is open-source.

Official reference:

- https://appium.io/

Do not add Appium merely to duplicate Maestro coverage.

## Cost and CI rules

Use local execution first.

Do not add a paid BrowserStack/Sauce/LambdaTest/device-farm dependency.

Do not add a cloud mobile-testing workflow that runs on every commit.

Do not add duplicate GitHub Actions.

Do not repeatedly push to observe CI.

A manual/on-demand workflow is acceptable only if there is a concrete need and the existing workflow cannot provide the required evidence.

Keep GitHub Actions consumption low.

## Step 1 — audit before implementation

Inspect:

- package managers and lock files;
- current test frameworks;
- ports/start commands;
- auth environment requirements;
- seed/test-data approach;
- BFF cookie behavior;
- enrollment secret handling;
- existing CI workflows;
- Android package/bundle identifiers;
- existing APK generation;
- testability/accessibility labels in native UI.

Write the audit result into:

`docs/kravia-office/authenticator/TEST_EXECUTION_REPORT.md`

The report must distinguish:

- already covered;
- implemented now;
- executed and passed;
- executed and failed;
- blocked by external environment;
- requires physical-device verification.

Never mark an unexecuted test PASS.

## Step 2 — add Playwright to the Frontend

If `@playwright/test` is absent, add it as a dev dependency using the existing package manager and update the lockfile.

Create a conventional structure such as:

```
Frontend/
  playwright.config.ts
  e2e/
    office-auth.spec.ts
    office-auth-security.spec.ts
    office-auth-mobile-web.spec.ts
```

Use a test-specific environment only.

Never point destructive tests at real production accounts.

Prefer a deterministic local backend/database fixture.

Do not hardcode real passwords, TOTP seeds, signing material or production secrets.

## Step 3 — Playwright web coverage

Implement and execute at minimum:

### Authentication

- unauthenticated visitor cannot enter protected Office routes;
- wrong password remains at first factor;
- valid first factor progresses to MFA;
- existing-factor user sees TOTP verification;
- unenrolled user sees QR enrollment.

### Enrollment secret handling

- QR appears only after valid first factor;
- manual setup key is hidden by default;
- manual key appears only after explicit user action;
- enrollment response is no-store;
- page does not persist the TOTP seed in localStorage/sessionStorage/indexedDB;
- no secret appears in URL/query string;
- no secret is written to browser console by the app.

### MFA

- field accepts six digits only;
- invalid TOTP is rejected;
- accepted TOTP promotes to AAL2;
- protected route opens only after AAL2;
- replayed accepted code is rejected;
- stale AAL1 token cannot modify MFA state after promotion;
- attempt-limit behavior remains fail-closed.

### Security/BFF

- cross-origin MFA mutation is rejected;
- auth cookies are HttpOnly/SameSite according to the implementation;
- logout closes the Office session;
- reset/recovery requires fresh enrollment;
- no role has an MFA bypass.

### Responsive browser coverage

Add Playwright projects for:

- Desktop Chrome/Chromium;
- Firefox;
- WebKit when supported by the host;
- Android-class mobile-browser emulation;
- iPhone-class mobile-browser emulation.

Collect trace/screenshots on failure, not on every passing test unless useful.

## Step 4 — prepare Android native testing

Use app id:

`com.kraviaprivatelimited.authenticator`

Install/use:

- Java 17+;
- Android SDK;
- Android Emulator;
- ADB;
- Maestro CLI.

Confirm:

```bash
adb devices
maestro --version
```

Use either:

1. the latest verified installable KRAVIA CI-test APK; or
2. a locally built installable test APK.

Record the exact APK SHA-256 in `TEST_EXECUTION_REPORT.md`.

## Step 5 — add Maestro flows

Create:

```
Authenticator/
  .maestro/
    00-launch-lock.yaml
    01-manual-enrollment.yaml
    02-invalid-enrollment.yaml
    03-code-screen.yaml
    04-background-lock.yaml
    05-offline-code.yaml
    06-remove-enrollment.yaml
```

Use stable visible text/accessibility ids.

If current UI lacks stable automation identifiers, add minimal accessibility/test identifiers without weakening security or changing customer behavior.

### Required native assertions

- app launches to protected state;
- local-auth gate is present;
- enrollment cannot expose a previously stored account after a clean install;
- manual enrollment accepts a valid KRAVIA corporate account and valid seed;
- invalid account/seed is rejected;
- TOTP code screen renders;
- code changes over time;
- clipboard-copy affordance does not exist;
- app background/foreground returns locked;
- offline/airplane mode still permits TOTP generation after enrollment;
- remove enrollment requires confirmation;
- clear app data/reinstall requires fresh enrollment.

Do not attempt to bypass the operating-system biometric boundary in production code for testing.

For emulator-only biometric automation, use operating-system/emulator test facilities. Keep any helper strictly outside production runtime behavior.

## Step 6 — Android security inspection

After native prebuild/build, inspect the final merged release manifest.

Fail if it contains:

- `android.permission.INTERNET`
- `android.permission.RECORD_AUDIO`

Require:

- camera permission only for enrollment;
- backup disabled;
- expected package id.

Verify the APK signature using Android build tools.

Record signer certificate details and SHA-256 in the execution report.

## Step 7 — iOS

If running on macOS with Xcode:

- generate/build the iOS native project;
- run iOS Simulator;
- run Maestro flows where supported;
- test Face ID/Touch ID simulator behavior;
- test app background lock;
- test reinstall/Keychain boundary;
- verify offline TOTP.

If the environment is not macOS/Xcode-capable:

- do not fabricate results;
- mark iOS native execution `BLOCKED_EXTERNAL_ENVIRONMENT`;
- keep iOS source/export/type/security tests running;
- leave exact manual steps for the next macOS/physical-iPhone run.

## Step 8 — optional Appium fallback

Only add Appium if Maestro cannot reliably test a required scenario.

If used:

- document the exact Maestro limitation;
- keep the Appium scope small;
- use UiAutomator2 for Android;
- do not duplicate the whole Maestro suite;
- remain local/free.

## Step 9 — run the full repository gates

After Playwright/Maestro implementation:

Authenticator:

```bash
cd Authenticator
npm ci
npx expo install --check
npm run typecheck
npm test
```

Frontend:

```bash
cd Frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test
```

Backend:

```bash
cd Backend
python -m pytest backend/tests -q
python scripts/quality_gate.py
```

Native Android:

```bash
adb devices
maestro test Authenticator/.maestro
```

Adjust the Maestro invocation to the actual working directory if required, but keep the flows under `Authenticator/.maestro/`.

## Step 10 — evidence and final report

Create/update:

`docs/kravia-office/authenticator/TEST_EXECUTION_REPORT.md`

Include:

- tested commit SHA;
- OS;
- Node version;
- Python version;
- Java version;
- Playwright version;
- browser versions/projects;
- Maestro version;
- Android SDK/emulator version;
- emulator model/API level;
- APK filename;
- APK SHA-256;
- APK signer evidence;
- exact commands run;
- per-suite pass/fail/skip counts;
- defect list;
- fixes made;
- remaining external gates;
- physical-device gates still required.

Screenshots/traces/videos generated by tests should go to test-artifact folders ignored by Git unless a small artifact is deliberately retained as permanent evidence.

Do not commit huge generated videos, emulator images, node_modules, build directories, APKs or secrets.

## Completion definition

Codex may say the automated test implementation is complete only when:

- required Playwright tests are implemented;
- the Playwright suite has actually been executed on the available environment;
- required Maestro Android flows are implemented;
- Maestro flows have actually been executed when an Android emulator/device is available;
- existing unit/security tests remain green;
- frontend build remains green;
- backend quality gate remains green;
- all failures introduced by the work are fixed;
- execution evidence is written to `TEST_EXECUTION_REPORT.md`;
- unavailable external platforms are explicitly marked blocked/pending;
- no production secret is committed;
- no paid testing dependency is required.

After all locally executable work is green, create one final commit and push `main`.
