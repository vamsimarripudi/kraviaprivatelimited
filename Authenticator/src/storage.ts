import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { normalizeBase32 } from "./base32";
import { KRAVIA_ISSUER, type KraviaTotpAccount } from "./types";

const STORE_KEY = "kravia.authenticator.account.v1";
const INSTALL_LOCAL_KEY = "kravia.authenticator.install.local.v1";
const INSTALL_SECURE_KEY = "kravia.authenticator.install.secure.v1";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v1",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

function validCorporateAccount(value: string) {
  return /^[^\s@]+@kraviaprivatelimited\.com$/.test(value.trim().toLowerCase());
}

function validate(value: unknown): KraviaTotpAccount | null {
  if (!value || typeof value !== "object") return null;
  const account = value as Partial<KraviaTotpAccount>;
  if (
    account.version !== 1
    || account.issuer !== KRAVIA_ISSUER
    || typeof account.account !== "string"
    || !validCorporateAccount(account.account)
    || typeof account.secret !== "string"
    || account.algorithm !== "SHA1"
    || account.digits !== 6
    || account.period !== 30
    || typeof account.enrolledAt !== "string"
  ) {
    return null;
  }

  try {
    const normalizedSecret = normalizeBase32(account.secret);
    if (normalizedSecret.length < 16 || !/^[A-Z2-7]+$/.test(normalizedSecret)) return null;
    return { ...account, account: account.account.trim().toLowerCase(), secret: normalizedSecret } as KraviaTotpAccount;
  } catch {
    return null;
  }
}

async function secureStorageAvailable() {
  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error("Secure device storage is unavailable.");
}

export async function enforceInstallationBoundary() {
  await secureStorageAvailable();
  const [localMarker, secureMarker, existingAccount] = await Promise.all([
    AsyncStorage.getItem(INSTALL_LOCAL_KEY),
    SecureStore.getItemAsync(INSTALL_SECURE_KEY, OPTIONS),
    SecureStore.getItemAsync(STORE_KEY, OPTIONS),
  ]);

  if (localMarker && secureMarker && localMarker === secureMarker) {
    return { reset: false as const };
  }

  // A missing/mismatched non-Keychain marker means this is a new installation
  // or a restored app container. iOS Keychain may survive uninstall, so never
  // resurrect a previous TOTP seed into a fresh installation.
  await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
  const marker = Crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALL_SECURE_KEY, marker, OPTIONS);
  await AsyncStorage.setItem(INSTALL_LOCAL_KEY, marker);
  return { reset: Boolean(existingAccount) };
}

export async function saveAccount(account: KraviaTotpAccount) {
  await secureStorageAvailable();
  const valid = validate(account);
  if (!valid) throw new Error("KRAVIA authenticator enrollment is invalid.");
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(valid), OPTIONS);
}

export async function loadAccount() {
  await secureStorageAvailable();
  const value = await SecureStore.getItemAsync(STORE_KEY, OPTIONS);
  if (!value) return null;
  try {
    const account = validate(JSON.parse(value));
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
