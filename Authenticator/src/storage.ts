import * as SecureStore from "expo-secure-store";
import { validateStoredAccount } from "./account-validation";
import type { KraviaTotpAccount } from "./types";

const STORE_KEY = "kravia.authenticator.account.v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v1",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

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
    return validateStoredAccount(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function clearAccount() {
  await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
}
