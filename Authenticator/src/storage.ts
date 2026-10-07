import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

const SESSION_STORE_KEY = "kravia.authenticator.device-session.v3";
const PENDING_DEVICE_STORE_KEY = "kravia.authenticator.pending-device.v3";
const TRUSTED_DEVICE_STORE_KEY = "kravia.authenticator.trusted-device.v3";
const INSTALL_SECURE_KEY = "kravia.authenticator.install.secure.v3";
const INSTALL_FILE_NAME = "kravia-authenticator-install-v3.txt";
const RETIRED_STORE_KEYS = ["kravia.authenticator.account.v2", "kravia.authenticator.activation.v2", "kravia.authenticator.activation-session.v2", "kravia.office.email-session.v1", "kravia.authenticator.account.v1", "kravia.authenticator.activation.v1"] as const;

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v3",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};
const RETIRED_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kravia-authenticator-v2",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export type AuthenticatorDeviceSession = {
  version: 1;
  purpose: "AUTHENTICATOR_ACTIVATION";
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  deviceApprovalId: string;
  deviceProof: string;
};
export type PendingDeviceApproval = {
  version: 1;
  email: string;
  approvalId: string;
  deviceProof: string;
  expiresAt: string;
  deviceLabel: string;
};
export type TrustedDeviceBinding = Pick<AuthenticatorDeviceSession, "deviceApprovalId" | "deviceProof">;

async function requireSecureStore() {
  if (!await SecureStore.isAvailableAsync()) throw new Error("Secure device storage is unavailable.");
}
function markerPath() {
  if (!FileSystem.documentDirectory) throw new Error("Private app storage is unavailable.");
  return `${FileSystem.documentDirectory}${INSTALL_FILE_NAME}`;
}
function newInstallMarker() { return [Date.now().toString(36), Math.random().toString(36).slice(2), Math.random().toString(36).slice(2)].join("-"); }
function validIdentifier(value: unknown) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value); }
function validSecret(value: unknown) { return typeof value === "string" && /^[A-Za-z0-9_-]{32,}$/.test(value); }
function validAccessToken(value: unknown) { return typeof value === "string" && /^[A-Za-z0-9._-]{32,}$/.test(value); }

function validSession(value: unknown): AuthenticatorDeviceSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<AuthenticatorDeviceSession>;
  if (session.version !== 1 || session.purpose !== "AUTHENTICATOR_ACTIVATION" || typeof session.email !== "string" || !validAccessToken(session.accessToken) || !validSecret(session.refreshToken) || !validIdentifier(session.deviceApprovalId) || !validSecret(session.deviceProof) || typeof session.expiresAt !== "string" || Date.parse(session.expiresAt) <= Date.now()) return null;
  return { ...session, email: session.email.trim().toLowerCase(), expiresAt: new Date(session.expiresAt).toISOString() } as AuthenticatorDeviceSession;
}
function validPending(value: unknown): PendingDeviceApproval | null {
  if (!value || typeof value !== "object") return null;
  const pending = value as Partial<PendingDeviceApproval>;
  if (pending.version !== 1 || typeof pending.email !== "string" || !validIdentifier(pending.approvalId) || !validSecret(pending.deviceProof) || typeof pending.expiresAt !== "string" || Date.parse(pending.expiresAt) <= Date.now() || typeof pending.deviceLabel !== "string" || !pending.deviceLabel.trim()) return null;
  return { ...pending, email: pending.email.trim().toLowerCase(), expiresAt: new Date(pending.expiresAt).toISOString(), deviceLabel: pending.deviceLabel.trim() } as PendingDeviceApproval;
}
async function readMarker() {
  const path = markerPath();
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const value = (await FileSystem.readAsStringAsync(path)).trim();
  return value || null;
}
async function writeMarker(value: string) { await FileSystem.writeAsStringAsync(markerPath(), value, { encoding: FileSystem.EncodingType.UTF8 }); }

