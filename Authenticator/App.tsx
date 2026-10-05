import { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { usePreventScreenCapture } from "expo-screen-capture";
import { requestEmailOtp, resendEmailOtp, verifyEmailOtp, type PendingEmailOtpChallenge } from "./src/activation";
import { clearSignedInSession, loadSignedInSession, retireLegacyTotpVault, saveSignedInSession, type OfficeMobileSession } from "./src/storage";
import { colors } from "./src/theme";

type LaunchPhase = "splash" | "loading" | "ready";
type Screen = "welcome" | "credentials" | "otp" | "signed-in";
type FocusedField = "email" | "password" | "otp" | null;

const BRAND_ICON = require("./assets/brand/icon.png");
const SPLASH_ART = require("./assets/brand/splash.jpg");
const LOADING_ART = require("./assets/brand/loading.jpg");
const TEXT_FONT = Platform.select({ ios: "Avenir Next", android: "sans-serif", default: "System" }) ?? "System";
const DISPLAY_FONT = Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "System" }) ?? "System";

function BrandArtwork({ source, label }: { source: ImageSourcePropType; label: string }) {
  return <SafeAreaView style={styles.artworkRoot} accessibilityLabel={label}><Image source={source} resizeMode="contain" style={styles.artwork} /></SafeAreaView>;
}

function Button({ label, onPress, variant = "primary", disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "secondary"; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, variant === "secondary" && styles.secondaryButton, disabled && styles.buttonDisabled, pressed && !disabled && (variant === "primary" ? styles.primaryButtonPressed : styles.buttonPressed)]}>
    <Text style={[styles.buttonText, variant === "secondary" && styles.secondaryButtonText, disabled && styles.buttonTextDisabled]}>{label}</Text>
  </Pressable>;
}

