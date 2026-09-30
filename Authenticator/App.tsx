import { useEffect, useMemo, useState } from "react";
import {
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
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { usePreventScreenCapture } from "expo-screen-capture";
import { claimAuthenticatorActivation, requestAuthenticatorActivation, type PendingAuthenticatorActivation } from "./src/activation";
import { generateTotp, totpWindow } from "./src/totp";
import {
  clearAccount,
  clearPendingActivation,
  enforceInstallationBoundary,
  loadAccount,
  loadPendingActivation,
  saveAccount,
  savePendingActivation,
} from "./src/storage";
import { unlockAuthenticator } from "./src/security";
import { colors } from "./src/theme";
import type { KraviaTotpAccount } from "./src/types";

type Tab = "authenticator" | "settings";
type LaunchPhase = "splash" | "loading" | "ready";

const BRAND_ICON = require("./assets/brand/icon.png");
const SPLASH_ART = require("./assets/brand/splash.jpg");
const LOADING_ART = require("./assets/brand/loading.jpg");
const APP_VERSION = "1.1.0";
const TEXT_FONT = Platform.select({ ios: "Avenir Next", android: "sans-serif", default: "System" }) ?? "System";
const DISPLAY_FONT = Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "System" }) ?? "System";

function BrandArtwork({ source, label }: { source: ImageSourcePropType; label: string }) {
  return <SafeAreaView style={styles.artworkRoot} accessibilityLabel={label}><Image source={source} resizeMode="contain" style={styles.artwork} /></SafeAreaView>;
}

function Button({ label, onPress, variant = "primary", disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, variant === "secondary" && styles.secondaryButton, variant === "danger" && styles.dangerButton, disabled && styles.buttonDisabled, pressed && !disabled && variant === "primary" && styles.primaryButtonPressed, pressed && !disabled && variant !== "primary" && styles.buttonPressed]}>
    <Text style={[styles.buttonText, variant === "secondary" && styles.secondaryButtonText, variant === "danger" && styles.dangerButtonText, disabled && styles.buttonTextDisabled]}>{label}</Text>
  </Pressable>;
}

function BottomTabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return <View style={styles.tabBar}>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: tab === "authenticator" }} onPress={() => onChange("authenticator")} style={styles.tabItem}><Text style={[styles.tabIcon, tab === "authenticator" && styles.tabActive]}>⌂</Text><Text style={[styles.tabLabel, tab === "authenticator" && styles.tabActive]}>Codes</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: tab === "settings" }} onPress={() => onChange("settings")} style={styles.tabItem}><View style={[styles.tabIndicator, tab === "settings" && styles.tabIndicatorActive]} /><Text style={[styles.tabIcon, tab === "settings" && styles.tabActive]}>⚙</Text><Text style={[styles.tabLabel, tab === "settings" && styles.tabActive]}>Settings</Text></Pressable>
  </View>;
}

function SettingRow({ icon, title, subtitle, value, onPress }: { icon: string; title: string; subtitle: string; value?: boolean; onPress?: () => void }) {
  const content = <><View style={styles.settingIcon}><Text style={styles.settingIconText}>{icon}</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingSubtitle}>{subtitle}</Text></View>{typeof value === "boolean" ? <Switch value={value} disabled trackColor={{ false: colors.disabledSurface, true: colors.primary }} thumbColor={colors.onPrimary} ios_backgroundColor={colors.disabledSurface} /> : <Text style={styles.chevron}>›</Text>}</>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.settingRow}>{content}</Pressable> : <View style={styles.settingRow}>{content}</View>;
}

