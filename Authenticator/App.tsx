import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { usePreventScreenCapture } from "expo-screen-capture";
import {
  claimAuthenticatorActivation,
  IdentityApiError,
  refreshAuthenticatorSession,
  requestAuthenticatorActivation,
  requestEmailOtp,
  resendEmailOtp,
  verifyEmailOtp,
  type PendingEmailOtpChallenge,
} from "./src/activation";
import {
  clearAccount,
  clearAuthenticatorSession,
  clearPendingActivation,
  enforceInstallationBoundary,
  loadAccount,
  loadAuthenticatorSession,
  loadPendingActivation,
  saveAccount,
  saveAuthenticatorSession,
  savePendingActivation,
  type AuthenticatorActivationSession,
  type PendingAuthenticatorActivation,
} from "./src/storage";
import { unlockAuthenticator } from "./src/security";
import { colors } from "./src/theme";
import { generateTotp, totpWindow } from "./src/totp";
import type { KraviaTotpAccount } from "./src/types";

type LaunchPhase = "splash" | "loading" | "ready";
type Screen = "welcome" | "credentials" | "otp" | "activation-ready" | "approval" | "locked" | "home" | "settings";
type FocusedField = "email" | "password" | "otp" | null;

const BRAND_ICON = require("./assets/brand/icon.png");
const SPLASH_ART = require("./assets/brand/splash.jpg");
const LOADING_ART = require("./assets/brand/loading.jpg");
const TEXT_FONT = Platform.select({ ios: "Avenir Next", android: "sans-serif", default: "System" }) ?? "System";
const DISPLAY_FONT = Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "System" }) ?? "System";

function BrandArtwork({ source, label }: { source: ImageSourcePropType; label: string }) {
  return <SafeAreaView style={styles.artworkRoot} accessibilityLabel={label}><Image source={source} resizeMode="contain" style={styles.artwork} /></SafeAreaView>;
}

function Button({ label, onPress, variant = "primary", disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, variant === "secondary" && styles.secondaryButton, variant === "danger" && styles.dangerButton, disabled && styles.buttonDisabled, pressed && !disabled && (variant === "primary" ? styles.primaryButtonPressed : styles.buttonPressed)]}>
    <Text style={[styles.buttonText, variant === "secondary" && styles.secondaryButtonText, variant === "danger" && styles.dangerButtonText, disabled && styles.buttonTextDisabled]}>{label}</Text>
  </Pressable>;
}

function TimerCircle({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [now, setNow] = useState(Date.now());
  const spin = useRef(new Animated.Value(0)).current;
  const remaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  const progress = Math.max(0, Math.min(1, remaining / (10 * 60)));
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1_000); return () => clearInterval(interval); }, []);
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 4_000, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [spin]);
  useEffect(() => { if (remaining <= 0) onExpire(); }, [onExpire, remaining]);
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <View accessibilityRole="timer" accessibilityLabel={`Verification code expires in ${minutes} minutes ${seconds} seconds`} style={styles.timerWrap}>
    <View style={[styles.timerTrack, { borderColor: remaining ? colors.primarySoftBorder : colors.semanticErrorBorder }]}>
      <View style={[styles.timerProgress, { opacity: progress }]} />
      {remaining ? <Animated.View style={[styles.timerMarker, { transform: [{ rotate: rotation }, { translateY: -48 }] }]} /> : null}
      <View style={styles.timerCopy}><Text style={styles.timerTime}>{minutes}:{seconds}</Text><Text style={styles.timerLabel}>{remaining ? "code expires" : "code expired"}</Text></View>
    </View>
  </View>;
}

function emailMask(email: string) {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function sessionRemaining(expiresAt: string) {
  const seconds = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  return `${Math.ceil(seconds / 86_400)} day${Math.ceil(seconds / 86_400) === 1 ? "" : "s"}`;
}

function secondsUntil(when: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(when) - now) / 1_000));
}

