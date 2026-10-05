import * as SecureStore from "expo-secure-store";

const SESSION_STORE_KEY = "kravia.office.email-session.v1";
const LEGACY_ACCOUNT_STORE_KEY = "kravia.authenticator.account.v1";
const LEGACY_ACTIVATION_STORE_KEY = "kravia.authenticator.activation.v1";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-office-email-session-v1",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

const LEGACY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v1",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export type OfficeMobileSession = {
  version: 1;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

async function requireSecureStore() {
  if (!await SecureStore.isAvailableAsync()) throw new Error("Secure device storage is unavailable.");
}

function validSession(value: unknown): OfficeMobileSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<OfficeMobileSession>;
  if (session.version !== 1 || typeof session.email !== "string" || typeof session.accessToken !== "string" || typeof session.refreshToken !== "string" || typeof session.expiresAt !== "string") return null;
  if (!session.email.includes("@") || session.accessToken.length < 32 || session.refreshToken.length < 32 || Date.parse(session.expiresAt) <= Date.now()) return null;
  return { version: 1, email: session.email.toLowerCase(), accessToken: session.accessToken, refreshToken: session.refreshToken, expiresAt: session.expiresAt };
}

export async function retireLegacyTotpVault() {
  await requireSecureStore();
  // The email-OTP app must never reopen the retired local TOTP vault.
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_ACCOUNT_STORE_KEY, LEGACY_OPTIONS),
    SecureStore.deleteItemAsync(LEGACY_ACTIVATION_STORE_KEY, LEGACY_OPTIONS),
  ]);
}

export async function saveSignedInSession(session: OfficeMobileSession) {
  await requireSecureStore();
  const valid = validSession(session);
  if (!valid) throw new Error("The signed-in session is invalid.");
  await SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(valid), OPTIONS);
}

export async function loadSignedInSession() {
  await requireSecureStore();
  const raw = await SecureStore.getItemAsync(SESSION_STORE_KEY, OPTIONS);
  if (!raw) return null;
  try {
    const session = validSession(JSON.parse(raw));
    if (session) return session;
  } catch { /* Clear corrupted or expired session state below. */ }
  await SecureStore.deleteItemAsync(SESSION_STORE_KEY, OPTIONS);
  return null;
}

export async function clearSignedInSession() {
  await SecureStore.deleteItemAsync(SESSION_STORE_KEY, OPTIONS);
}