function SettingsScreen({ account, onTab }: { account: KraviaTotpAccount; onTab: (tab: Tab) => void }) {
  return <SafeAreaView style={styles.settingsRoot}>
    <ScrollView contentContainerStyle={styles.settingsContent} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.settingsHeader}><View style={styles.settingsBrand}><Image source={BRAND_ICON} style={styles.settingsLogo} /><View><Text style={styles.settingsWordmark}>AUTHENTICATOR</Text><Text style={styles.settingsWordmarkSub}>KRAVIA OFFICE</Text></View></View><Text style={styles.settingsHeading}>Settings</Text></View>
      <Pressable accessibilityRole="button" style={styles.accountSummary} onPress={() => Alert.alert("KRAVIA Office", `${account.account}\nTOTP: 6 digits every 30 seconds`)}><View style={styles.accountSummaryIcon}><Text style={styles.accountSummaryIconText}>▦</Text></View><View style={styles.accountSummaryCopy}><Text style={styles.settingsEyebrow}>ACTIVE CODE VAULT</Text><Text style={styles.accountSummaryTitle}>KRAVIA Office</Text><Text style={styles.accountSummaryEmail}>{account.account}</Text><View style={styles.enrollmentState}><View style={styles.statusDot} /><Text style={styles.enrollmentStateText}>Protected on this phone</Text></View></View><Text style={styles.chevron}>›</Text></Pressable>
      <Text style={styles.settingsSectionTitle}>SECURITY</Text><View style={styles.settingsCard}><SettingRow icon="◎" title="Biometric Lock" subtitle="Use Face ID or device biometrics to unlock codes" value /><View style={styles.settingDivider} /><SettingRow icon="▣" title="Lock on Background" subtitle="Clear codes from memory when you leave the app" value /><View style={styles.settingDivider} /><SettingRow icon="▢" title="Clipboard Export" subtitle="Copying codes is disabled" value={false} /></View>
      <Text style={styles.settingsSectionTitle}>SUPPORT</Text><View style={styles.settingsCard}><SettingRow icon="?" title="Activation help" subtitle="How to activate a replacement phone" onPress={() => Alert.alert("Activate a phone", "Sign in with your KRAVIA Office credentials. A verified Office owner or administrator approves the phone in Office settings. After approval, return here to receive your local code vault. No setup material is shown.")} /></View>
      <Text style={styles.settingsSectionTitle}>ABOUT</Text><View style={styles.settingsCard}><SettingRow icon="✓" title="Privacy & Security" subtitle="How your data is protected" onPress={() => Alert.alert("Privacy & Security", "Your password is used only to request activation and is never saved. A trusted Office approval is required before this phone receives a local TOTP seed. Codes are then generated offline, protected by device security, and cannot be copied.")} /><View style={styles.settingDivider} /><SettingRow icon="i" title="About Authenticator" subtitle="Learn more about KRAVIA Office security" onPress={() => Alert.alert("Authenticator", "Secure one-time codes for KRAVIA Office and Finance. Operated by Kravia Private Limited.")} /><View style={styles.settingDivider} /><View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingIconText}>⚙</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>App Version</Text><Text style={styles.settingSubtitle}>{APP_VERSION}</Text></View></View></View>
      <Text style={styles.settingsFootnote}>Biometric lock and background lock are mandatory. Clipboard export remains disabled.</Text>
    </ScrollView>
    <BottomTabs tab="settings" onChange={onTab} />
  </SafeAreaView>;
}

