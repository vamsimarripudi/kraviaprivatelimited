import * as LocalAuthentication from "expo-local-authentication";

export async function unlockAuthenticator() {
  const [hasHardware, enrolled, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  if (!hasHardware || !enrolled || level < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
    return { ok: false as const, message: "Enable a strong fingerprint, Touch ID or Face ID and keep a device passcode enabled before using Authenticator." };
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Authenticator",
    promptSubtitle: "Protect KRAVIA Office one-time codes",
    promptDescription: "Confirm your identity to view the current login code.",
    // The local vault exposes a valid Office MFA code. Do not substitute the
    // device passcode for the required strong biometric check.
    fallbackLabel: "",
    disableDeviceFallback: true,
    biometricsSecurityLevel: "strong",
    requireConfirmation: true,
  });
  return result.success ? { ok: true as const } : { ok: false as const, message: "Device authentication was not completed." };
}
