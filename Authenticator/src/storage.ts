import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { validateStoredAccount } from "./account-validation";
import type { KraviaTotpAccount } from "./types";

const STORE_KEY = "kravia.authenticator.account.v1";
const PENDING_ACTIVATION_STORE_KEY = "kravia.authenticator.activation.v1";
const INSTALL_SECURE_KEY = "kravia.authenticator.install.secure.v1";
const INSTALL_FILE_NAME = "kravia-authenticator-install-v1.txt";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v1",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

async function requireSecureStore() {
  if (!await SecureStore.isAvailableAsync()) {
    throw new Error("Secure device storage is unavailable");
  }
}

function markerPath() {
  if (!FileSystem.documentDirectory) throw new Error("Private app storage is unavailable");
  return `${FileSystem.documentDirectory}${INSTALL_FILE_NAME}`;
}

function newInstallMarker() {
  // This is a non-secret reinstall marker, not an authentication credential.
  // Uniqueness is sufficient; cryptographic secrecy is unnecessary.
  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join("-");
}

async function readLocalInstallMarker() {
  const path = markerPath();
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const value = (await FileSystem.readAsStringAsync(path)).trim();
  return value || null;
}

async function writeLocalInstallMarker(value: string) {
  await FileSystem.writeAsStringAsync(markerPath(), value, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function enforceInstallationBoundary() {
  await requireSecureStore();
  const [localMarker, secureMarker, existingAccount] = await Promise.all([
    readLocalInstallMarker(),
    SecureStore.getItemAsync(INSTALL_SECURE_KEY, OPTIONS),
    SecureStore.getItemAsync(STORE_KEY, OPTIONS),
  ]);

  if (localMarker && secureMarker && localMarker === secureMarker) {
    return { reset: false as const };
  }

  // iOS Keychain values can survive uninstall. A fresh/mismatched application
  // container must never silently resurrect a previous TOTP seed.
  await Promise.all([
    SecureStore.deleteItemAsync(STORE_KEY, OPTIONS),
    SecureStore.deleteItemAsync(PENDING_ACTIVATION_STORE_KEY, OPTIONS),
  ]);
  const marker = newInstallMarker();
  await SecureStore.setItemAsync(INSTALL_SECURE_KEY, marker, OPTIONS);
  await writeLocalInstallMarker(marker);
  return { reset: Boolean(existingAccount) };
}

export async function saveAccount(account: KraviaTotpAccount) {
  await requireSecureStore();
  const valid = validateStoredAccount(account);
  if (!valid) throw new Error("KRAVIA authenticator enrollment is invalid");
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(valid), OPTIONS);
}

export async function loadAccount() {
  await requireSecureStore();
  const value = await SecureStore.getItemAsync(STORE_KEY, OPTIONS);
  if (!value) return null;
  try {
    const account = validateStoredAccount(JSON.parse(value));
    if (!account) {
      await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
      return null;
    }
    return account;
  } catch {
    await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
    return null;
  }
}

export async function clearAccount() {
  await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
}

export type StoredAuthenticatorActivation = {
  requestId: string;
  claimToken: string;
  expiresAt: string;
};

function validPendingActivation(value: unknown): StoredAuthenticatorActivation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<StoredAuthenticatorActivation>;
  if (
    typeof item.requestId !== "string" || item.requestId.length !== 36
    || typeof item.claimToken !== "string" || item.claimToken.length < 32
    || typeof item.expiresAt !== "string" || !Number.isFinite(Date.parse(item.expiresAt))
  ) return null;
  return { requestId: item.requestId, claimToken: item.claimToken, expiresAt: item.expiresAt };
}

export async function savePendingActivation(activation: StoredAuthenticatorActivation) {
  await requireSecureStore();
  const valid = validPendingActivation(activation);
  if (!valid) throw new Error("Authenticator activation is invalid");
  await SecureStore.setItemAsync(PENDING_ACTIVATION_STORE_KEY, JSON.stringify(valid), OPTIONS);
}

export async function loadPendingActivation() {
  await requireSecureStore();
  const value = await SecureStore.getItemAsync(PENDING_ACTIVATION_STORE_KEY, OPTIONS);
  if (!value) return null;
  try {
    const activation = validPendingActivation(JSON.parse(value));
    if (!activation || Date.parse(activation.expiresAt) <= Date.now()) {
      await SecureStore.deleteItemAsync(PENDING_ACTIVATION_STORE_KEY, OPTIONS);
      return null;
    }
    return activation;
  } catch {
    await SecureStore.deleteItemAsync(PENDING_ACTIVATION_STORE_KEY, OPTIONS);
    return null;
  }
}

export async function clearPendingActivation() {
  await SecureStore.deleteItemAsync(PENDING_ACTIVATION_STORE_KEY, OPTIONS);
}