function clockLabel(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function BottomTabs({ screen, onChange }: { screen: Screen; onChange: (screen: "home" | "settings") => void }) {
  return <View style={styles.tabBar} accessibilityRole="tablist">
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: screen === "home" }} onPress={() => onChange("home")} style={styles.tabItem}><Text style={[styles.tabIcon, screen === "home" && styles.tabActive]}>⌁</Text><Text style={[styles.tabLabel, screen === "home" && styles.tabActive]}>Code</Text></Pressable>
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: screen === "settings" }} onPress={() => onChange("settings")} style={styles.tabItem}><Text style={[styles.tabIcon, screen === "settings" && styles.tabActive]}>◌</Text><Text style={[styles.tabLabel, screen === "settings" && styles.tabActive]}>Security</Text></Pressable>
  </View>;
}

function SecurityRow({ icon, title, description, state }: { icon: string; title: string; description: string; state: string }) {
  return <View style={styles.securityRow}><View style={styles.securityIcon}><Text style={styles.securityIconText}>{icon}</Text></View><View style={styles.securityCopy}><Text style={styles.securityTitle}>{title}</Text><Text style={styles.securityDescription}>{description}</Text></View><Text style={styles.securityState}>{state}</Text></View>;
}

export default function App() {
  usePreventScreenCapture("authenticator");
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("splash");
  const [screen, setScreen] = useState<Screen>("welcome");
  const [account, setAccount] = useState<KraviaTotpAccount | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [mobileSession, setMobileSession] = useState<AuthenticatorActivationSession | null>(null);
  const [pendingActivation, setPendingActivation] = useState<PendingAuthenticatorActivation | null>(null);
  const [challenge, setChallenge] = useState<PendingEmailOtpChallenge | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [message, setMessage] = useState<string>();
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [otpExpired, setOtpExpired] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const timeout = setTimeout(() => setLaunchPhase("loading"), 900); return () => clearTimeout(timeout); }, []);
  useEffect(() => {
    if (launchPhase !== "loading") return;
    let active = true;
    void (async () => {
      try {
        const boundary = await enforceInstallationBoundary();
        const [storedAccount, storedSession, storedActivation] = await Promise.all([loadAccount(), loadAuthenticatorSession(), loadPendingActivation()]);
        if (!active) return;
        setHasAccount(Boolean(storedAccount));
        setMobileSession(storedSession);
        setPendingActivation(storedActivation);
        setEmail(storedAccount?.account ?? storedSession?.email ?? "");
        if (boundary.reset) setMessage("This installation was reset. Request a new phone activation before using Authenticator.");
        if (storedActivation && !storedAccount) setScreen("approval");
        else if (storedAccount && storedSession) setScreen("locked");
        else if (storedAccount) { setScreen("welcome"); setMessage("Your 30-day verification session has expired. Sign in again to unlock your local code."); }
        else if (storedSession) setScreen("activation-ready");
        else setScreen("welcome");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Authenticator could not open secure device storage.");
      } finally { if (active) setLaunchPhase("ready"); }
    })();
    return () => { active = false; };
  }, [launchPhase]);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(interval); }, []);
  useEffect(() => {
    if (!mobileSession || Date.parse(mobileSession.expiresAt) > now) return;
    void clearAuthenticatorSession();
    setMobileSession(null); setAccount(null); setScreen("welcome"); setMessage("Your 30-day verification session has expired. Sign in again to unlock Authenticator.");
  }, [mobileSession, now]);
  useEffect(() => {
    if (Platform.OS === "ios") { void ScreenCapture.enableAppSwitcherProtectionAsync(0.9); return () => { void ScreenCapture.disableAppSwitcherProtectionAsync(); }; }
    return undefined;
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      // Opening the notification shade moves some devices through `inactive`
      // while the user remains in this protected app.  Only a real background
      // transition clears an entered email code and locks the local TOTP vault.
      if (state === "background") {
        setPassword(""); setOtp(""); setFocusedField(null);
        if (account) { setAccount(null); setScreen("locked"); setMessage(undefined); }
      }
    });
    return () => subscription.remove();
  }, [account]);

  const code = useMemo(() => account ? generateTotp(account.secret, now, account.digits, account.period) : "", [account, now]);
  const codeWindow = useMemo(() => totpWindow(now, account?.period ?? 30), [now, account?.period]);
  const resendRemaining = useMemo(() => challenge ? secondsUntil(challenge.resendAvailableAt, now) : 0, [challenge, now]);

  function resetToCredentials() {
    setChallenge(null); setOtp(""); setPassword(""); setOtpExpired(false); setMessage(undefined); setScreen("credentials");
  }

  async function beginEmailVerification() {
    if (!email.trim() || !password) { setMessage("Enter your registered corporate email and password."); return; }
    setBusy(true); setMessage(undefined);
    try {
      const pending = await requestEmailOtp(email.trim().toLowerCase(), password);
      setChallenge(pending); setPassword(""); setOtp(""); setOtpExpired(false); setScreen("otp");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { setMessage(error instanceof Error ? error.message : "We could not start email verification."); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    if (!challenge) return;
    setBusy(true); setMessage(undefined);
    try {
      const next = await resendEmailOtp(challenge);
      setChallenge(next); setOtp(""); setOtpExpired(false);
      setMessage("A new verification code was sent. The previous code is no longer valid.");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // A consumed, cancelled, or expired challenge cannot safely be revived.
      // Return to credentials so the server can create an auditable new request.
      if (error instanceof IdentityApiError && (error.status === 409 || error.status === 410)) {
        setChallenge(null); setOtp(""); setOtpExpired(false); setScreen("credentials");
        setMessage("This verification request is no longer available. Sign in again to send a new code.");
      } else {
        setMessage(error instanceof Error ? error.message : "We could not resend the verification code.");
      }
    }
    finally { setBusy(false); }
  }

  async function completeEmailVerification() {
    if (!challenge || !/^\d{6}$/.test(otp)) { setMessage("Enter the six-digit code from your registered email."); return; }
    setBusy(true); setMessage(undefined);
    try {
      const nextSession = await verifyEmailOtp(challenge, otp);
      await saveAuthenticatorSession(nextSession);
      setMobileSession(nextSession); setChallenge(null); setOtp("");
      setScreen(hasAccount ? "locked" : "activation-ready");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { setMessage(error instanceof Error ? error.message : "We could not verify that code."); }
    finally { setBusy(false); }
  }

  async function requestPhoneActivation() {
    if (!mobileSession) { setMessage("Verify your email again before requesting this phone."); setScreen("welcome"); return; }
    setBusy(true); setMessage(undefined);
    try {
      // Access tokens are intentionally short-lived. Rotate the separately
      // scoped native session so a valid 30-day verification period does not
      // silently fail after the first 30 minutes.
      const refreshedSession = await refreshAuthenticatorSession(mobileSession);
      await saveAuthenticatorSession(refreshedSession);
      setMobileSession(refreshedSession);
      const pending = await requestAuthenticatorActivation(refreshedSession);
      await savePendingActivation(pending);
      setPendingActivation(pending); setScreen("approval");
      if (pending.expiresAt) setMessage("Your phone request was sent securely. Ask an Office owner or administrator to approve it.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authenticator activation could not be requested."); }
    finally { setBusy(false); }
  }

  async function checkApproval() {
    if (!pendingActivation) return;
    setBusy(true); setMessage(undefined);
    try {
      const result = await claimAuthenticatorActivation(pendingActivation);
      if (result.status === "PENDING") {
        const refreshed = { ...pendingActivation, expiresAt: result.expiresAt };
        await savePendingActivation(refreshed); setPendingActivation(refreshed); setMessage("This phone is still waiting for approval in KRAVIA Office security settings.");
      } else {
        await saveAccount(result.account); await clearPendingActivation();
        setAccount(null); setHasAccount(true); setPendingActivation(null); setEmail(result.account.account); setScreen("locked");
        setMessage("Authenticator is active. Unlock with your device biometrics to view the current code.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authenticator activation could not be checked."); }
    finally { setBusy(false); }
  }

  async function unlock() {
    if (!mobileSession) { setScreen("welcome"); setMessage("Sign in again to unlock Authenticator."); return; }
    setUnlocking(true); setMessage(undefined);
    try {
      const result = await unlockAuthenticator();
      if (!result.ok) { setMessage(result.message); return; }
      const stored = await loadAccount();
      if (!stored) { setHasAccount(false); setScreen("activation-ready"); setMessage("This phone no longer has a local code vault. Request activation again."); return; }
      setAccount(stored); setScreen("home");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authenticator could not unlock."); }
    finally { setUnlocking(false); }
  }

  async function signOut() {
    await clearAuthenticatorSession();
    setMobileSession(null); setAccount(null); setChallenge(null); setPassword(""); setOtp(""); setScreen("welcome");
    setMessage(hasAccount ? "Signed out. Your local code remains protected until you verify your email again." : "Signed out.");
  }

  function restartActivation() {
    void clearPendingActivation(); setPendingActivation(null); setMessage(undefined); setScreen(mobileSession ? "activation-ready" : "welcome");
  }

  function removeLocalVault() {
    Alert.alert(
      "Remove local Authenticator code?",
      "This removes the code only from this phone. Before activating another phone, an authorised Office administrator must reset MFA for your identity.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => { void (async () => { const result = await unlockAuthenticator(); if (!result.ok) { setMessage(result.message); return; } await clearAccount(); await clearAuthenticatorSession(); setAccount(null); setHasAccount(false); setMobileSession(null); setScreen("welcome"); setMessage("The local code vault was removed from this phone."); })(); } },
      ],
    );
  }

  if (launchPhase === "splash") return <BrandArtwork source={SPLASH_ART} label="KRAVIA loading screen" />;
  if (launchPhase === "loading") return <BrandArtwork source={LOADING_ART} label="KRAVIA secure storage loading" />;

  if (screen === "welcome") return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.welcomeContent} contentInsetAdjustmentBehavior="automatic"><Image source={BRAND_ICON} style={styles.welcomeLogo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.welcomeTitle}>Welcome to{`\n`}Authenticator</Text><Text style={styles.body}>Verify your registered corporate email to unlock this phone’s protected login code.</Text><View style={styles.panel}><Text style={styles.panelTitle}>Two protections, one trusted phone</Text><Text style={styles.panelCopy}>Your password and email code verify you. A KRAVIA Office owner or administrator must approve a new phone before it receives a local code vault.</Text></View>{message ? <Text style={styles.info}>{message}</Text> : null}<Button label={hasAccount ? "Verify and unlock" : "Get started"} onPress={() => { setMessage(undefined); setScreen("credentials"); }} /><Text style={styles.securityNote}>No scan or import · no code copying</Text></ScrollView></SafeAreaView>;

  if (screen === "credentials") return <SafeAreaView style={styles.root}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"><Pressable accessibilityRole="button" onPress={() => { setMessage(undefined); setScreen("welcome"); }}><Text style={styles.backLink}>‹ Back</Text></Pressable><Image source={BRAND_ICON} style={styles.logo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.title}>Sign in</Text><Text style={styles.body}>Use the corporate credentials registered to your Office account.</Text><Text style={styles.label}>Corporate email</Text><TextInput style={[styles.input, focusedField === "email" && styles.inputFocused, Boolean(message) && styles.inputError, busy && styles.inputDisabled]} accessibilityLabel="Corporate email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField((field) => field === "email" ? null : field)} placeholder="name@kraviaprivatelimited.com" placeholderTextColor={colors.placeholder} editable={!busy} /><Text style={styles.label}>Password</Text><View style={[styles.passwordField, focusedField === "password" && styles.inputFocused, Boolean(message) && styles.inputError, busy && styles.inputDisabled]}><TextInput style={styles.passwordInput} accessibilityLabel="Password" autoCapitalize="none" autoCorrect={false} autoComplete="current-password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField((field) => field === "password" ? null : field)} placeholder="Enter your password" placeholderTextColor={colors.placeholder} editable={!busy} /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword((value) => !value)} style={styles.passwordToggle}><Text style={styles.passwordToggleText}>{showPassword ? "Hide" : "Show"}</Text></Pressable></View>{message ? <Text style={styles.error}>{message}</Text> : null}<Button label={busy ? "Checking credentials…" : "Continue"} onPress={() => void beginEmailVerification()} disabled={busy} /><Text style={styles.securityNote}>Your password is never stored on this phone.</Text></ScrollView></KeyboardAvoidingView></SafeAreaView>;

  if (screen === "otp" && challenge) return <SafeAreaView style={styles.root}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.otpContent} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"><Pressable accessibilityRole="button" onPress={resetToCredentials} disabled={busy}><Text style={styles.backLink}>‹ Use another account</Text></Pressable><Image source={BRAND_ICON} style={styles.logo} /><Text style={styles.kicker}>EMAIL VERIFICATION</Text><Text style={styles.title}>Enter your code</Text><Text style={styles.body}>We sent a six-digit code to {emailMask(challenge.email)}.</Text><TimerCircle expiresAt={challenge.expiresAt} onExpire={() => { if (!otpExpired) { setOtpExpired(true); setMessage("This verification code has expired. Sign in again to send a new one."); } }} /><Text style={styles.label}>Verification code</Text><TextInput style={[styles.otpInput, focusedField === "otp" && styles.inputFocused, Boolean(message) && styles.inputError, busy && styles.inputDisabled]} accessibilityLabel="Six digit verification code" autoComplete="one-time-code" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, ""))} onFocus={() => setFocusedField("otp")} onBlur={() => setFocusedField((field) => field === "otp" ? null : field)} placeholder="000000" placeholderTextColor={colors.placeholder} editable={!busy && !otpExpired} />{message ? <Text style={styles.error}>{message}</Text> : null}<Button label={busy ? "Verifying…" : "Verify"} onPress={() => void completeEmailVerification()} disabled={busy || otpExpired || otp.length !== 6} /><Button label={otpExpired ? "Sign in again" : busy ? "Please wait…" : resendRemaining ? `Resend available in ${clockLabel(resendRemaining)}` : "Resend code"} variant="secondary" onPress={() => { if (otpExpired) resetToCredentials(); else void resendCode(); }} disabled={busy || (!otpExpired && resendRemaining > 0)} /><Text style={styles.securityNote}>Codes are single-use and expire automatically. KRAVIA will never ask you to share this code.</Text></ScrollView></KeyboardAvoidingView></SafeAreaView>;

  if (screen === "activation-ready") return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.welcomeContent} contentInsetAdjustmentBehavior="automatic"><Image source={BRAND_ICON} style={styles.welcomeLogo} /><Text style={styles.kicker}>VERIFIED IDENTITY</Text><Text style={styles.welcomeTitle}>Activate this{`\n`}phone</Text><Text style={styles.body}>Your registered email is verified for {mobileSession?.email ?? "this account"}. Request approval before a local six-digit code can be created.</Text><View style={styles.panel}><Text style={styles.panelTitle}>Protected activation</Text><Text style={styles.panelCopy}>This verification session expires in {mobileSession ? sessionRemaining(mobileSession.expiresAt) : "a limited time"}. It cannot access KRAVIA Office data.</Text></View>{message ? <Text style={styles.info}>{message}</Text> : null}<Button label={busy ? "Requesting approval…" : "Request phone activation"} onPress={() => void requestPhoneActivation()} disabled={busy} /><Button label="Sign out" variant="secondary" onPress={() => void signOut()} disabled={busy} /><Text style={styles.securityNote}>A verified Office owner or administrator approves the phone in Office security settings.</Text></ScrollView></SafeAreaView>;

  if (screen === "approval" && pendingActivation) return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.welcomeContent} contentInsetAdjustmentBehavior="automatic"><Image source={BRAND_ICON} style={styles.welcomeLogo} /><Text style={styles.kicker}>PHONE ACTIVATION</Text><Text style={styles.welcomeTitle}>Waiting for{`\n`}approval</Text><Text style={styles.body}>Your credentials and email verification were accepted. An Office owner or administrator must approve this specific phone before a code is shown.</Text><View style={styles.panel}><Text style={styles.panelTitle}>No code is exposed yet</Text><Text style={styles.panelCopy}>This one-time request expires at {new Date(pendingActivation.expiresAt).toLocaleTimeString()}. After approval, return here and check the status.</Text></View>{message ? <Text style={styles.info}>{message}</Text> : null}<Button label={busy ? "Checking approval…" : "Check approval"} onPress={() => void checkApproval()} disabled={busy} /><Button label="Start over" variant="secondary" onPress={restartActivation} disabled={busy} /><Text style={styles.securityNote}>The claim token is held only in secure device storage and never shown in KRAVIA Office.</Text></ScrollView></SafeAreaView>;

  if (screen === "locked") return <SafeAreaView style={styles.root}><View style={styles.lockContent}><Image source={BRAND_ICON} style={styles.logo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.title}>Authenticator</Text><Text style={styles.centerBody}>Your one-time code is protected by this device’s strong biometrics and expires from view when the app backgrounds.</Text>{message ? <Text style={styles.info}>{message}</Text> : null}<Button label={unlocking ? "Unlocking…" : "Unlock code"} onPress={() => void unlock()} disabled={unlocking} /><Button label="Sign out" variant="secondary" onPress={() => void signOut()} disabled={unlocking} /><Text style={styles.securityNote}>Biometric lock · background lock · screenshot protection</Text></View></SafeAreaView>;

  if (screen === "settings" && account) return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.settingsContent} contentInsetAdjustmentBehavior="automatic"><View style={styles.settingsHeader}><Image source={BRAND_ICON} style={styles.settingsLogo} /><View><Text style={styles.kicker}>AUTHENTICATOR</Text><Text style={styles.settingsHeading}>Security</Text></View></View><View style={styles.accountPanel}><Text style={styles.accountEyebrow}>ACTIVE LOCAL VAULT</Text><Text style={styles.accountName}>KRAVIA Office</Text><Text style={styles.accountEmail}>{account.account}</Text><Text style={styles.accountStatus}>● Protected on this phone</Text></View><Text style={styles.sectionLabel}>MANDATORY CONTROLS</Text><View style={styles.settingsCard}><SecurityRow icon="◉" title="Biometric lock" description="Strong device biometrics are required to reveal a code." state="ON" /><View style={styles.divider} /><SecurityRow icon="◒" title="Lock on background" description="The code is removed from memory when you leave the app." state="ON" /><View style={styles.divider} /><SecurityRow icon="⊘" title="Clipboard export" description="Copying one-time codes is disabled." state="OFF" /></View><Text style={styles.sectionLabel}>SESSION</Text><View style={styles.settingsCard}><SecurityRow icon="◷" title="Verification session" description="Email verification is required again when this period ends." state={mobileSession ? sessionRemaining(mobileSession.expiresAt) : "EXPIRED"} /></View><Text style={styles.sectionLabel}>RECOVERY</Text><View style={styles.settingsCard}><SecurityRow icon="?" title="Replacement phone" description="Ask an authorised Office administrator to reset MFA before activating another phone." state="ADMIN" /></View><Button label="Sign out" variant="secondary" onPress={() => void signOut()} /><Button label="Remove local code vault" variant="danger" onPress={removeLocalVault} /><Text style={styles.securityNote}>Removing the local vault does not reset MFA. Do not remove it until an Office administrator can help with a replacement phone.</Text></ScrollView><BottomTabs screen={screen} onChange={setScreen} /></SafeAreaView>;

  if (screen === "home" && account) return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.homeContent} contentInsetAdjustmentBehavior="automatic"><View style={styles.topRow}><View><Text style={styles.kicker}>AUTHENTICATOR</Text><Text style={styles.homeHeading}>Login code</Text></View><Pressable accessibilityRole="button" onPress={() => { setAccount(null); setScreen("locked"); setMessage(undefined); }}><Text style={styles.lockLink}>Lock</Text></Pressable></View><View style={styles.codeCard}><Text style={styles.codeIssuer}>{account.issuer}</Text><Text style={styles.codeAccount}>{account.account}</Text><Text accessibilityRole="text" accessibilityLabel={`Current KRAVIA login code ${code}`} style={styles.code}>{code.slice(0, 3)} {code.slice(3)}</Text><Text style={styles.remaining}>{codeWindow.remaining}s remaining</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, Math.round(codeWindow.progress * 100)))}%` as `${number}%` }]} /></View><Text style={styles.codeHint}>Read and type this code into KRAVIA Office. Copying is disabled.</Text></View>{message ? <Text style={styles.info}>{message}</Text> : null}<View style={styles.panel}><Text style={styles.panelTitle}>How to sign in</Text><Text style={styles.panelCopy}>Enter your KRAVIA Office password, then type this six-digit code. It changes every 30 seconds and is generated locally on this approved phone.</Text></View><View style={styles.panel}><Text style={styles.panelTitle}>Your security boundary</Text><Text style={styles.panelCopy}>The code seed stays in native secure storage. This app does not expose seed material or clipboard copy.</Text></View></ScrollView><BottomTabs screen={screen} onChange={setScreen} /></SafeAreaView>;

  return <SafeAreaView style={styles.root}><View style={styles.lockContent}><Text style={styles.title}>Authenticator needs to restart</Text><Text style={styles.centerBody}>Secure app state was unavailable. Return to the welcome screen and verify your account again.</Text><Button label="Return to welcome" onPress={() => setScreen("welcome")} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  artworkRoot: { flex: 1, backgroundColor: colors.artworkBackdrop, alignItems: "center", justifyContent: "center" }, artwork: { width: "100%", height: "100%" }, root: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  welcomeContent: { flexGrow: 1, maxWidth: 520, alignSelf: "center", width: "100%", justifyContent: "center", paddingHorizontal: 28, paddingTop: 34, paddingBottom: 34, gap: 16 }, content: { flexGrow: 1, maxWidth: 520, alignSelf: "center", width: "100%", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36, gap: 14 }, otpContent: { flexGrow: 1, maxWidth: 520, alignSelf: "center", width: "100%", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36, gap: 14 }, homeContent: { flexGrow: 1, maxWidth: 620, alignSelf: "center", width: "100%", paddingHorizontal: 24, paddingTop: 26, paddingBottom: 32, gap: 16 }, settingsContent: { flexGrow: 1, maxWidth: 620, alignSelf: "center", width: "100%", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 26, gap: 14 }, lockContent: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", justifyContent: "center", paddingHorizontal: 28, gap: 16 },
  welcomeLogo: { width: 84, height: 84, borderRadius: 22, marginBottom: 10 }, logo: { width: 58, height: 58, borderRadius: 16, marginTop: 8 }, kicker: { color: colors.accent, fontFamily: TEXT_FONT, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 }, welcomeTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 44, fontWeight: "700", letterSpacing: -2, lineHeight: 49 }, title: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 38, fontWeight: "700", letterSpacing: -1.5, lineHeight: 42 }, homeHeading: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 34, fontWeight: "700", letterSpacing: -1.3 }, body: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 15, lineHeight: 23 }, centerBody: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 15, lineHeight: 23, textAlign: "center" }, backLink: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 14, fontWeight: "700", paddingVertical: 6 },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 17, gap: 5 }, panelTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 16, fontWeight: "700" }, panelCopy: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 14, lineHeight: 20 }, info: { color: colors.primary, fontFamily: TEXT_FONT, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primarySoftBorder, borderRadius: 12, padding: 12, lineHeight: 19 },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }, primaryButtonPressed: { backgroundColor: colors.primaryPressed }, secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }, dangerButton: { backgroundColor: colors.semanticErrorSurface, borderWidth: 1, borderColor: colors.semanticErrorBorder }, buttonDisabled: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledSurface }, buttonPressed: { opacity: 0.82 }, buttonText: { color: colors.onPrimary, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: "700" }, secondaryButtonText: { color: colors.primary }, dangerButtonText: { color: colors.semanticError }, buttonTextDisabled: { color: colors.disabledText },
  label: { color: colors.text, fontFamily: TEXT_FONT, fontSize: 12, fontWeight: "800", marginTop: 4 }, input: { minHeight: 54, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, paddingHorizontal: 14, color: colors.text, fontFamily: TEXT_FONT, fontSize: 15 }, passwordField: { minHeight: 54, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, flexDirection: "row", alignItems: "center" }, passwordInput: { flex: 1, minHeight: 52, paddingHorizontal: 14, color: colors.text, fontFamily: TEXT_FONT, fontSize: 15 }, passwordToggle: { paddingHorizontal: 14, minHeight: 52, justifyContent: "center" }, passwordToggleText: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 13, fontWeight: "700" }, inputFocused: { borderColor: colors.primary, borderWidth: 2 }, inputError: { borderColor: colors.semanticError }, inputDisabled: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledSurface }, error: { color: colors.semanticError, fontFamily: TEXT_FONT, backgroundColor: colors.semanticErrorSurface, borderRadius: 12, padding: 12, lineHeight: 19 }, securityNote: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 2 },
  timerWrap: { alignItems: "center", marginVertical: 4 }, timerTrack: { width: 128, height: 128, borderRadius: 64, borderWidth: 7, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, timerProgress: { position: "absolute", width: 116, height: 116, borderRadius: 58, borderWidth: 2, borderColor: colors.accentSoft }, timerMarker: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent }, timerCopy: { alignItems: "center", gap: 2 }, timerTime: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: "700", fontVariant: ["tabular-nums"] }, timerLabel: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }, otpInput: { minHeight: 62, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: "700", letterSpacing: 9, textAlign: "center", paddingHorizontal: 20, fontVariant: ["tabular-nums"] },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, lockLink: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 14, fontWeight: "700", padding: 10 }, codeCard: { backgroundColor: colors.primary, borderRadius: 22, padding: 23, gap: 8 }, codeIssuer: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, codeAccount: { color: colors.onPrimary, fontFamily: TEXT_FONT, fontSize: 15 }, code: { color: colors.onPrimary, fontFamily: DISPLAY_FONT, fontSize: 48, fontWeight: "700", letterSpacing: 2, marginTop: 15, fontVariant: ["tabular-nums"] }, remaining: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 13, fontWeight: "700" }, progressTrack: { height: 5, overflow: "hidden", borderRadius: 99, backgroundColor: colors.onPrimaryFaint, marginTop: 6 }, progressFill: { height: "100%", borderRadius: 99, backgroundColor: colors.accent }, codeHint: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 11, lineHeight: 17, marginTop: 5 },
  tabBar: { flexDirection: "row", minHeight: 72, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }, tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 }, tabIcon: { color: colors.placeholder, fontFamily: DISPLAY_FONT, fontSize: 22 }, tabLabel: { color: colors.placeholder, fontFamily: TEXT_FONT, fontSize: 11, fontWeight: "700" }, tabActive: { color: colors.primary },
  settingsHeader: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 3 }, settingsLogo: { width: 48, height: 48, borderRadius: 14 }, settingsHeading: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 31, fontWeight: "700", letterSpacing: -1.2 }, accountPanel: { backgroundColor: colors.primary, borderRadius: 20, padding: 20, gap: 5 }, accountEyebrow: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 10, fontWeight: "800", letterSpacing: 1.3 }, accountName: { color: colors.onPrimary, fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: "700" }, accountEmail: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 13 }, accountStatus: { color: colors.onPrimary, fontFamily: TEXT_FONT, fontSize: 11, fontWeight: "700", marginTop: 7 }, sectionLabel: { color: colors.accent, fontFamily: TEXT_FONT, fontSize: 10, letterSpacing: 1.4, fontWeight: "800", marginTop: 6 }, settingsCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: "hidden" }, securityRow: { minHeight: 74, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 11 }, securityIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }, securityIconText: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 16, fontWeight: "700" }, securityCopy: { flex: 1, gap: 2 }, securityTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 14, fontWeight: "700" }, securityDescription: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 11, lineHeight: 16 }, securityState: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 10, fontWeight: "800", maxWidth: 72, textAlign: "right" }, divider: { height: 1, backgroundColor: colors.border, marginLeft: 58 },
});
