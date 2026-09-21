import * as LocalAuthentication from "expo-local-authentication";

export async function unlockAuthenticator() {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      ok: false as const,
      message: "Set a device passcode and biometric unlock before using KRAVIA Authenticator.",
    };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock KRAVIA Authenticator",
    promptSubtitle: "Protect KRAVIA Office one-time codes",
    promptDescription: "Confirm your identity to view the current login code.",
    fallbackLabel: "Use device passcode",
    disableDeviceFallback: false,
    biometricsSecurityLevel: "strong",
    requireConfirmation: true,
  });

  return result.success
    ? { ok: true as const }
    : { ok: false as const, message: "Device authentication was not completed." };
}
