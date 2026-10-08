import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { usePreventScreenCapture } from "expo-screen-capture";
import {
  checkDeviceApproval,
  completeDeviceApproval,
  IdentityApiError,
  requestEmailOtp,
  resendEmailOtp,
  verifyEmailOtp,
  type PendingEmailOtpChallenge,
} from "./src/activation";
import {
  clearAuthenticatorSession,
  clearPendingDeviceApproval,
  clearTrustedDeviceBinding,
  enforceInstallationBoundary,
  loadAuthenticatorSession,
  loadPendingDeviceApproval,
  loadTrustedDeviceBinding,
  saveAuthenticatorSession,
  savePendingDeviceApproval,
  saveTrustedDeviceBinding,
  type AuthenticatorDeviceSession,
  type PendingDeviceApproval,
  type TrustedDeviceBinding,
} from "./src/storage";
import { unlockAuthenticator } from "./src/security";
import { colors } from "./src/theme";

type LaunchPhase = "splash" | "loading" | "ready";
type Screen =
  | "welcome"
  | "credentials"
  | "otp"
  | "approval"
  | "locked"
  | "home"
  | "settings";
type FocusedField = "email" | "password" | "otp" | null;

const BRAND_ICON = require("./assets/brand/icon.png");
const SPLASH_ART = require("./assets/brand/splash.jpg");
const LOADING_ART = require("./assets/brand/loading.jpg");
const TEXT_FONT =
  Platform.select({
    ios: "Avenir Next",
    android: "sans-serif",
    default: "System",
  }) ?? "System";
const DISPLAY_FONT =
  Platform.select({
    ios: "Avenir Next",
    android: "sans-serif-medium",
    default: "System",
  }) ?? "System";

function BrandArtwork({
  source,
  label,
}: {
  source: ImageSourcePropType;
  label: string;
}) {
  return (
    <SafeAreaView style={styles.artworkRoot} accessibilityLabel={label}>
      <Image source={source} resizeMode="contain" style={styles.artwork} />
    </SafeAreaView>
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
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant !== "primary" && styles.secondaryButtonText,
          variant === "danger" && styles.dangerButtonText,
          disabled && styles.buttonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function AuthHeader({ step }: { step?: string }) {
  return (
    <View style={styles.authHeader}>
      <View style={styles.brandLockup}>
        <Image source={BRAND_ICON} style={styles.headerLogo} />
        <View>
          <Text style={styles.brandName}>KRAVIA</Text>
          <Text style={styles.brandProduct}>AUTHENTICATOR</Text>
        </View>
      </View>
      {step ? <Text style={styles.headerStep}>{step}</Text> : null}
    </View>
  );
}
function ProgressRail({ active }: { active: 1 | 2 | 3 }) {
  const steps = ["Credentials", "Email code", "Trusted device"] as const;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: 3, now: active }}
      accessibilityLabel={`Security setup step ${active} of 3`}
      style={styles.progressRail}
    >
      {steps.map((label, index) => {
        const step = index + 1;
        const isActive = step === active;
        const isComplete = step < active;
        return (
          <View key={label} style={styles.progressItem}>
            <Text
              style={[
                styles.progressNumber,
                (isActive || isComplete) && styles.progressNumberActive,
              ]}
            >
              {step}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.progressLabel,
                isActive && styles.progressLabelActive,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
function TimerCircle({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const spin = useRef(new Animated.Value(0)).current;
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(expiresAt) - now) / 1000),
  );
  const minutes = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4_000,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);
  useEffect(() => {
    if (remaining <= 0) onExpire();
  }, [onExpire, remaining]);
  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={`Verification code expires in ${minutes} minutes ${seconds} seconds`}
      style={styles.timerWrap}
    >
      <View
        style={[
          styles.timerTrack,
          {
            borderColor: remaining
              ? colors.primarySoftBorder
              : colors.semanticErrorBorder,
          },
        ]}
      >
        {remaining ? (
          <Animated.View
            style={[
              styles.timerMarker,
              { transform: [{ rotate: rotation }, { translateY: -29 }] },
            ]}
          />
        ) : null}
        <View style={styles.timerCopy}>
          <Text style={styles.timerTime}>
            {minutes}:{seconds}
          </Text>
          <Text style={styles.timerLabel}>
            {remaining ? "code expires" : "code expired"}
          </Text>
        </View>
      </View>
    </View>
  );
}
function ApprovalPulse({ expiresAt }: { expiresAt: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);
  const remaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 60_000));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.45);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1_250,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1_250,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.16] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.06] });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Waiting for device approval. Request expires in about ${remaining} minute${remaining === 1 ? "" : "s"}.`}
      style={styles.approvalPulse}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.approvalPulseRing, { opacity, transform: [{ scale }] }]}
      />
      <View style={styles.approvalPulseCore}>
        <Text style={styles.approvalPulseLabel}>WAITING</Text>
        <Text style={styles.approvalPulseTime}>{remaining}m</Text>
      </View>
    </View>
  );
}
function emailMask(email: string) {
  const [local, domain] = email.split("@");
  return !domain || !local
    ? email
    : `${local.slice(0, 2)}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}
