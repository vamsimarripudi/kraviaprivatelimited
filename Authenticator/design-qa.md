# Authenticator UI redesign — design QA

## Comparison target

- Source visual truth: `C:\Users\Vamsi\.codex\generated_images\01a0ec65-a073-76e2-8cb1-0028aa0cd361\exec-10f5cb04-5ad5-4f06-bb61-4d29ec583565.png` (selected generated concept 1, **Anchor Rail**).
- Intended viewport: 390 × 844 logical pixels, portrait.
- Intended state: first-run corporate credentials screen, no software keyboard visible.

## Implementation evidence

No native implementation screenshot has been captured yet. The project deliberately declares only `ios` and `android` in `app.json`; `expo start --web --port 8081` correctly refuses to create a web runtime. A browser screenshot would therefore not represent the native application and is not accepted as QA evidence.

The source update in `App.tsx` is ready for device inspection: the normal-height credentials and OTP screens use `KeyboardAvoidingView` and fixed `View` layout rather than `ScrollView`; typography, logo scale, progress rail, form density and bottom action placement were reduced and restructured to fit a 390 × 844 viewport.

## Required fidelity surfaces

- Fonts and typography: blocked pending native screenshot.
- Spacing and layout rhythm: blocked pending native screenshot.
- Colors and visual tokens: code uses the existing Midnight Sapphire token module; visual comparison pending.
- Image quality and asset fidelity: locked icon, splash, loading and Settings-reference asset hashes passed export preparation; native scale/crop still needs device confirmation.
- Copy and content: implementation preserves the credential → email code → trusted-device security flow; native wrapping needs confirmation.

## Required device checks

1. Open the credentials screen on a 390 × 844-class phone with no keyboard: no vertical scrolling and Continue remains visible.
2. Focus each field: the keyboard resizes rather than clears inputs or hides the action permanently.
3. Open the OTP screen: timer, six-digit field, Verify and resend state remain legible.
4. Complete a non-sensitive test flow through trusted-device approval and inspect locked, home and Security screens.
5. Capture the selected-login state and OTP state for a like-for-like comparison with the source concept.

final result: blocked
