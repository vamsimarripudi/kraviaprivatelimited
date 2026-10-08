import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export type BiometricReadiness = {
  available: boolean;
  method: string;
  detail: string;
};

export function biometricMethodFor(
  platform: string,
  authenticationTypes: readonly number[],
) {
  const hasFace = authenticationTypes.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
  );
  const hasFingerprint = authenticationTypes.includes(
    LocalAuthentication.AuthenticationType.FINGERPRINT,
  );
  if (platform === "ios") {
    if (hasFace) return "Face ID";
    if (hasFingerprint) return "Touch ID";
    return "Face ID";
  }
  if (platform === "android") {
    if (hasFace && hasFingerprint) return "Face or fingerprint";
    if (hasFace) return "Face recognition";
    if (hasFingerprint) return "Fingerprint";
    return "Face or fingerprint";
  }
  return "Strong biometrics";
}

export async function inspectBiometricReadiness(): Promise<BiometricReadiness> {
  const [hasHardware, enrolled, level, authenticationTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const method = biometricMethodFor(Platform.OS, authenticationTypes);
  const available =
    hasHardware &&
    enrolled &&
    level >= LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
  return {
    available,
    method,
    detail: available
      ? `${method} is enabled and required to unlock Authenticator.`
      : Platform.OS === "android"
        ? "Enable a strong fingerprint or face biometric in Android Settings before using Authenticator."
        : "Enable Face ID or Touch ID and a device passcode before using Authenticator.",
  };
}

function biometricFailureMessage(error: string, method: string) {
  switch (error) {
    case "not_available":
      return Platform.OS === "ios"
        ? "Face ID is unavailable in this app build. Expo Go cannot perform Face ID; install a KRAVIA development or production build to use it."
        : "Strong biometric authentication is unavailable. Enrol a strong face or fingerprint biometric in Android Settings, then try again.";
    case "not_enrolled":
    case "passcode_not_set":
      return `Set up ${method} and a device passcode in Settings before unlocking Authenticator.`;
    case "lockout":
      return `${method} is temporarily locked after unsuccessful attempts. Unlock your device in Settings, then try again.`;
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
      return `${method} was cancelled. Try again when you are ready.`;
    case "authentication_failed":
      return `${method} did not recognise you. Try again.`;
    default:
      return `${method} could not complete. Check your device biometric settings and try again.`;
  }
}

export async function unlockAuthenticator() {
  const readiness = await inspectBiometricReadiness();
  if (!readiness.available) return { ok: false as const, message: readiness.detail };
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
  if (result.success) return { ok: true as const };
  return {
    ok: false as const,
    message: biometricFailureMessage(result.error, readiness.method),
  };
}