function sessionRemaining(expiresAt: string) {
  const days = Math.max(
    0,
    Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000),
  );
  return `${days} day${days === 1 ? "" : "s"}`;
}
function secondsUntil(when: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(when) - now) / 1_000));
}
function clockLabel(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function App() {
  usePreventScreenCapture("authenticator");
  const { height } = useWindowDimensions();
  const compactHeight = height < 720;
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("splash");
  const [screen, setScreen] = useState<Screen>("welcome");
  const [session, setSession] = useState<AuthenticatorDeviceSession | null>(
    null,
  );
  const [trustedDevice, setTrustedDevice] =
    useState<TrustedDeviceBinding | null>(null);
  const [pendingDevice, setPendingDevice] =
    useState<PendingDeviceApproval | null>(null);
  const [challenge, setChallenge] = useState<PendingEmailOtpChallenge | null>(
    null,
  );
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
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => setLaunchPhase("loading"), 900);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if (launchPhase !== "loading") return;
    let active = true;
    void (async () => {
      try {
        const boundary = await enforceInstallationBoundary();
        const [storedSession, storedPending, storedBinding] = await Promise.all(
          [
            loadAuthenticatorSession(),
            loadPendingDeviceApproval(),
            loadTrustedDeviceBinding(),
          ],
        );
        if (!active) return;
        setSession(storedSession);
        setPendingDevice(storedPending);
        setTrustedDevice(storedBinding);
        setEmail(storedSession?.email ?? storedPending?.email ?? "");
        if (boundary.reset)
          setMessage(
            "This installation was reset. Verify your credentials to trust this phone again.",
          );
        if (storedPending) setScreen("approval");
        else if (storedSession) setScreen("locked");
      } catch (error) {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : "Authenticator could not open secure device storage.",
          );
      } finally {
        if (active) setLaunchPhase("ready");
      }
    })();
    return () => {
      active = false;
    };
  }, [launchPhase]);
  useEffect(() => {
    if (!challenge && !session) return;
    setNow(Date.now());
    const interval = setInterval(
      () => setNow(Date.now()),
      challenge ? 1_000 : 60_000,
    );
    return () => clearInterval(interval);
  }, [challenge, session]);
  useEffect(() => {
    if (!session || Date.parse(session.expiresAt) > now) return;
    void clearAuthenticatorSession();
    setSession(null);
    setScreen("welcome");
    setMessage(
      "Your 30-day verification session has expired. Sign in again to unlock this trusted device.",
    );
  }, [now, session]);
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
      if (state === "background") {
        setPassword("");
        setOtp("");
        setFocusedField(null);
        if (screen === "home") setScreen("locked");
      }
      if (state === "active") setApprovalRefresh((value) => value + 1);
    });
    return () => subscription.remove();
  }, [screen]);
  useEffect(() => {
    if (screen !== "approval" || !pendingDevice) return;
    let disposed = false;
    const poll = async () => {
      try {
        const current = await checkDeviceApproval(pendingDevice);
        if (disposed) return;
        if (current.status === "APPROVED") {
          setMessage("Your device was trusted. Securing this phone…");
          const next = await completeDeviceApproval(pendingDevice);
          const binding: TrustedDeviceBinding = {
            deviceApprovalId: pendingDevice.approvalId,
            deviceProof: pendingDevice.deviceProof,
          };
          if (disposed) return;
          await Promise.all([
            saveAuthenticatorSession(next),
            saveTrustedDeviceBinding(binding),
            clearPendingDeviceApproval(),
          ]);
          setSession(next);
          setTrustedDevice(binding);
          setPendingDevice(null);
          setScreen("home");
          setMessage("This phone is now your trusted KRAVIA device.");
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        } else if (
          [
            "DECLINED",
            "EXPIRED",
            "REVOKED",
            "DELIVERY_FAILED",
            "DELIVERY_UNKNOWN",
          ].includes(current.status)
        ) {
          await clearPendingDeviceApproval();
          if (!disposed) {
            setPendingDevice(null);
            setScreen("welcome");
            setMessage(
              current.status === "DECLINED"
                ? "This sign-in was ignored. The device was signed out immediately."
                : "This device request is no longer available. Sign in again if this was you.",
            );
          }
        }
      } catch (error) {
        if (
          !disposed &&
          error instanceof IdentityApiError &&
          [404, 409, 410].includes(error.status)
        ) {
          await clearPendingDeviceApproval();
          setPendingDevice(null);
          setScreen("welcome");
          setMessage(
            "This device request is no longer available. Sign in again if this was you.",
          );
        }
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 3_000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [approvalRefresh, pendingDevice, screen]);
  const resendRemaining = useMemo(
    () => (challenge ? secondsUntil(challenge.resendAvailableAt, now) : 0),
    [challenge, now],
  );
  function resetToCredentials() {
    setChallenge(null);
    setOtp("");
    setPassword("");
    setOtpExpired(false);
    setMessage(undefined);
    setScreen("credentials");
  }
  async function beginEmailVerification() {
    if (!email.trim() || !password) {
      setMessage("Enter your registered corporate email and password.");
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      const pending = await requestEmailOtp(
        email.trim().toLowerCase(),
        password,
      );
      setChallenge(pending);
      setPassword("");
      setOtp("");
      setOtpExpired(false);
      setScreen("otp");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not start email verification.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resendCode() {
    if (!challenge) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const next = await resendEmailOtp(challenge);
      setChallenge(next);
      setOtp("");
      setOtpExpired(false);
      setMessage(
        "A new verification code was sent. The previous code is no longer valid.",
      );
    } catch (error) {
      if (
        error instanceof IdentityApiError &&
        [409, 410].includes(error.status)
      ) {
        resetToCredentials();
        setMessage(
          "This verification request is no longer available. Sign in again to send a new code.",
        );
      } else
        setMessage(
          error instanceof Error
            ? error.message
            : "We could not resend the verification code.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function completeEmailVerification() {
    if (!challenge || !/^\d{6}$/.test(otp)) {
      setMessage("Enter the six-digit code from your registered email.");
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await verifyEmailOtp(challenge, otp, trustedDevice);
      setChallenge(null);
      setOtp("");
      if (result.kind === "active") {
        await saveAuthenticatorSession(result.session);
        setSession(result.session);
        setScreen("home");
        setMessage("Email verified. Your trusted Authenticator is ready.");
      } else {
        await savePendingDeviceApproval(result.pending);
        setPendingDevice(result.pending);
        setScreen("approval");
        setMessage(
          "Open the registered-email security review. This phone will continue automatically as soon as you trust this exact device.",
        );
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not verify that code.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function unlock() {
    if (!session) {
      setScreen("welcome");
      return;
    }
    setUnlocking(true);
    setMessage(undefined);
    try {
      const result = await unlockAuthenticator();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setScreen("home");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Authenticator could not unlock.",
      );
    } finally {
      setUnlocking(false);
    }
  }
  async function signOut() {
    await clearAuthenticatorSession();
    setSession(null);
    setChallenge(null);
    setPassword("");
    setOtp("");
    setScreen("welcome");
    setMessage(
      "Signed out. This phone remains registered, but credentials and email verification are required to unlock it again.",
    );
  }
  function removeTrustedDevice() {
    Alert.alert(
      "Remove this trusted device?",
      "This signs out this phone and removes its local device binding. You will need to complete a new email Trust decision before using it again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await Promise.all([
                clearAuthenticatorSession(),
                clearTrustedDeviceBinding(),
                clearPendingDeviceApproval(),
              ]);
              setSession(null);
              setTrustedDevice(null);
              setPendingDevice(null);
              setScreen("welcome");
              setMessage("This phone is no longer trusted.");
            })();
          },
        },
      ],
    );
  }
  if (launchPhase === "splash")
    return <BrandArtwork source={SPLASH_ART} label="KRAVIA loading screen" />;
  if (launchPhase === "loading")
    return (
      <BrandArtwork
        source={LOADING_ART}
        label="KRAVIA secure storage loading"
      />
    );
  if (screen === "welcome")
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.welcomeContent, compactHeight && styles.compactScreen]}>
          <AuthHeader />
          <View style={styles.welcomeMain}>
            <Text style={styles.kicker}>KRAVIA OFFICE SECURITY</Text>
            <Text style={styles.welcomeTitle}>Your secure{`\n`}Authenticator</Text>
            <Text style={styles.body}>
              Use your registered corporate account to protect this phone.
            </Text>
            <View style={styles.briefRow}>
              <Text style={styles.briefTitle}>One trusted device</Text>
              <Text style={styles.briefCopy}>
                Credentials, a registered-email code and a Trust decision keep
                your Office account bound to this exact phone.
              </Text>
            </View>
            {message ? <Text style={styles.info}>{message}</Text> : null}
          </View>
          <View style={styles.actionFooter}>
            <Button
              label={trustedDevice ? "Verify and unlock" : "Get started"}
              onPress={() => {
                setMessage(undefined);
                setScreen("credentials");
              }}
            />
            <Text style={styles.securityNote}>
              No scan · protected registration · no copied login code
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  if (screen === "credentials")
    return (
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.authScreen, compactHeight && styles.compactScreen]}>
            <AuthHeader step="STEP 1 OF 3" />
            <ProgressRail active={1} />
            <Text style={styles.kicker}>SECURE SIGN-IN</Text>
            <Text style={styles.title}>Sign in to continue</Text>
            <Text style={styles.body}>
              Use the credentials registered to your KRAVIA Office account.
            </Text>
            <View style={styles.formStack}>
              <Text style={styles.label}>Corporate email</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === "email" && styles.inputFocused,
                  Boolean(message) && styles.inputError,
                  busy && styles.inputDisabled,
                ]}
                accessibilityLabel="Corporate email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                placeholder="name@kraviaprivatelimited.com"
                placeholderTextColor={colors.placeholder}
                editable={!busy}
              />
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.passwordField,
                  focusedField === "password" && styles.inputFocused,
                  Boolean(message) && styles.inputError,
                  busy && styles.inputDisabled,
                ]}
              >
                <TextInput
                  style={styles.passwordInput}
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={() => void beginEmailVerification()}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.placeholder}
                  editable={!busy}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.passwordToggle}
                  disabled={busy}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.actionFooter}>
              {message ? <Text style={styles.error}>{message}</Text> : null}
              <Button
                label={busy ? "Checking credentials…" : "Continue"}
                onPress={() => void beginEmailVerification()}
                disabled={busy}
              />
              <Text style={styles.securityNote}>
                Your password is never stored on this phone.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  if (screen === "otp" && challenge)
    return (
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.authScreen, compactHeight && styles.compactScreen]}>
            <AuthHeader step="STEP 2 OF 3" />
            <Pressable
              accessibilityRole="button"
              onPress={resetToCredentials}
              disabled={busy}
              style={styles.backButton}
            >
              <Text style={styles.backLink}>Use another account</Text>
            </Pressable>
            <ProgressRail active={2} />
            <Text style={styles.kicker}>EMAIL VERIFICATION</Text>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.body}>
              We sent a six-digit code to {emailMask(challenge.email)}.
            </Text>
            <TimerCircle
              expiresAt={challenge.expiresAt}
              onExpire={() => {
                if (!otpExpired) {
                  setOtpExpired(true);
                  setMessage(
                    "This verification code has expired. Sign in again to send a new one.",
                  );
                }
              }}
            />
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              style={[
                styles.otpInput,
                focusedField === "otp" && styles.inputFocused,
                Boolean(message) && styles.inputError,
                busy && styles.inputDisabled,
              ]}
              accessibilityLabel="Six digit verification code"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, ""))}
              onFocus={() => setFocusedField("otp")}
              onBlur={() => setFocusedField(null)}
              placeholder="000000"
              placeholderTextColor={colors.placeholder}
              editable={!busy && !otpExpired}
              returnKeyType="done"
              onSubmitEditing={() => void completeEmailVerification()}
            />
            <View style={styles.actionFooter}>
              {message ? <Text style={styles.error}>{message}</Text> : null}
              <Button
                label={busy ? "Verifying…" : "Verify"}
                onPress={() => void completeEmailVerification()}
                disabled={busy || otpExpired || otp.length !== 6}
              />
              <Button
                label={
                  otpExpired
                    ? "Sign in again"
                    : busy
                      ? "Please wait…"
                      : resendRemaining
                        ? `Resend in ${clockLabel(resendRemaining)}`
                        : "Resend code"
                }
                variant="secondary"
                onPress={() => {
                  if (otpExpired) resetToCredentials();
                  else void resendCode();
                }}
                disabled={busy || (!otpExpired && resendRemaining > 0)}
              />
              <Text style={styles.securityNote}>
                Codes are single-use. KRAVIA will never ask you to share one.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  if (screen === "approval" && pendingDevice)
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.approvalContent, compactHeight && styles.approvalContentCompact]}>
          <View style={styles.approvalTop}>
            <AuthHeader step="STEP 3 OF 3" />
            <ProgressRail active={3} />
          </View>
          <View style={styles.approvalMain}>
            <ApprovalPulse expiresAt={pendingDevice.expiresAt} />
            <Text style={styles.kicker}>DEVICE APPROVAL</Text>
            <Text style={styles.approvalTitle}>Waiting for your decision</Text>
            <Text style={styles.approvalBody}>
              Your credentials and email code are verified. Review the exact
              device request in your registered email, then choose Trust or Deny.
            </Text>
            <View style={styles.approvalDevicePanel}>
              <Text style={styles.approvalDeviceLabel}>REQUESTED DEVICE</Text>
              <Text style={styles.approvalDeviceName}>{pendingDevice.deviceLabel}</Text>
              <Text style={styles.approvalDeviceCopy}>
                This phone continues automatically only after a Trust decision.
              </Text>
            </View>
            {message ? <Text style={styles.info}>{message}</Text> : null}
          </View>
          <Text style={styles.securityNote}>
            The email page only confirms the request. It cannot sign in another device.
          </Text>
        </View>
      </SafeAreaView>
    );
  if (screen === "locked" && session)
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.lockContent, compactHeight && styles.compactScreen]}>
          <AuthHeader step="TRUSTED DEVICE" />
          <View style={styles.lockMain}>
            <Text style={styles.kicker}>DEVICE PROTECTION</Text>
            <Text style={styles.title}>Ready when{`\n`}you are</Text>
            <Text style={styles.centerBody}>
              Unlock with strong device biometrics. Authenticator locks whenever
              it leaves the foreground.
            </Text>
            {message ? <Text style={styles.info}>{message}</Text> : null}
          </View>
          <View style={styles.actionFooter}>
            <Button
              label={unlocking ? "Unlocking…" : "Unlock"}
              onPress={() => void unlock()}
              disabled={unlocking}
            />
            <Button
              label="Sign out"
              variant="secondary"
              onPress={() => void signOut()}
              disabled={unlocking}
            />
            <Text style={styles.securityNote}>
              Biometric lock · background lock · screenshot protection
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  if (screen === "settings" && session)
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen("home")}
            style={styles.backButton}
          >
            <Text style={styles.backLink}>Back</Text>
          </Pressable>
          <AuthHeader step="SECURITY" />
          <Text style={styles.kicker}>DEVICE SECURITY</Text>
          <Text style={styles.title}>Security</Text>
          <View style={styles.accountPanel}>
            <Text style={styles.accountEyebrow}>TRUSTED DEVICE</Text>
            <Text style={styles.accountName}>KRAVIA Office</Text>
            <Text style={styles.accountEmail}>{session.email}</Text>
            <Text style={styles.accountStatus}>Registered to this phone</Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Mandatory protection</Text>
            <Text style={styles.panelCopy}>
              Biometric unlock, screenshot protection, background lock and
              registered-email verification stay on for every user.
            </Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Verification session</Text>
            <Text style={styles.panelCopy}>
              Credentials and an email code are required again in{" "}
              {sessionRemaining(session.expiresAt)}.
            </Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Replacement device</Text>
            <Text style={styles.panelCopy}>
              To move your account, sign in on the new device and review the
              security email. Trusting a new device signs this one out.
            </Text>
          </View>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={() => void signOut()}
          />
          <Button
            label="Remove this device"
            variant="danger"
            onPress={removeTrustedDevice}
          />
          <Text style={styles.securityNote}>
            Removing this phone does not remove your Office account.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  if (screen === "home" && session)
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.homeContent}
          contentInsetAdjustmentBehavior="automatic"
        >
          <AuthHeader step="TRUSTED" />
          <View style={styles.topRow}>
            <Text style={styles.homeHeading}>Device security</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setScreen("locked")}
            >
              <Text style={styles.lockLink}>Lock</Text>
            </Pressable>
          </View>
          <View style={styles.codeCard}>
            <Text style={styles.codeIssuer}>TRUSTED KRAVIA DEVICE</Text>
            <Text style={styles.codeAccount}>{session.email}</Text>
            <Text style={styles.trustedMark}>DEVICE ACTIVE</Text>
            <Text style={styles.codeHint}>
              Email verified · one device lock active
            </Text>
          </View>
          {message ? <Text style={styles.info}>{message}</Text> : null}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>How sign-in works</Text>
            <Text style={styles.panelCopy}>
              Enter your corporate credentials, then type the six-digit code
              sent to your registered email. New mobile or laptop sign-ins
              remain blocked until you choose Trust in the security email.
            </Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Your device boundary</Text>
            <Text style={styles.panelCopy}>
              Trusting a new device securely signs out the old one. Blocking
              the request immediately ends the new sign-in.
            </Text>
          </View>
          <Button
            label="Security settings"
            variant="secondary"
            onPress={() => setScreen("settings")}
          />
        </ScrollView>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.lockContent}>
        <Text style={styles.title}>Authenticator needs to restart</Text>
        <Text style={styles.centerBody}>
          Secure app state was unavailable. Return to the welcome screen and
          verify your account again.
        </Text>
        <Button
          label="Return to welcome"
          onPress={() => setScreen("welcome")}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  artworkRoot: {
    flex: 1,
    backgroundColor: colors.artworkBackdrop,
    alignItems: "center",
    justifyContent: "center",
  },
  artwork: { width: "100%", height: "100%" },
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  authScreen: {
    flex: 1,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  compactScreen: { paddingTop: 8, paddingBottom: 8, gap: 6 },
  authHeader: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogo: { width: 32, height: 32, borderRadius: 9 },
  brandName: {
    color: colors.primary,
    fontFamily: DISPLAY_FONT,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  brandProduct: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginTop: 1,
  },
  headerStep: {
    color: colors.accent,
    fontFamily: TEXT_FONT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  progressRail: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  progressItem: { alignItems: "center", flex: 1, gap: 3 },
  progressNumber: {
    color: colors.mutedText,
    fontFamily: DISPLAY_FONT,
    fontSize: 11,
    fontWeight: "800",
  },
  progressNumberActive: { color: colors.primary },
  progressLabel: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 10,
    textAlign: "center",
  },
  progressLabelActive: { color: colors.primary, fontWeight: "800" },
  welcomeContent: {
    flex: 1,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  welcomeMain: { gap: 10, marginTop: "auto", marginBottom: "auto" },
  actionFooter: { gap: 8, marginTop: "auto" },
  formStack: { gap: 6 },
  briefRow: {
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  approvalContent: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 14,
  },
  approvalContentCompact: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  approvalTop: { gap: 10 },
  approvalMain: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  approvalPulse: {
    width: 138,
    height: 138,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  approvalPulseRing: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  approvalPulseCore: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  approvalPulseLabel: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  approvalPulseTime: {
    color: colors.onPrimary,
    fontFamily: DISPLAY_FONT,
    fontSize: 27,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  approvalTitle: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 33,
    textAlign: "center",
  },
  approvalBody: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 440,
  },
  approvalDevicePanel: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  approvalDeviceLabel: {
    color: colors.accent,
    fontFamily: TEXT_FONT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.25,
  },
  approvalDeviceName: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 16,
    fontWeight: "700",
  },
  approvalDeviceCopy: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  content: {
    flexGrow: 1,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  homeContent: {
    flexGrow: 1,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 12,
  },
  lockContent: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  lockMain: { gap: 10, marginTop: "auto", marginBottom: "auto" },
  logo: { width: 40, height: 40, borderRadius: 12, marginTop: 2 },
  kicker: {
    color: colors.accent,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  welcomeTitle: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 31,
  },
  title: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 31,
  },
  homeHeading: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  body: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 14,
    lineHeight: 20,
  },
  centerBody: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  backLink: {
    color: colors.primary,
    fontFamily: DISPLAY_FONT,
    fontSize: 13,
    fontWeight: "700",
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 28,
    justifyContent: "center",
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  panelTitle: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 15,
    fontWeight: "700",
  },
  panelCopy: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  briefTitle: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 13,
    fontWeight: "700",
  },
  briefCopy: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    lineHeight: 17,
  },
  info: {
    color: colors.primary,
    fontFamily: TEXT_FONT,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    borderRadius: 12,
    padding: 10,
    lineHeight: 18,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.semanticErrorSurface,
    borderWidth: 1,
    borderColor: colors.semanticErrorBorder,
  },
  buttonDisabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledSurface,
  },
  buttonPressed: { opacity: 0.82 },
  buttonText: {
    color: colors.onPrimary,
    fontFamily: DISPLAY_FONT,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButtonText: { color: colors.primary },
  dangerButtonText: { color: colors.semanticError },
  buttonTextDisabled: { color: colors.disabledText },
  label: {
    color: colors.text,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 13,
    color: colors.text,
    fontFamily: TEXT_FONT,
    fontSize: 15,
  },
  passwordField: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 13,
    color: colors.text,
    fontFamily: TEXT_FONT,
    fontSize: 15,
  },
  passwordToggle: {
    paddingHorizontal: 13,
    minHeight: 46,
    justifyContent: "center",
  },
  passwordToggleText: {
    color: colors.primary,
    fontFamily: DISPLAY_FONT,
    fontSize: 13,
    fontWeight: "700",
  },
  inputFocused: { borderColor: colors.primary, borderWidth: 2 },
  inputError: { borderColor: colors.semanticError },
  inputDisabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledSurface,
  },
  error: {
    color: colors.semanticError,
    fontFamily: TEXT_FONT,
    backgroundColor: colors.semanticErrorSurface,
    borderRadius: 10,
    padding: 9,
    fontSize: 12,
    lineHeight: 17,
  },
  securityNote: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 2,
  },
  timerWrap: { alignItems: "center", marginVertical: 0 },
  timerTrack: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  timerMarker: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  timerCopy: { alignItems: "center", gap: 2 },
  timerTime: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timerLabel: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  otpInput: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 7,
    textAlign: "center",
    paddingHorizontal: 20,
    fontVariant: ["tabular-nums"],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lockLink: {
    color: colors.primary,
    fontFamily: DISPLAY_FONT,
    fontSize: 14,
    fontWeight: "700",
    padding: 10,
  },
  codeCard: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  codeIssuer: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  codeAccount: { color: colors.onPrimary, fontFamily: TEXT_FONT, fontSize: 15 },
  trustedMark: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginTop: 8,
  },
  codeHint: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  accountPanel: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    gap: 5,
  },
  accountEyebrow: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  accountName: {
    color: colors.onPrimary,
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    fontWeight: "700",
  },
  accountEmail: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 13,
  },
  accountStatus: {
    color: colors.onPrimary,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 7,
  },
});
