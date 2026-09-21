import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { usePreventScreenCapture } from "expo-screen-capture";
import { generateTotp, totpWindow } from "./src/totp";
import { manualKraviaAccount, parseKraviaProvisioningUri } from "./src/provisioning";
import { clearAccount, enforceInstallationBoundary, loadAccount, saveAccount } from "./src/storage";
import { unlockAuthenticator } from "./src/security";
import type { KraviaTotpAccount } from "./src/types";

type Mode = "home" | "scan" | "manual";

function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondaryButton,
        variant === "danger" && styles.dangerButton,
        (disabled || pressed) && styles.buttonPressed,
      ]}
    >
      <Text style={[
        styles.buttonText,
        variant === "secondary" && styles.secondaryButtonText,
        variant === "danger" && styles.dangerButtonText,
      ]}>{label}</Text>
    </Pressable>
  );
}

function Scanner({
  onScanned,
  onCancel,
}: {
  onScanned: (value: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Camera permission required</Text>
        <Text style={styles.body}>KRAVIA Authenticator uses the camera only to scan the KRAVIA Office enrollment QR code.</Text>
        <Button label="Allow camera" onPress={() => void requestPermission()} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    );
  }

  async function scanned(result: BarcodeScanningResult) {
    if (busy) return;
    setBusy(true);
    try {
      await onScanned(result.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.scannerShell}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={busy ? undefined : scanned}
      />
      <View style={styles.scannerOverlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.scannerTitle}>Scan KRAVIA Office QR</Text>
        <Text style={styles.scannerText}>Only QR codes issued by KRAVIA Office are accepted.</Text>
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

export default function App() {
  usePreventScreenCapture("kravia-authenticator");

  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [account, setAccount] = useState<KraviaTotpAccount | null>(null);
  const [mode, setMode] = useState<Mode>("home");
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<string>();
  const [manualEmail, setManualEmail] = useState("");
  const [manualSecret, setManualSecret] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (Platform.OS === "ios") {
      void ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
      return () => {
        void ScreenCapture.disableAppSwitcherProtectionAsync();
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setLocked(true);
        setAccount(null);
        setMode("home");
        setManualEmail("");
        setManualSecret("");
        setMessage(undefined);
      }
    });
    return () => subscription.remove();
  }, []);

  const code = useMemo(
    () => account ? generateTotp(account.secret, now, account.digits, account.period) : "",
    [account, now],
  );
  const window = useMemo(() => totpWindow(now, account?.period ?? 30), [now, account?.period]);

  async function unlock() {
    setUnlocking(true);
    setMessage(undefined);
    try {
      const result = await unlockAuthenticator();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const boundary = await enforceInstallationBoundary();
      const stored = await loadAccount();
      setAccount(stored);
      setLocked(false);
      if (boundary.reset) {
        setMessage("A previous installation credential was removed. Re-enroll this phone from KRAVIA Office.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "KRAVIA Authenticator could not unlock.");
    } finally {
      setUnlocking(false);
    }
  }

  async function enroll(next: KraviaTotpAccount) {
    await saveAccount(next);
    setAccount(next);
    setMode("home");
    setManualEmail("");
    setManualSecret("");
    setMessage("KRAVIA Office account enrolled on this device.");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function scan(value: string) {
    setMessage(undefined);
    try {
      await enroll(parseKraviaProvisioningUri(value));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That QR code cannot be used.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function manualEnroll() {
    setMessage(undefined);
    try {
      await enroll(manualKraviaAccount(manualEmail, manualSecret));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Manual enrollment failed.");
    }
  }

  function removeEnrollment() {
    Alert.alert(
      "Remove KRAVIA Office account?",
      "You will need a new Office MFA enrollment before you can sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const auth = await unlockAuthenticator();
              if (!auth.ok) {
                setMessage(auth.message);
                return;
              }
              await clearAccount();
              setAccount(null);
              setMode("home");
              setMessage("Authenticator enrollment removed from this phone.");
            })();
          },
        },
      ],
    );
  }

  if (locked) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.lockScreen}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>K</Text></View>
          <Text style={styles.kicker}>KRAVIA PRIVATE LIMITED</Text>
          <Text style={styles.title}>KRAVIA{"\n"}Authenticator</Text>
          <Text style={styles.bodyCenter}>
            Offline one-time codes for KRAVIA Office and Finance. Protected by your device security.
          </Text>
          {message ? <Text style={styles.error}>{message}</Text> : null}
          <Button
            label={unlocking ? "Unlocking…" : "Unlock authenticator"}
            onPress={() => void unlock()}
            disabled={unlocking}
          />
          <Text style={styles.securityNote}>No password · No network · No clipboard export</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === "scan") {
    return (
      <SafeAreaView style={styles.root}>
        <Scanner onScanned={scan} onCancel={() => setMode("home")} />
        {message ? <Text style={styles.floatingError}>{message}</Text> : null}
      </SafeAreaView>
    );
  }

  if (!account && mode === "manual") {
    return (
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.kicker}>MANUAL ENROLLMENT</Text>
            <Text style={styles.sectionTitle}>Add KRAVIA Office</Text>
            <Text style={styles.body}>
              Use this only if you cannot scan the QR code. Enter the corporate account and the setup key shown by KRAVIA Office.
            </Text>
            <Text style={styles.label}>Corporate account</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={manualEmail}
              onChangeText={setManualEmail}
              placeholder="name@kraviaprivatelimited.com"
            />
            <Text style={styles.label}>Setup key</Text>
            <TextInput
              style={[styles.input, styles.monoInput]}
              autoCapitalize="characters"
              autoCorrect={false}
              secureTextEntry
              value={manualSecret}
              onChangeText={(value) => setManualSecret(value.toUpperCase())}
              placeholder="JBSW Y3DP ..."
            />
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Button label="Save authenticator" onPress={() => void manualEnroll()} />
            <Button label="Back" variant="secondary" onPress={() => { setMode("home"); setMessage(undefined); }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!account) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.kicker}>KRAVIA AUTHENTICATOR</Text>
              <Text style={styles.sectionTitle}>Enroll this phone</Text>
            </View>
            <Pressable onPress={() => { setLocked(true); setAccount(null); setManualEmail(""); setManualSecret(""); setMessage(undefined); }}><Text style={styles.link}>Lock</Text></Pressable>
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>1. Sign in to KRAVIA Office</Text>
            <Text style={styles.body}>After your password is accepted, Office will display the mandatory KRAVIA Authenticator QR code.</Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>2. Scan here</Text>
            <Text style={styles.body}>The app accepts only KRAVIA Office TOTP enrollment. Other issuers are rejected.</Text>
          </View>
          <Button label="Scan KRAVIA QR" onPress={() => { setMessage(undefined); setMode("scan"); }} />
          <Button label="Enter setup key" variant="secondary" onPress={() => { setMessage(undefined); setMode("manual"); }} />
          {message ? <Text style={styles.success}>{message}</Text> : null}
          <Text style={styles.securityNote}>Keep automatic date & time enabled on this phone.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>KRAVIA AUTHENTICATOR</Text>
            <Text style={styles.sectionTitle}>Login code</Text>
          </View>
          <Pressable onPress={() => { setLocked(true); setAccount(null); setManualEmail(""); setManualSecret(""); setMessage(undefined); }}><Text style={styles.link}>Lock</Text></Pressable>
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.issuer}>{account.issuer}</Text>
          <Text style={styles.account}>{account.account}</Text>
          <Text accessibilityRole="text" accessibilityLabel={`Current KRAVIA login code ${code}`} style={styles.code}>{code.slice(0, 3)} {code.slice(3)}</Text>
          <Text style={styles.remaining}>{window.remaining}s remaining</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(Math.max(0, Math.min(100, window.progress * 100)))}%` as `${number}%` }]} />
          </View>
          <Text style={styles.tapHint}>Read and type this code into KRAVIA Office. Clipboard export is disabled.</Text>
        </View>

        {message ? <Text style={styles.info}>{message}</Text> : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>How to sign in</Text>
          <Text style={styles.body}>Enter your KRAVIA Office password, then type this current six-digit code. The code changes every 30 seconds and is generated entirely on this phone.</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Security boundary</Text>
          <Text style={styles.body}>The TOTP secret stays in device secure storage. The app has no Office password and does not send the current code to KRAVIA or any third party.</Text>
        </View>

        <Button label="Remove enrollment" variant="danger" onPress={removeEnrollment} />
        <Text style={styles.securityNote}>If this phone is lost, an Office administrator must reset MFA before a replacement phone can enroll.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7f5" },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 36, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockScreen: { flex: 1, justifyContent: "center", padding: 28, gap: 18 },
  brandMark: { width: 58, height: 58, borderRadius: 16, backgroundColor: "#123d2e", alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#fff", fontSize: 30, fontWeight: "900" },
  kicker: { color: "#53645c", fontSize: 11, fontWeight: "800", letterSpacing: 1.7 },
  title: { color: "#101612", fontSize: 48, fontWeight: "900", letterSpacing: -2.1, lineHeight: 49 },
  sectionTitle: { color: "#101612", fontSize: 30, fontWeight: "800", letterSpacing: -1.1, marginTop: 4 },
  body: { color: "#5d6862", fontSize: 15, lineHeight: 22 },
  bodyCenter: { color: "#5d6862", fontSize: 15, lineHeight: 23, textAlign: "left", maxWidth: 420 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  link: { color: "#126344", fontSize: 14, fontWeight: "800", padding: 8 },
  panel: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0e5e1", borderRadius: 16, padding: 16, gap: 6 },
  panelTitle: { color: "#172019", fontSize: 15, fontWeight: "800" },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: "#123d2e", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  secondaryButton: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d2d9d5" },
  dangerButton: { backgroundColor: "#fff4f3", borderWidth: 1, borderColor: "#e8c8c5" },
  buttonPressed: { opacity: 0.68 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryButtonText: { color: "#28342e" },
  dangerButtonText: { color: "#8a302a" },
  label: { color: "#3f4a44", fontSize: 12, fontWeight: "800", marginTop: 4 },
  input: { minHeight: 50, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8dfda", borderRadius: 12, paddingHorizontal: 14, color: "#101612", fontSize: 15 },
  monoInput: { letterSpacing: 1.2, fontVariant: ["tabular-nums"] },
  error: { color: "#8a302a", backgroundColor: "#fff1f0", borderRadius: 12, padding: 12, lineHeight: 19 },
  floatingError: { position: "absolute", left: 20, right: 20, bottom: 22, color: "#8a302a", backgroundColor: "#fff1f0", borderRadius: 12, padding: 12 },
  success: { color: "#15593f", backgroundColor: "#eaf5ee", borderRadius: 12, padding: 12, lineHeight: 19 },
  info: { color: "#42524a", backgroundColor: "#eef1ef", borderRadius: 12, padding: 12, lineHeight: 19 },
  securityNote: { color: "#78827d", fontSize: 11, lineHeight: 17, textAlign: "center" },
  scannerShell: { flex: 1, backgroundColor: "#0d1511" },
  camera: { ...StyleSheet.absoluteFill },
  scannerOverlay: { flex: 1, justifyContent: "flex-end", padding: 24, gap: 12, backgroundColor: "rgba(0,0,0,.25)" },
  scanFrame: { position: "absolute", alignSelf: "center", top: "22%", width: 250, height: 250, borderRadius: 24, borderWidth: 3, borderColor: "#d9ffe8", backgroundColor: "transparent" },
  scannerTitle: { color: "#fff", fontSize: 25, fontWeight: "900" },
  scannerText: { color: "#e8eee9", fontSize: 14, lineHeight: 20, marginBottom: 4 },
  accountCard: { backgroundColor: "#102f24", borderRadius: 24, padding: 24, gap: 8, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 5 },
  issuer: { color: "#b9d8c8", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  account: { color: "#fff", fontSize: 15, fontWeight: "600" },
  code: { color: "#fff", fontSize: 48, fontWeight: "900", letterSpacing: 3, marginTop: 16, fontVariant: ["tabular-nums"] },
  remaining: { color: "#b9d8c8", fontSize: 12, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 99, backgroundColor: "rgba(255,255,255,.16)", overflow: "hidden", marginTop: 4 },
  progressFill: { height: "100%", backgroundColor: "#a9edc8" },
  tapHint: { color: "#a6b9af", fontSize: 10, marginTop: 4 },
});
