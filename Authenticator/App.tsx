import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
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
type Tab = "authenticator" | "settings";
type LaunchPhase = "splash" | "ready" | "loading";

const BRAND_ICON = require("./assets/brand/icon.png");
const SPLASH_ART = require("./assets/brand/splash.jpg");
const LOADING_ART = require("./assets/brand/loading.jpg");
const APP_VERSION = "1.0.0";

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function BrandArtwork({ source, label }: { source: ImageSourcePropType; label: string }) {
  return (
    <View style={styles.artworkRoot} accessibilityLabel={label}>
      <Image source={source} resizeMode="contain" style={styles.artwork} />
    </View>
  );
}

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

function BottomTabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: tab === "authenticator" }}
        onPress={() => onChange("authenticator")}
        style={styles.tabItem}
      >
        <Text style={[styles.tabIcon, tab === "authenticator" && styles.tabActive]}>⌂</Text>
        <Text style={[styles.tabLabel, tab === "authenticator" && styles.tabActive]}>Authenticator</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: tab === "settings" }}
        onPress={() => onChange("settings")}
        style={styles.tabItem}
      >
        <View style={[styles.tabIndicator, tab === "settings" && styles.tabIndicatorActive]} />
        <Text style={[styles.tabIcon, tab === "settings" && styles.tabActive]}>⚙</Text>
        <Text style={[styles.tabLabel, tab === "settings" && styles.tabActive]}>Settings</Text>
      </Pressable>
    </View>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.settingIcon}><Text style={styles.settingIconText}>{icon}</Text></View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      {typeof value === "boolean" ? (
        <Switch
          value={value}
          disabled
          trackColor={{ false: "#aeb5b8", true: "#087341" }}
          thumbColor="#ffffff"
          ios_backgroundColor="#aeb5b8"
        />
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.settingRow}>{content}</Pressable>
  ) : (
    <View style={styles.settingRow}>{content}</View>
  );
}