export async function enforceInstallationBoundary() {
  await requireSecureStore();
  await Promise.all(RETIRED_STORE_KEYS.map((key) => SecureStore.deleteItemAsync(key, RETIRED_OPTIONS)));
  const [localMarker, secureMarker, existingSession] = await Promise.all([readMarker(), SecureStore.getItemAsync(INSTALL_SECURE_KEY, OPTIONS), SecureStore.getItemAsync(SESSION_STORE_KEY, OPTIONS)]);
  if (localMarker && secureMarker && localMarker === secureMarker) return { reset: false as const };
  await Promise.all([SecureStore.deleteItemAsync(SESSION_STORE_KEY, OPTIONS), SecureStore.deleteItemAsync(PENDING_DEVICE_STORE_KEY, OPTIONS), SecureStore.deleteItemAsync(TRUSTED_DEVICE_STORE_KEY, OPTIONS)]);
  const marker = newInstallMarker();
  await SecureStore.setItemAsync(INSTALL_SECURE_KEY, marker, OPTIONS);
  await writeMarker(marker);
  return { reset: Boolean(existingSession) };
}
export async function saveAuthenticatorSession(session: AuthenticatorDeviceSession) {
  await requireSecureStore();
  const valid = validSession(session);
  if (!valid) throw new Error("The trusted-device session is invalid.");
  await SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(valid), OPTIONS);
}
export async function loadAuthenticatorSession() {
  await requireSecureStore();
  const raw = await SecureStore.getItemAsync(SESSION_STORE_KEY, OPTIONS);
  if (!raw) return null;
  try { const session = validSession(JSON.parse(raw)); if (session) return session; } catch { /* Invalid protected state is removed below. */ }
  await SecureStore.deleteItemAsync(SESSION_STORE_KEY, OPTIONS);
  return null;
}
export async function clearAuthenticatorSession() { await SecureStore.deleteItemAsync(SESSION_STORE_KEY, OPTIONS); }
export async function saveTrustedDeviceBinding(binding: TrustedDeviceBinding) {
  await requireSecureStore();
  if (!validIdentifier(binding.deviceApprovalId) || !validSecret(binding.deviceProof)) throw new Error("The trusted-device binding is invalid.");
  await SecureStore.setItemAsync(TRUSTED_DEVICE_STORE_KEY, JSON.stringify(binding), OPTIONS);
}
export async function loadTrustedDeviceBinding(): Promise<TrustedDeviceBinding | null> {
  await requireSecureStore();
  const raw = await SecureStore.getItemAsync(TRUSTED_DEVICE_STORE_KEY, OPTIONS);
  if (!raw) return null;
  try {
    const binding = JSON.parse(raw) as Partial<TrustedDeviceBinding>;
    const approvalId = binding.deviceApprovalId;
    const proof = binding.deviceProof;
    if (typeof approvalId === "string" && typeof proof === "string" && validIdentifier(approvalId) && validSecret(proof)) return { deviceApprovalId: approvalId, deviceProof: proof };
  } catch { /* Invalid protected state is removed below. */ }
  await SecureStore.deleteItemAsync(TRUSTED_DEVICE_STORE_KEY, OPTIONS);
  return null;
}
export async function clearTrustedDeviceBinding() { await SecureStore.deleteItemAsync(TRUSTED_DEVICE_STORE_KEY, OPTIONS); }
export async function savePendingDeviceApproval(pending: PendingDeviceApproval) {
  await requireSecureStore();
  const valid = validPending(pending);
  if (!valid) throw new Error("The device approval request is invalid or has expired.");
  await SecureStore.setItemAsync(PENDING_DEVICE_STORE_KEY, JSON.stringify(valid), OPTIONS);
}
export async function loadPendingDeviceApproval() {
  await requireSecureStore();
  const raw = await SecureStore.getItemAsync(PENDING_DEVICE_STORE_KEY, OPTIONS);
  if (!raw) return null;
  try { const pending = validPending(JSON.parse(raw)); if (pending) return pending; } catch { /* Invalid protected state is removed below. */ }
  await SecureStore.deleteItemAsync(PENDING_DEVICE_STORE_KEY, OPTIONS);
  return null;
}
export async function clearPendingDeviceApproval() { await SecureStore.deleteItemAsync(PENDING_DEVICE_STORE_KEY, OPTIONS); }
