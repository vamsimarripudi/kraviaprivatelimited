import * as SecureStore from "expo-secure-store";
import { KRAVIA_ISSUER, type KraviaTotpAccount } from "./types";

const STORE_KEY = "kravia.authenticator.account.v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v1",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

function validate(value: unknown): KraviaTotpAccount | null {
  if (!value || typeof value !== "object") return null;
  const account = value as Partial<KraviaTotpAccount>;
  if (
    account.version !== 1
    || account.issuer !== KRAVIA_ISSUER
    || typeof account.account !== "string"
    || typeof account.secret !== "string"
    || account.algorithm !== "SHA1"
    || account.digits !== 6
    || account.period !== 30
    || typeof account.enrolledAt !== "string"
  ) {
    return null;
  }
  return account as KraviaTotpAccount;
}

export async function saveAccount(account: KraviaTotpAccount) {
  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error("Secure device storage is unavailable");
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(account), OPTIONS);
}

export async function loadAccount() {
  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error("Secure device storage is unavailable");
  const value = await SecureStore.getItemAsync(STORE_KEY, OPTIONS);
  if (!value) return null;
  try {
    return validate(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function clearAccount() {
  await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
}