function SettingsScreen({ account, onTab }: { account: KraviaTotpAccount | null; onTab: (tab: Tab) => void }) {
  const corporateAccount = account?.account ?? "No account enrolled";

  return (
    <SafeAreaView style={styles.settingsRoot}>
      <ScrollView contentContainerStyle={styles.settingsContent}>
        <View style={styles.settingsHeader}>
          <View style={styles.settingsBrand}>
            <Image source={BRAND_ICON} style={styles.settingsLogo} />
            <View>
              <Text style={styles.settingsWordmark}>KRAVIA</Text>
              <Text style={styles.settingsWordmarkSub}>AUTHENTICATOR</Text>
            </View>
          </View>
          <Text style={styles.settingsHeading}>Settings</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.accountSummary}
          onPress={() => Alert.alert(
            "KRAVIA Office",
            account
              ? `${account.account}\nIssuer: ${account.issuer}\nTOTP: 6 digits every 30 seconds`
              : "No KRAVIA Office account is enrolled on this phone.",
          )}
        >
          <View style={styles.accountSummaryIcon}><Text style={styles.accountSummaryIconText}>▦</Text></View>
          <View style={styles.accountSummaryCopy}>
            <Text style={styles.settingsEyebrow}>ENROLLED ACCOUNT</Text>
            <Text style={styles.accountSummaryTitle}>{account ? "KRAVIA Office" : "No enrollment"}</Text>
            <Text style={styles.accountSummaryEmail}>{corporateAccount}</Text>
            <View style={styles.enrollmentState}>
              <View style={[styles.statusDot, !account && styles.statusDotMuted]} />
              <Text style={styles.enrollmentStateText}>{account ? "1 account enrolled" : "Enrollment required"}</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={styles.settingsSectionTitle}>SECURITY</Text>
        <View style={styles.settingsCard}>
          <SettingRow icon="◎" title="Biometric Lock" subtitle="Use Face ID or Touch ID to unlock the app" value />
          <View style={styles.settingDivider} />
          <SettingRow icon="▣" title="Lock on Background" subtitle="Automatically lock when the app is sent to background" value />
          <View style={styles.settingDivider} />
          <SettingRow icon="▢" title="Clipboard Export" subtitle="Allow copying codes to clipboard" value={false} />
        </View>

        <Text style={styles.settingsSectionTitle}>SUPPORT</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            icon="?"
            title="Manual Enrollment Help"
            subtitle="Step-by-step guide to add your account"
            onPress={() => Alert.alert(
              "Manual Enrollment Help",
              "1. Sign in to KRAVIA Office.\n2. After your password is accepted, choose manual setup.\n3. Enter your KRAVIA corporate account and the setup key shown by Office.\n4. Save the authenticator and type the current 6-digit code back into Office.",
            )}
          />
        </View>

        <Text style={styles.settingsSectionTitle}>ABOUT</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            icon="✓"
            title="Privacy & Security"
            subtitle="How your data is protected"
            onPress={() => Alert.alert(
              "Privacy & Security",
              "KRAVIA Authenticator is an offline TOTP vault. It stores the enrolled secret in device secure storage, requires strong local authentication, blocks clipboard export, locks on background, and does not request Android INTERNET permission.",
            )}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="i"
            title="About KRAVIA Authenticator"
            subtitle="Learn more about KRAVIA"
            onPress={() => Alert.alert(
              "KRAVIA Authenticator",
              "Private secure access for KRAVIA Office and Finance. Operated by Kravia Private Limited.",
            )}
          />
          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}><Text style={styles.settingIconText}>⚙</Text></View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>App Version</Text>
              <Text style={styles.settingSubtitle}>{APP_VERSION}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.settingsFootnote}>
          Biometric lock and background lock are mandatory security controls. Clipboard export remains disabled.
        </Text>
      </ScrollView>
      <BottomTabs tab="settings" onChange={onTab} />
    </SafeAreaView>
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

  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("splash");
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [account, setAccount] = useState<KraviaTotpAccount | null>(null);
  const [mode, setMode] = useState<Mode>("home");
  const [tab, setTab] = useState<Tab>("authenticator");
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<string>();
  const [manualEmail, setManualEmail] = useState("");
  const [manualSecret, setManualSecret] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setLaunchPhase("ready"), 1100);
    return () => clearTimeout(timeout);
  }, []);

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
        setTab("authenticator");
        setManualEmail("");
        setManualSecret("");
        setMessage(undefined);
        setLaunchPhase("ready");
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

      setLaunchPhase("loading");
      const started = Date.now();
      const boundary = await enforceInstallationBoundary();
      const stored = await loadAccount();
      const remaining = 650 - (Date.now() - started);
      if (remaining > 0) await delay(remaining);

      setAccount(stored);
      setLocked(false);
      setTab("authenticator");
      setLaunchPhase("ready");
      if (boundary.reset) {
        setMessage("A previous installation credential was removed. Re-enroll this phone from KRAVIA Office.");
      }
    } catch (error) {
      setLaunchPhase("ready");
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

  function lockNow() {
    setLocked(true);
    setAccount(null);
    setMode("home");
    setTab("authenticator");
    setManualEmail("");
    setManualSecret("");
    setMessage(undefined);
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

  if (launchPhase === "splash") {
    return <BrandArtwork source={SPLASH_ART} label="KRAVIA Authenticator splash screen" />;
  }

  if (launchPhase === "loading") {
    return <BrandArtwork source={LOADING_ART} label="KRAVIA Authenticator loading screen" />;
  }

  if (locked) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.lockScreen}>
          <Image source={BRAND_ICON} style={styles.lockLogo} />
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

  if (tab === "settings") {
    return <SettingsScreen account={account} onTab={setTab} />;
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
            <Pressable onPress={lockNow}><Text style={styles.link}>Lock</Text></Pressable>
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
        <BottomTabs tab="authenticator" onChange={setTab} />
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
          <Pressable onPress={lockNow}><Text style={styles.link}>Lock</Text></Pressable>
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
      <BottomTabs tab="authenticator" onChange={setTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  artworkRoot: { flex: 1, backgroundColor: "#05251c", alignItems: "center", justifyContent: "center" },
  artwork: { width: "100%", height: "100%" },
  root: { flex: 1, backgroundColor: "#f6f7f5" },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 36, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockScreen: { flex: 1, justifyContent: "center", padding: 28, gap: 18 },
  lockLogo: { width: 96, height: 96, borderRadius: 22, alignSelf: "flex-start" },
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
  tabBar: { minHeight: 76, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e7ebe8", flexDirection: "row", paddingBottom: Platform.OS === "ios" ? 8 : 4 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, position: "relative" },
  tabIndicator: { position: "absolute", top: 0, width: 68, height: 4, borderRadius: 4, backgroundColor: "transparent" },
  tabIndicatorActive: { backgroundColor: "#087341" },
  tabIcon: { fontSize: 24, color: "#657169", fontWeight: "800" },
  tabLabel: { fontSize: 12, color: "#657169", fontWeight: "700" },
  tabActive: { color: "#087341" },
  settingsRoot: { flex: 1, backgroundColor: "#f8faf8" },
  settingsContent: { padding: 20, paddingTop: 24, paddingBottom: 28, gap: 14 },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  settingsBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  settingsLogo: { width: 48, height: 48, borderRadius: 12 },
  settingsWordmark: { color: "#0f4935", fontSize: 20, fontWeight: "900", letterSpacing: 4 },
  settingsWordmarkSub: { color: "#53645c", fontSize: 8, fontWeight: "800", letterSpacing: 2.6, marginTop: 2 },
  settingsHeading: { color: "#153d2e", fontSize: 30, fontWeight: "800", letterSpacing: -1 },
  accountSummary: { flexDirection: "row", alignItems: "center", backgroundColor: "#f5fbf8", borderWidth: 1, borderColor: "#e1ebe5", borderRadius: 18, padding: 16, gap: 14 },
  accountSummaryIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#d9f3e5", alignItems: "center", justifyContent: "center" },
  accountSummaryIconText: { color: "#087341", fontSize: 28, fontWeight: "900" },
  accountSummaryCopy: { flex: 1, gap: 3 },
  settingsEyebrow: { color: "#65717a", fontSize: 10, letterSpacing: 1.7, fontWeight: "800" },
  accountSummaryTitle: { color: "#101612", fontSize: 20, fontWeight: "800" },
  accountSummaryEmail: { color: "#5d6872", fontSize: 14 },
  enrollmentState: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0ca65b" },
  statusDotMuted: { backgroundColor: "#aeb7b2" },
  enrollmentStateText: { color: "#68736d", fontSize: 12 },
  settingsSectionTitle: { color: "#4d5966", fontSize: 11, letterSpacing: 2.2, fontWeight: "900", marginTop: 10, marginLeft: 2 },
  settingsCard: { backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#edf0ee", overflow: "hidden", shadowColor: "#102f24", shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  settingRow: { minHeight: 88, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 13 },
  settingIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#e5f4ec", alignItems: "center", justifyContent: "center" },
  settingIconText: { color: "#0e543b", fontSize: 22, fontWeight: "900" },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { color: "#151a18", fontSize: 17, fontWeight: "800" },
  settingSubtitle: { color: "#69747f", fontSize: 13, lineHeight: 18 },
  settingDivider: { height: 1, backgroundColor: "#edf0ee", marginLeft: 77, marginRight: 16 },
  chevron: { color: "#1e2823", fontSize: 34, fontWeight: "300", paddingHorizontal: 4 },
  settingsFootnote: { color: "#7c8781", fontSize: 11, lineHeight: 17, textAlign: "center", paddingHorizontal: 16, marginTop: 4 },
});
