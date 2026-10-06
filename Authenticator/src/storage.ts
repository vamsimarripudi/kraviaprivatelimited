import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { validateStoredAccount } from "./account-validation";
import type { KraviaTotpAccount } from "./types";

const ACCOUNT_STORE_KEY = "kravia.authenticator.account.v2";
const ACTIVATION_STORE_KEY = "kravia.authenticator.activation.v2";
const SESSION_STORE_KEY = "kravia.authenticator.activation-session.v2";
const INSTALL_SECURE_KEY = "kravia.authenticator.install.secure.v2";
const INSTALL_FILE_NAME = "kravia-authenticator-install-v2.txt";
const RETIRED_EMAIL_SESSION_STORE_KEY = "kravia.office.email-session.v1";
const RETIRED_ACCOUNT_STORE_KEY = "kravia.authenticator.account.v1";
const RETIRED_ACTIVATION_STORE_KEY = "kravia.authenticator.activation.v1";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v2",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

const RETIRED_EMAIL_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-office-email-session-v1",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

const RETIRED_AUTHENTICATOR_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v1",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export type AuthenticatorActivationSession = {
  version: 1;
  purpose: "AUTHENTICATOR_ACTIVATION";
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type PendingAuthenticatorActivation = {
  requestId: string;
  claimToken: string;
  expiresAt: string;
};

async function requireSecureStore() {
  if (!await SecureStore.isAvailableAsync()) throw new Error("Secure device storage is unavailable.");
}

function markerPath() {
  if (!FileSystem.documentDirectory) throw new Error("Private app storage is unavailable.");
  return `${FileSystem.documentDirectory}${INSTALL_FILE_NAME}`;
}

function newInstallMarker() {
  // A non-secret container marker prevents an iOS Keychain value that survives
  // uninstall from silently reappearing in a new application installation.
  return [Date.now().toString(36), Math.random().toString(36).slice(2), Math.random().toString(36).slice(2)].join("-");
}

async function clearRetiredSecureState() {
  // Neither the former email-only session nor the pre-approved TOTP vault may
  // survive as an orphaned keychain entry after this verified-device upgrade.
  await Promise.all([
    SecureStore.deleteItemAsync(RETIRED_EMAIL_SESSION_STORE_KEY, RETIRED_EMAIL_OPTIONS),
    SecureStore.deleteItemAsync(RETIRED_ACCOUNT_STORE_KEY, RETIRED_AUTHENTICATOR_OPTIONS),
    SecureStore.deleteItemAsync(RETIRED_ACTIVATION_STORE_KEY, RETIRED_AUTHENTICATOR_OPTIONS),
  ]);
}

async function readLocalInstallMarker() {
  const path = markerPath();
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const value = (await FileSystem.readAsStringAsync(path)).trim();
  return value || null;
}

async function writeLocalInstallMarker(value: string) {
  await FileSystem.writeAsStringAsync(markerPath(), value, { encoding: FileSystem.EncodingType.UTF8 });
}

