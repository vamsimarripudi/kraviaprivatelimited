import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve("android/app/build.gradle");
let source = readFileSync(file, "utf8");

if (source.includes("kraviaRelease")) {
  process.stdout.write("KRAVIA release signing is already configured.\n");
  process.exit(0);
}

const signingMarker = /signingConfigs\s*\{\s*\n/;
if (!signingMarker.test(source)) {
  throw new Error("Android signingConfigs block was not found");
}

source = source.replace(
  signingMarker,
  (match) => `${match}        kraviaRelease {
            def storePath = System.getenv("KRAVIA_AUTH_ANDROID_KEYSTORE_PATH")
            def storePasswordValue = System.getenv("KRAVIA_AUTH_ANDROID_KEYSTORE_PASSWORD")
            def keyAliasValue = System.getenv("KRAVIA_AUTH_ANDROID_KEY_ALIAS")
            def keyPasswordValue = System.getenv("KRAVIA_AUTH_ANDROID_KEY_PASSWORD")
            if (!storePath || !storePasswordValue || !keyAliasValue || !keyPasswordValue) {
                throw new GradleException("KRAVIA Authenticator production signing environment is incomplete")
            }
            storeFile file(storePath)
            storePassword storePasswordValue
            keyAlias keyAliasValue
            keyPassword keyPasswordValue
        }
`,
);

const releaseSigning = /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
if (!releaseSigning.test(source)) {
  throw new Error("Android release buildType debug signing assignment was not found");
}

source = source.replace(
  releaseSigning,
  (_whole, prefix) => `${prefix}signingConfig signingConfigs.kraviaRelease`,
);

if (!source.includes("signingConfig signingConfigs.kraviaRelease")) {
  throw new Error("KRAVIA release signing was not applied");
}
if (/release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(source)) {
  throw new Error("Release build still references Android debug signing");
}

writeFileSync(file, source);
process.stdout.write("KRAVIA Authenticator production signing configured.\n");