function TimerCircle({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [now, setNow] = useState(Date.now());
  const spin = useRef(new Animated.Value(0)).current;
  const remaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  const progress = Math.max(0, Math.min(1, remaining / (10 * 60)));
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1_000); return () => clearInterval(interval); }, []);
  useEffect(() => {
    if (remaining <= 0) { onExpire(); return undefined; }
    const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 4_000, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [onExpire, remaining, spin]);
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

export default function App() {
  usePreventScreenCapture("email-otp");
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("splash");
  const [screen, setScreen] = useState<Screen>("welcome");
  const [session, setSession] = useState<OfficeMobileSession | null>(null);
  const [challenge, setChallenge] = useState<PendingEmailOtpChallenge | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [otpExpired, setOtpExpired] = useState(false);

  useEffect(() => { const timeout = setTimeout(() => setLaunchPhase("loading"), 900); return () => clearTimeout(timeout); }, []);
  useEffect(() => {
    if (launchPhase !== "loading") return;
    let active = true;
    void (async () => {
      try {
        await retireLegacyTotpVault();
        const stored = await loadSignedInSession();
        if (!active) return;
        if (stored) { setSession(stored); setScreen("signed-in"); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Secure device storage is unavailable."); }
      finally { if (active) setLaunchPhase("ready"); }
    })();
    return () => { active = false; };
  }, [launchPhase]);
  useEffect(() => {
    if (Platform.OS === "ios") { void ScreenCapture.enableAppSwitcherProtectionAsync(0.9); return () => { void ScreenCapture.disableAppSwitcherProtectionAsync(); }; }
    return undefined;
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") { setPassword(""); setOtp(""); setFocusedField(null); } });
    return () => subscription.remove();
  }, []);

  function resetToCredentials() { setChallenge(null); setOtp(""); setPassword(""); setOtpExpired(false); setMessage(undefined); setScreen("credentials"); }
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
    try { const next = await resendEmailOtp(challenge); setChallenge(next); setOtp(""); setOtpExpired(false); await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
    catch (error) { setMessage(error instanceof Error ? error.message : "We could not resend the verification code."); }
    finally { setBusy(false); }
  }
  async function completeEmailVerification() {
    if (!challenge || !/^\d{6}$/.test(otp)) { setMessage("Enter the six-digit code from your registered email."); return; }
    setBusy(true); setMessage(undefined);
    try {
      const nextSession = await verifyEmailOtp(challenge, otp);
      await saveSignedInSession(nextSession);
      setSession(nextSession); setChallenge(null); setOtp(""); setScreen("signed-in");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { setMessage(error instanceof Error ? error.message : "We could not verify that code."); }
    finally { setBusy(false); }
  }
  async function signOut() { await clearSignedInSession(); setSession(null); setChallenge(null); setPassword(""); setOtp(""); setMessage(undefined); setScreen("welcome"); }

  if (launchPhase === "splash") return <BrandArtwork source={SPLASH_ART} label="KRAVIA loading screen" />;
  if (launchPhase === "loading") return <BrandArtwork source={LOADING_ART} label="KRAVIA secure storage loading" />;
  if (screen === "welcome") return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.welcomeContent} contentInsetAdjustmentBehavior="automatic"><Image source={BRAND_ICON} style={styles.welcomeLogo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.welcomeTitle}>Welcome to{"\n"}KRAVIA</Text><Text style={styles.body}>Sign in with your registered corporate email. We will then send a one-time verification code to that email address.</Text><View style={styles.panel}><Text style={styles.panelTitle}>Simple, secure access</Text><Text style={styles.panelCopy}>Your password is never saved on this device. Verification codes expire automatically.</Text></View>{message ? <Text style={styles.error}>{message}</Text> : null}<Button label="Get started" onPress={() => { setMessage(undefined); setScreen("credentials"); }} /><Text style={styles.securityNote}>Only registered KRAVIA Office accounts can continue.</Text></ScrollView></SafeAreaView>;
  if (screen === "credentials") return <SafeAreaView style={styles.root}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"><Pressable accessibilityRole="button" onPress={() => { setMessage(undefined); setScreen("welcome"); }}><Text style={styles.backLink}>‹ Back</Text></Pressable><Image source={BRAND_ICON} style={styles.logo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.title}>Sign in</Text><Text style={styles.body}>Use the corporate credentials registered to your account.</Text><Text style={styles.label}>Corporate email</Text><TextInput style={[styles.input, focusedField === "email" && styles.inputFocused, Boolean(message) && styles.inputError, busy && styles.inputDisabled]} accessibilityLabel="Corporate email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField((field) => field === "email" ? null : field)} placeholder="name@kraviaprivatelimited.com" placeholderTextColor={colors.placeholder} editable={!busy} /><Text style={styles.label}>Password</Text><View style={[styles.passwordField, focusedField === "password" && styles.inputFocused, Boolean(message) && styles.inputError, busy && styles.inputDisabled]}><TextInput style={styles.passwordInput} accessibilityLabel="Password" autoCapitalize="none" autoCorrect={false} autoComplete="current-password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField((field) => field === "password" ? null : field)} placeholder="Enter your password" placeholderTextColor={colors.placeholder} editable={!busy} /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword((value) => !value)} style={styles.passwordToggle}><Text style={styles.passwordToggleText}>{showPassword ? "Hide" : "Show"}</Text></Pressable></View>{message ? <Text style={styles.error}>{message}</Text> : null}<Button label={busy ? "Checking credentials…" : "Continue"} onPress={() => void beginEmailVerification()} disabled={busy} /><Text style={styles.securityNote}>Continue only on your own device. Your password is never stored.</Text></ScrollView></KeyboardAvoidingView></SafeAreaView>;
  if (screen === "otp" && challenge) return <SafeAreaView style={styles.root}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.otpContent} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"><Pressable accessibilityRole="button" onPress={resetToCredentials} disabled={busy}><Text style={styles.backLink}>‹ Use another account</Text></Pressable><Image source={BRAND_ICON} style={styles.logo} /><Text style={styles.kicker}>EMAIL VERIFICATION</Text><Text style={styles.title}>Enter your code</Text><Text style={styles.body}>We sent a six-digit code to {emailMask(challenge.email)}.</Text><TimerCircle expiresAt={challenge.expiresAt} onExpire={() => { if (!otpExpired) { setOtpExpired(true); setMessage("This verification code has expired. Request a new one to continue."); } }} /><Text style={styles.label}>Verification code</Text><TextInput style={[styles.otpInput, focusedField === "otp" && styles.inputFocused, Boolean(message) && styles.inputError, busy && styles.inputDisabled]} accessibilityLabel="Six digit verification code" autoComplete="one-time-code" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, ""))} onFocus={() => setFocusedField("otp")} onBlur={() => setFocusedField((field) => field === "otp" ? null : field)} placeholder="000000" placeholderTextColor={colors.placeholder} editable={!busy && !otpExpired} />{message ? <Text style={styles.error}>{message}</Text> : null}<Button label={busy ? "Verifying…" : "Verify and sign in"} onPress={() => void completeEmailVerification()} disabled={busy || otpExpired || otp.length !== 6} /><Button label={busy ? "Please wait…" : "Resend code"} variant="secondary" onPress={() => void resendCode()} disabled={busy} /><Text style={styles.securityNote}>Codes are single-use and expire automatically. KRAVIA will never ask you to share this code.</Text></ScrollView></KeyboardAvoidingView></SafeAreaView>;
  return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.welcomeContent} contentInsetAdjustmentBehavior="automatic"><Image source={BRAND_ICON} style={styles.welcomeLogo} /><Text style={styles.kicker}>KRAVIA OFFICE</Text><Text style={styles.welcomeTitle}>You’re{"\n"}signed in</Text><Text style={styles.body}>Your registered email was verified successfully. This secure session will expire after 30 days, then you will sign in again.</Text><View style={styles.panel}><Text style={styles.panelTitle}>Signed in as</Text><Text style={styles.panelCopy}>{session?.email ?? "KRAVIA Office account"}</Text></View><Button label="Sign out" variant="secondary" onPress={() => void signOut()} /><Text style={styles.securityNote}>This app protects verification screens from screenshots and app-switcher previews.</Text></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  artworkRoot: { flex: 1, backgroundColor: colors.artworkBackdrop, alignItems: "center", justifyContent: "center" }, artwork: { width: "100%", height: "100%" }, root: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  welcomeContent: { flexGrow: 1, maxWidth: 520, alignSelf: "center", width: "100%", justifyContent: "center", paddingHorizontal: 28, paddingTop: 34, paddingBottom: 34, gap: 16 }, content: { flexGrow: 1, maxWidth: 520, alignSelf: "center", width: "100%", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36, gap: 14 }, otpContent: { flexGrow: 1, maxWidth: 520, alignSelf: "center", width: "100%", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36, gap: 14 },
  welcomeLogo: { width: 84, height: 84, borderRadius: 22, marginBottom: 10 }, logo: { width: 58, height: 58, borderRadius: 16, marginTop: 8 }, kicker: { color: colors.accent, fontFamily: TEXT_FONT, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 }, welcomeTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 48, fontWeight: "700", letterSpacing: -2.2, lineHeight: 52 }, title: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 38, fontWeight: "700", letterSpacing: -1.5, lineHeight: 42 }, body: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 15, lineHeight: 23 }, backLink: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 14, fontWeight: "700", paddingVertical: 6 },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 17, gap: 5 }, panelTitle: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 16, fontWeight: "700" }, panelCopy: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }, primaryButtonPressed: { backgroundColor: colors.primaryPressed }, secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }, buttonDisabled: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledSurface }, buttonPressed: { opacity: 0.82 }, buttonText: { color: colors.onPrimary, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: "700" }, secondaryButtonText: { color: colors.primary }, buttonTextDisabled: { color: colors.disabledText },
  label: { color: colors.text, fontFamily: TEXT_FONT, fontSize: 12, fontWeight: "800", marginTop: 4 }, input: { minHeight: 54, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, paddingHorizontal: 14, color: colors.text, fontFamily: TEXT_FONT, fontSize: 15 }, passwordField: { minHeight: 54, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, flexDirection: "row", alignItems: "center" }, passwordInput: { flex: 1, minHeight: 52, paddingHorizontal: 14, color: colors.text, fontFamily: TEXT_FONT, fontSize: 15 }, passwordToggle: { paddingHorizontal: 14, minHeight: 52, justifyContent: "center" }, passwordToggleText: { color: colors.primary, fontFamily: DISPLAY_FONT, fontSize: 13, fontWeight: "700" }, inputFocused: { borderColor: colors.primary, borderWidth: 2 }, inputError: { borderColor: colors.semanticError }, inputDisabled: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledSurface }, error: { color: colors.semanticError, fontFamily: TEXT_FONT, backgroundColor: colors.semanticErrorSurface, borderRadius: 12, padding: 12, lineHeight: 19 }, securityNote: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 2 },
  timerWrap: { alignItems: "center", marginVertical: 4 }, timerTrack: { width: 128, height: 128, borderRadius: 64, borderWidth: 7, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, timerProgress: { position: "absolute", width: 116, height: 116, borderRadius: 58, borderWidth: 2, borderColor: colors.accentSoft }, timerMarker: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent }, timerCopy: { alignItems: "center", gap: 2 }, timerTime: { color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: "700", fontVariant: ["tabular-nums"] }, timerLabel: { color: colors.mutedText, fontFamily: TEXT_FONT, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }, otpInput: { minHeight: 62, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, color: colors.text, fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: "700", letterSpacing: 9, textAlign: "center", paddingHorizontal: 20, fontVariant: ["tabular-nums"] },
});
