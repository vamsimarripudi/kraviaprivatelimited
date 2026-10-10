import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredPermissions = [
  "android.permission.INTERNET",
  "android.permission.USE_BIOMETRIC",
  "android.permission.CAMERA",
];
const forbiddenPermissions = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.RECORD_AUDIO",
];

const app = JSON.parse(readFileSync(resolve("app.json"), "utf8"));
const android = app?.expo?.android;

if (!android) {
  throw new Error("app.json does not define an Android application configuration.");
}

for (const permission of requiredPermissions) {
  if (!android.permissions?.includes(permission)) {
    throw new Error(`Required Android permission is missing from app.json: ${permission}`);
  }
}

for (const permission of forbiddenPermissions) {
  if (android.permissions?.includes(permission)) {
    throw new Error(`Forbidden Android permission is requested in app.json: ${permission}`);
  }
  if (!android.blockedPermissions?.includes(permission)) {
    throw new Error(`Forbidden Android permission is not blocked in app.json: ${permission}`);
  }
}

if (android.versionCode !== 2) {
  throw new Error(`Expected Android versionCode 2, received ${String(android.versionCode)}.`);
}

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.log("Android permission configuration verified.");
  process.exit(0);
}

const manifest = readFileSync(resolve(manifestPath), "utf8");
for (const permission of requiredPermissions) {
  if (!manifest.includes(permission)) {
    throw new Error(`Required permission is absent from the merged AndroidManifest.xml: ${permission}`);
  }
}
for (const permission of forbiddenPermissions) {
  if (manifest.includes(permission)) {
    throw new Error(`Forbidden permission is present in the merged AndroidManifest.xml: ${permission}`);
  }
}

console.log(`Merged Android permission boundary verified: ${resolve(manifestPath)}`);
