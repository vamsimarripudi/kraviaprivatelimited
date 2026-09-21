import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const gradlePath = resolve("android/app/build.gradle");
let source = readFileSync(gradlePath, "utf8");

const required = [
  "KRAVIA_ANDROID_KEYSTORE_PATH",
  "KRAVIA_ANDROID_KEYSTORE_PASSWORD",
  "KRAVIA_ANDROID_KEY_ALIAS",
  "KRAVIA_ANDROID_KEY_PASSWORD",
];
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing production signing environment variable: ${name}`);
  }
}

const debugSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

if (!source.includes(debugSigning)) {
  throw new Error("Expo Android signing template changed; refusing to patch production signing automatically.");
}

const productionSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def kraviaStorePath = System.getenv("KRAVIA_ANDROID_KEYSTORE_PATH")
            def kraviaStorePassword = System.getenv("KRAVIA_ANDROID_KEYSTORE_PASSWORD")
            def kraviaKeyAlias = System.getenv("KRAVIA_ANDROID_KEY_ALIAS")
            def kraviaKeyPassword = System.getenv("KRAVIA_ANDROID_KEY_PASSWORD")
            if (!kraviaStorePath || !kraviaStorePassword || !kraviaKeyAlias || !kraviaKeyPassword) {
                throw new GradleException("KRAVIA production signing credentials are required for release builds")
            }
            storeFile file(kraviaStorePath)
            storePassword kraviaStorePassword
            keyAlias kraviaKeyAlias
            keyPassword kraviaKeyPassword
        }
    }`;

source = source.replace(debugSigning, productionSigning);

const buildTypesStart = source.indexOf("    buildTypes {");
const releaseStart = source.indexOf("        release {", buildTypesStart);
const debugSigner = "            signingConfig signingConfigs.debug";
const signerIndex = source.indexOf(debugSigner, releaseStart);

if (buildTypesStart < 0 || releaseStart < 0 || signerIndex < 0) {
  throw new Error("Expo Android release build template changed; refusing to patch production signing automatically.");
}

source =
  source.slice(0, signerIndex)
  + "            signingConfig signingConfigs.release"
  + source.slice(signerIndex + debugSigner.length);

writeFileSync(gradlePath, source);
console.log("Configured KRAVIA Authenticator Android release signing without persisting credentials.");