export default function App() {
  usePreventScreenCapture("authenticator");
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("splash");
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [account, setAccount] = useState<KraviaTotpAccount | null>(null);
  const [pendingActivation, setPendingActivation] = useState<PendingAuthenticatorActivation | null>(null);
  const [tab, setTab] = useState<Tab>("authenticator");
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activationBusy, setActivationBusy] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  useEffect(() => { const timeout = setTimeout(() => setLaunchPhase("loading"), 900); return () => clearTimeout(timeout); }, []);
  useEffect(() => {
    if (launchPhase !== "loading") return;
    let alive = true;
    void (async () => {
      try {
        const boundary = await enforceInstallationBoundary();
        const [storedAccount, storedActivation] = await Promise.all([loadAccount(), loadPendingActivation()]);
        if (!alive) return;
        setAccount(storedAccount); setPendingActivation(storedActivation); setLocked(Boolean(storedAccount));
        if (boundary.reset) setMessage("This installation was reset. Request a new phone activation from your verified Office administrator.");
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : "Authenticator could not open secure device storage.");
      } finally { if (alive) setLaunchPhase("ready"); }
    })();
    return () => { alive = false; };
  }, [launchPhase]);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(interval); }, []);
  useEffect(() => {
    if (Platform.OS === "ios") { void ScreenCapture.enableAppSwitcherProtectionAsync(0.9); return () => { void ScreenCapture.disableAppSwitcherProtectionAsync(); }; }
    return undefined;
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active" && account) { setLocked(true); setAccount(null); setTab("authenticator"); setMessage(undefined); } setPassword(""); });
    return () => subscription.remove();
  }, [account]);

  const code = useMemo(() => account ? generateTotp(account.secret, now, account.digits, account.period) : "", [account, now]);
  const window = useMemo(() => totpWindow(now, account?.period ?? 30), [now, account?.period]);

  async function unlock() {
    setUnlocking(true); setMessage(undefined);
    try {
      const result = await unlockAuthenticator();
      if (!result.ok) { setMessage(result.message); return; }
      const stored = await loadAccount();
      if (!stored) { setLocked(false); return; }
      setAccount(stored); setLocked(false); setTab("authenticator");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authenticator could not unlock."); } finally { setUnlocking(false); }
  }
  async function finishActivation(next: KraviaTotpAccount) {
    await saveAccount(next); await clearPendingActivation(); setAccount(next); setPendingActivation(null); setLocked(false); setTab("authenticator"); setMessage("Authenticator is active on this phone."); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
  async function checkApproval(activation: PendingAuthenticatorActivation) {
    const result = await claimAuthenticatorActivation(activation);
    if (result.status === "ENROLLED") { await finishActivation(result.account); return; }
    const updated = { ...activation, expiresAt: result.expiresAt }; await savePendingActivation(updated); setPendingActivation(updated); setMessage("This phone is still waiting for approval in KRAVIA Office settings.");
  }
  async function activateWithCredentials() {
    if (!email.trim() || !password) { setMessage("Enter your KRAVIA corporate email and password."); return; }
    setActivationBusy(true); setMessage(undefined);
    try { const activation = await requestAuthenticatorActivation(email.trim().toLowerCase(), password); setPassword(""); await savePendingActivation(activation); setPendingActivation(activation); await checkApproval(activation); } catch (error) { setMessage(error instanceof Error ? error.message : "Authenticator activation could not be started."); } finally { setActivationBusy(false); }
  }
  async function refreshActivation() { if (!pendingActivation) return; setActivationBusy(true); setMessage(undefined); try { await checkApproval(pendingActivation); } catch (error) { setMessage(error instanceof Error ? error.message : "Authenticator activation could not be checked."); } finally { setActivationBusy(false); } }
  function restartActivation() { void clearPendingActivation(); setPendingActivation(null); setMessage(undefined); }
  function lockNow() { setLocked(true); setAccount(null); setTab("authenticator"); setMessage(undefined); }
  function removeEnrollment() {
    Alert.alert("Remove Authenticator from this phone?", "Your Office administrator must reset MFA before another phone can be activated.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => { void (async () => { const auth = await unlockAuthenticator(); if (!auth.ok) { setMessage(auth.message); return; } await clearAccount(); setAccount(null); setLocked(false); setMessage("This phone no longer stores your Authenticator code vault."); })(); } }]);
  }

  if (launchPhase === "splash") return <BrandArtwork source={SPLASH_ART} label="Authenticator splash screen" />;
  if (launchPhase === "loading") return <BrandArtwork source={LOADING_ART} label="Authenticator secure storage loading" />;
  if (locked) return <SafeAreaView style={styles.root}><View style={styles.lockScreen}><Image source={BRAND_ICON} style={styles.lockLogo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.title}>Authenticator</Text><Text style={styles.bodyCenter}>Your one-time codes stay on this phone and remain protected by device security.</Text>{message ? <Text style={styles.error}>{message}</Text> : null}<Button label={unlocking ? "Unlocking…" : "Unlock codes"} onPress={() => void unlock()} disabled={unlocking} /><Text style={styles.securityNote}>Biometric lock · no clipboard export · automatic background lock</Text></View></SafeAreaView>;
  if (!account && pendingActivation) return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.activationContent} contentInsetAdjustmentBehavior="automatic"><Image source={BRAND_ICON} style={styles.activationLogo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.activationTitle}>Phone approval required</Text><Text style={styles.body}>Your credentials were accepted. A verified Office owner or administrator must approve this phone in Office settings before any one-time code is shown.</Text><View style={styles.approvalPanel}><Text style={styles.approvalTitle}>Waiting securely</Text><Text style={styles.approvalCopy}>No setup material is exposed. This request expires at {new Date(pendingActivation.expiresAt).toLocaleTimeString()}.</Text></View>{message ? <Text style={styles.info}>{message}</Text> : null}<Button label={activationBusy ? "Checking approval…" : "Check approval"} onPress={() => void refreshActivation()} disabled={activationBusy} /><Button label="Start over" variant="secondary" onPress={restartActivation} disabled={activationBusy} /><Text style={styles.securityNote}>Keep this app open or return after approval. The code vault is delivered only to this approved phone.</Text></ScrollView></SafeAreaView>;
  if (!account) return <SafeAreaView style={styles.root}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.activationContent} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"><Image source={BRAND_ICON} style={styles.activationLogo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.activationTitle}>Sign in to activate</Text><Text style={styles.body}>Use your corporate credentials to request this phone. Once a trusted Office owner or administrator approves it, you will see your one-time codes here.</Text><Text style={styles.label}>Corporate email</Text><TextInput style={[styles.input, focusedField === "email" && styles.inputFocused, Boolean(message) && styles.inputError, activationBusy && styles.inputDisabled]} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField((field) => field === "email" ? null : field)} placeholder="name@kraviaprivatelimited.com" placeholderTextColor={colors.placeholder} editable={!activationBusy} /><Text style={styles.label}>Office password</Text><View style={[styles.passwordField, focusedField === "password" && styles.inputFocused, Boolean(message) && styles.inputError, activationBusy && styles.inputDisabled]}><TextInput style={styles.passwordInput} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField((field) => field === "password" ? null : field)} placeholder="Enter your password" placeholderTextColor={colors.placeholder} editable={!activationBusy} /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword((value) => !value)} style={styles.passwordToggle}><Text style={styles.passwordToggleText}>{showPassword ? "Hide" : "Show"}</Text></Pressable></View>{message ? <Text style={styles.error}>{message}</Text> : null}<Button label={activationBusy ? "Verifying…" : "Continue"} onPress={() => void activateWithCredentials()} disabled={activationBusy} /><Text style={styles.securityNote}>Your password is never stored in Authenticator. It only requests a phone activation from the secure KRAVIA identity service.</Text></ScrollView></KeyboardAvoidingView></SafeAreaView>;
  if (tab === "settings") return <SettingsScreen account={account} onTab={setTab} />;
  return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"><View style={styles.topRow}><View><Text style={styles.kicker}>AUTHENTICATOR</Text><Text style={styles.sectionTitle}>Login code</Text></View><Pressable accessibilityRole="button" onPress={lockNow}><Text style={styles.link}>Lock</Text></Pressable></View><View style={styles.accountCard}><Text style={styles.issuer}>{account.issuer}</Text><Text style={styles.account}>{account.account}</Text><Text accessibilityRole="text" accessibilityLabel={`Current KRAVIA login code ${code}`} style={styles.code}>{code.slice(0, 3)} {code.slice(3)}</Text><Text style={styles.remaining}>{window.remaining}s remaining</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(Math.max(0, Math.min(100, window.progress * 100)))}%` as `${number}%` }]} /></View><Text style={styles.tapHint}>Read and type this code into KRAVIA Office. Clipboard export is disabled.</Text></View>{message ? <Text style={styles.info}>{message}</Text> : null}<View style={styles.panel}><Text style={styles.panelTitle}>How to sign in</Text><Text style={styles.body}>Enter your KRAVIA Office password, then type this six-digit code. The code changes every 30 seconds and is generated locally on this phone.</Text></View><View style={styles.panel}><Text style={styles.panelTitle}>Security boundary</Text><Text style={styles.body}>The code seed stays in secure device storage. This app does not retain your Office password, access token, or copied verification code.</Text></View><Button label="Remove from this phone" variant="danger" onPress={removeEnrollment} /><Text style={styles.securityNote}>If this phone is lost, an Office administrator must reset MFA before a replacement can be activated.</Text></ScrollView><BottomTabs tab="authenticator" onChange={setTab} /></SafeAreaView>;
}