function validSession(value: unknown): AuthenticatorActivationSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<AuthenticatorActivationSession>;
  if (
    session.version !== 1
    || session.purpose !== "AUTHENTICATOR_ACTIVATION"
    || typeof session.email !== "string"
    || typeof session.accessToken !== "string"
    || typeof session.refreshToken !== "string"
    || typeof session.expiresAt !== "string"
  ) return null;
  if (!session.email.includes("@") || session.accessToken.length < 32 || session.refreshToken.length < 32 || Date.parse(session.expiresAt) <= Date.now()) return null;
  return {
    version: 1,
    purpose: "AUTHENTICATOR_ACTIVATION",
    email: session.email.trim().toLowerCase(),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

function validPendingActivation(value: unknown): PendingAuthenticatorActivation | null {
  if (!value || typeof value !== "object") return null;
  const activation = value as Partial<PendingAuthenticatorActivation>;
  if (
    typeof activation.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(activation.requestId)
    || typeof activation.claimToken !== "string" || activation.claimToken.length < 32
    || typeof activation.expiresAt !== "string" || !Number.isFinite(Date.parse(activation.expiresAt))
    || Date.parse(activation.expiresAt) <= Date.now()
  ) return null;
  return {
    requestId: activation.requestId,
    claimToken: activation.claimToken,
    expiresAt: new Date(activation.expiresAt).toISOString(),
  };
}

export async function enforceInstallationBoundary() {
  await requireSecureStore();
  await clearRetiredSecureState();
  const [localMarker, secureMarker, existingAccount] = await Promise.all([
    readLocalInstallMarker(),
    SecureStore.getItemAsync(INSTALL_SECURE_KEY, OPTIONS),
    SecureStore.getItemAsync(ACCOUNT_STORE_KEY, OPTIONS),
  ]);
  if (localMarker && secureMarker && localMarker === secureMarker) return { reset: false as const };

  await Promise.all([
    SecureStore.deleteItemAsync(ACCOUNT_STORE_KEY, OPTIONS),
    SecureStore.deleteItemAsync(ACTIVATION_STORE_KEY, OPTIONS),
    SecureStore.deleteItemAsync(SESSION_STORE_KEY, OPTIONS),
  ]);
  const marker = newInstallMarker();
  await SecureStore.setItemAsync(INSTALL_SECURE_KEY, marker, OPTIONS);
  await writeLocalInstallMarker(marker);
  return { reset: Boolean(existingAccount) };
}

export async function saveAccount(account: KraviaTotpAccount) {
  await requireSecureStore();
  const valid = validateStoredAccount(account);
  if (!valid) throw new Error("Authenticator enrollment is invalid.");
  await SecureStore.setItemAsync(ACCOUNT_STORE_KEY, JSON.stringify(valid), OPTIONS);
}

export async function loadAccount() {
  await requireSecureStore();
  const raw = await SecureStore.getItemAsync(ACCOUNT_STORE_KEY, OPTIONS);
  if (!raw) return null;
  try {
    const account = validateStoredAccount(JSON.parse(raw));
    if (account) return account;
  } catch { /* Invalid sensitive state is cleared below. */ }
  await SecureStore.deleteItemAsync(ACCOUNT_STORE_KEY, OPTIONS);
  return null;
}

export async function clearAccount() {
  await SecureStore.deleteItemAsync(ACCOUNT_STORE_KEY, OPTIONS);
}

export async function savePendingActivation(activation: PendingAuthenticatorActivation) {
  await requireSecureStore();
  const valid = validPendingActivation(activation);
  if (!valid) throw new Error("Authenticator activation is invalid or has expired.");
  await SecureStore.setItemAsync(ACTIVATION_STORE_KEY, JSON.stringify(valid), OPTIONS);
}

export async function loadPendingActivation() {
  await requireSecureStore();
  const raw = await SecureStore.getItemAsync(ACTIVATION_STORE_KEY, OPTIONS);
  if (!raw) return null;
  try {
    const activation = validPendingActivation(JSON.parse(raw));
    if (activation) return activation;
  } catch { /* Invalid sensitive state is cleared below. */ }
  await SecureStore.deleteItemAsync(ACTIVATION_STORE_KEY, OPTIONS);
  return null;
}

export async function clearPendingActivation() {
  await SecureStore.deleteItemAsync(ACTIVATION_STORE_KEY, OPTIONS);
}

export async function saveAuthenticatorSession(session: AuthenticatorActivationSession) {
  await requireSecureStore();
  const valid = validSession(session);
  if (!valid) throw new Error("The mobile verification session is invalid.");
  await SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(valid), OPTIONS);
}

export async function loadAuthenticatorSession() {
  await requireSecureStore();
  const raw = await SecureStore.getItemAsync(SESSION_STORE_KEY, OPTIONS);
  if (!raw) return null;
  try {
    const session = validSession(JSON.parse(raw));
    if (session) return session;
  } catch { /* Invalid sensitive state is cleared below. */ }
  await SecureStore.deleteItemAsync(SESSION_STORE_KEY, OPTIONS);
  return null;
}

export async function clearAuthenticatorSession() {
  await SecureStore.deleteItemAsync(SESSION_STORE_KEY, OPTIONS);
}