const styles = StyleSheet.create({
  artworkRoot: { flex: 1, backgroundColor: colors.artworkBackdrop, alignItems: "center", justifyContent: "center" },
  artwork: { width: "100%", height: "100%" },
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 28, gap: 16 },
  activationContent: { flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36, gap: 14 },
  lockScreen: { flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 28, gap: 18, maxWidth: 520, alignSelf: "center", width: "100%" },
  lockLogo: { width: 76, height: 76, borderRadius: 18, alignSelf: "flex-start" },
  activationLogo: { width: 62, height: 62, borderRadius: 16 },
  kicker: { color: colors.accent, fontFamily: TEXT_FONT, fontSize: 11, fontWeight: "800", letterSpacing: 1.7 },
  title: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 48, fontWeight: "700", letterSpacing: -2.1, lineHeight: 52 },
  activationTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 38, fontWeight: "700", letterSpacing: -1.5, lineHeight: 42 },
  sectionTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 30, fontWeight: "700", letterSpacing: -1.1, marginTop: 4 },
  body: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 15, lineHeight: 23 },
  bodyCenter: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 15, lineHeight: 23, maxWidth: 420 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  link: { color: colors.primary, fontFamily: TEXT_FONT, fontSize: 14, fontWeight: "800", padding: 8 },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 6 },
  panelTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: "700" },
  approvalPanel: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primarySoftBorder, borderRadius: 16, padding: 16, gap: 5 },
  approvalTitle: { color: colors.primary, fontFamily: DISPLAY_FONT, fontWeight: "700", fontSize: 16 },
  approvalCopy: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 13, lineHeight: 20 },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryButtonPressed: { backgroundColor: colors.primaryPressed },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  dangerButton: { backgroundColor: colors.semanticErrorSurface, borderWidth: 1, borderColor: colors.semanticErrorBorder },
  buttonDisabled: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledSurface, opacity: 1 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: colors.onPrimary, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: "700" },
  buttonTextDisabled: { color: colors.disabledText },
  secondaryButtonText: { color: colors.primary },
  dangerButtonText: { color: colors.semanticError },
  label: { color: colors.text, fontFamily: TEXT_FONT, fontSize: 12, fontWeight: "800", marginTop: 4 },
  input: { minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, paddingHorizontal: 14, color: colors.text, fontFamily: TEXT_FONT, fontSize: 15 },
  passwordField: { minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, flexDirection: "row", alignItems: "center" },
  inputFocused: { borderColor: colors.primary, borderWidth: 2 },
  inputError: { borderColor: colors.semanticError },
  inputDisabled: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledSurface },
  passwordInput: { flex: 1, minHeight: 50, paddingHorizontal: 14, color: colors.text, fontFamily: TEXT_FONT, fontSize: 15 },
  passwordToggle: { paddingHorizontal: 14, minHeight: 50, justifyContent: "center" },
  passwordToggleText: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 13, fontWeight: "700" },
  error: { color: colors.semanticError, fontFamily: TEXT_FONT, backgroundColor: colors.semanticErrorSurface, borderRadius: 12, padding: 12, lineHeight: 19 },
  info: { color: colors.primary, fontFamily: TEXT_FONT, backgroundColor: colors.primarySoft, borderRadius: 12, padding: 12, lineHeight: 19 },
  securityNote: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 11, lineHeight: 17, textAlign: "center" },
  accountCard: { backgroundColor: colors.primary, borderRadius: 24, padding: 24, gap: 8, shadowColor: colors.primary, shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 5 },
  issuer: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  account: { color: colors.onPrimary, fontFamily: TEXT_FONT, fontSize: 15, fontWeight: "600" },
  code: { color: colors.onPrimary, fontFamily: DISPLAY_FONT, fontSize: 48, fontWeight: "700", letterSpacing: 3, marginTop: 16, fontVariant: ["tabular-nums"] },
  remaining: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 12, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 99, backgroundColor: colors.onPrimaryFaint, overflow: "hidden", marginTop: 4 },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  tapHint: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 10, marginTop: 4 },
  tabBar: { minHeight: 76, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", paddingBottom: Platform.OS === "ios" ? 8 : 4 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, position: "relative" },
  tabIndicator: { position: "absolute", top: 0, width: 68, height: 4, borderRadius: 4, backgroundColor: "transparent" },
  tabIndicatorActive: { backgroundColor: colors.primary },
  tabIcon: { fontFamily: TEXT_FONT, fontSize: 24, color: colors.mutedText, fontWeight: "800" },
  tabLabel: { fontFamily: TEXT_FONT, fontSize: 12, color: colors.mutedText, fontWeight: "700" },
  tabActive: { color: colors.primary },
  settingsRoot: { flex: 1, backgroundColor: colors.background },
  settingsContent: { padding: 20, paddingBottom: 28, gap: 14 },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  settingsBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  settingsLogo: { width: 48, height: 48, borderRadius: 12 },
  settingsWordmark: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 16, fontWeight: "700", letterSpacing: 1.4 },
  settingsWordmarkSub: { color: colors.accent, fontFamily: TEXT_FONT, fontSize: 8, fontWeight: "800", letterSpacing: 2.6, marginTop: 2 },
  settingsHeading: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 30, fontWeight: "700", letterSpacing: -1 },
  accountSummary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primarySoftBorder, borderRadius: 18, padding: 16, gap: 14 },
  accountSummaryIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  accountSummaryIconText: { color: colors.accent, fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: "700" },
  accountSummaryCopy: { flex: 1, gap: 3 },
  settingsEyebrow: { color: colors.accent, fontFamily: TEXT_FONT, fontSize: 10, letterSpacing: 1.7, fontWeight: "800" },
  accountSummaryTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: "700" },
  accountSummaryEmail: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 14 },
  enrollmentState: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.semanticSuccess },
  enrollmentStateText: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 12 },
  settingsSectionTitle: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 11, letterSpacing: 2.2, fontWeight: "800", marginTop: 10, marginLeft: 2 },
  settingsCard: { backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border, overflow: "hidden", shadowColor: colors.primary, shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  settingRow: { minHeight: 88, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 13 },
  settingIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  settingIconText: { color: colors.accent, fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: "700" },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: "700" },
  settingSubtitle: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 13, lineHeight: 18 },
  settingDivider: { height: 1, backgroundColor: colors.border, marginLeft: 77, marginRight: 16 },
  chevron: { color: colors.primary, fontFamily: TEXT_FONT, fontSize: 34, fontWeight: "300", paddingHorizontal: 4 },
  settingsFootnote: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 11, lineHeight: 17, textAlign: "center", paddingHorizontal: 16, marginTop: 4 },
});
