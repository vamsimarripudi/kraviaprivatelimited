import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
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
  claimAuthenticatorActivation,
  completeDeviceApproval,
  IdentityApiError,
  requestAuthenticatorActivation,
  requestEmailOtp,
  resendEmailOtp,
  verifyEmailOtp,
  type PendingEmailOtpChallenge,
} from "./src/activation";
import {
  clearAuthenticatorFactor,
  clearAuthenticatorSession,
  clearPendingDeviceApproval,
  clearTrustedDeviceBinding,
  enforceInstallationBoundary,
  loadAuthenticatorFactor,
  loadAuthenticatorSession,
  loadPendingDeviceApproval,
  loadTrustedDeviceBinding,
  saveAuthenticatorFactor,
  saveAuthenticatorSession,
  savePendingDeviceApproval,
  saveTrustedDeviceBinding,
  type AuthenticatorDeviceSession,
  type AuthenticatorFactor,
  type PendingDeviceApproval,
  type TrustedDeviceBinding,
} from "./src/storage";
import {
  inspectBiometricReadiness,
  unlockAuthenticator,
  type BiometricReadiness,
} from "./src/security";
import { colors } from "./src/theme";
import { currentTotp } from "./src/totp";

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
const APP_VERSION = "1.0.0";
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
function AuthHeader({
  actionLabel,
  onAction,
}: {
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.authHeader}>
      <View style={styles.brandLockup}>
        <Image source={BRAND_ICON} style={styles.headerLogo} />
        <View>
          <Text style={styles.brandName}>KRAVIA</Text>
          <Text style={styles.brandProduct}>AUTHENTICATOR</Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={10}
          onPress={onAction}
          style={styles.headerAction}
        >
          <Text style={styles.headerActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AppTopBar({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.appTopBar}>
      <Text style={styles.appTopBarTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={10}
          onPress={onAction}
          style={styles.appTopBarAction}
        >
          <Text style={styles.appTopBarActionText}>{actionLabel}</Text>
        </Pressable>
      ) : <View style={styles.appTopBarPlaceholder} />}
    </View>
  );
}

function SecureLoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.14] });
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.loadingContent} accessibilityLiveRegion="polite">
        <View style={styles.loadingMark}>
          <Animated.View
            pointerEvents="none"
            style={[styles.loadingHalo, { opacity, transform: [{ scale }] }]}
          />
          <Image source={BRAND_ICON} style={styles.loadingIcon} />
        </View>
        <Text style={styles.kicker}>SECURE STARTUP</Text>
        <Text style={styles.title}>Preparing Authenticator</Text>
        <Text style={styles.centerBody}>Checking protected device storage.</Text>
        <ActivityIndicator color={colors.primary} size="small" accessibilityLabel="Loading Authenticator" />
      </View>
    </SafeAreaView>
  );
}

function UnavailableScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.unavailableContent}>
        <AppTopBar title="Authenticator" />
        <View style={styles.unavailableMain}>
          <View style={styles.unavailableMark}>
            <Text style={styles.unavailableMarkText}>!</Text>
          </View>
          <Text style={styles.kicker}>SECURE SESSION</Text>
          <Text style={styles.title}>This screen is unavailable</Text>
          <Text style={styles.centerBody}>
            Your protected session is no longer available. Sign in to verify this phone again.
          </Text>
        </View>
        <View style={styles.actionFooter}>
          <Button label="Sign in securely" onPress={onContinue} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function BiometricControl({ readiness }: { readiness: BiometricReadiness | null }) {
  const enabled = readiness?.available ?? false;
  const method = readiness?.method ?? "Checking device biometrics";
  const detail = readiness?.detail ?? "Checking the biometric protection available on this phone.";
  return (
    <View
      accessible
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled: true }}
      accessibilityLabel={`${method}. ${detail}`}
      style={styles.biometricControl}
    >
      <View style={styles.settingsRowCopy}>
        <Text style={styles.biometricControlTitle}>{method}</Text>
        <Text style={styles.biometricControlDetail}>{detail}</Text>
      </View>
      <View style={[styles.biometricToggleTrack, enabled && styles.biometricToggleTrackOn]}>
        <View style={[styles.biometricToggleThumb, enabled && styles.biometricToggleThumbOn]} />
      </View>
    </View>
  );
}

function AccountStatus({ label, tone = "trusted" }: { label: string; tone?: "trusted" | "muted" }) {
  return (
    <View style={styles.accountStatusRow}>
      <View style={[styles.statusDot, tone === "muted" && styles.statusDotMuted]} />
      <Text style={[styles.accountStatusText, tone === "muted" && styles.accountStatusMuted]}>{label}</Text>
    </View>
  );
}

function SettingsRow({
  label,
  detail,
  onPress,
  danger = false,
  actionLabel = "Open",
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
  actionLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.settingsRowPressed]}
    >
      <View style={styles.settingsRowCopy}>
        <Text style={[styles.settingsRowLabel, danger && styles.settingsRowDanger]}>{label}</Text>
        {detail ? <Text style={styles.settingsRowDetail}>{detail}</Text> : null}
      </View>
      <Text style={[styles.settingsRowAction, danger && styles.settingsRowDanger]}>{actionLabel}</Text>
    </Pressable>
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
  const [now, setNow] = useState(Date.now());
  const initialSeconds = useRef(
    Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1_000)),
  ).current;
  const remaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1_000));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
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
  const elapsedRatio = Math.min(1, Math.max(0, 1 - remaining / initialSeconds));
  const timerRotation = `${elapsedRatio * 360}deg`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Waiting for device approval. Request expires in ${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds.`}
      style={styles.approvalPulse}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.approvalPulseRing, { opacity, transform: [{ scale }] }]}
      />
      <View style={styles.approvalPulseCore}>
        <Text style={styles.approvalPulseLabel}>WAITING</Text>
        <Text style={styles.approvalPulseTime}>{clockLabel(remaining)}</Text>
      </View>
      {remaining ? (
        <View
          pointerEvents="none"
          style={[
            styles.approvalTimerMarker,
            { transform: [{ rotate: timerRotation }, { translateY: -59 }] },
          ]}
        />
      ) : null}
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
  const [factor, setFactor] = useState<AuthenticatorFactor | null>(null);
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
  const [biometricReadiness, setBiometricReadiness] =
    useState<BiometricReadiness | null>(null);
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
        const [storedSession, storedFactor, storedPending, storedBinding] =
          await Promise.all([
            loadAuthenticatorSession(),
            loadAuthenticatorFactor(),
            loadPendingDeviceApproval(),
            loadTrustedDeviceBinding(),
          ]);
        if (!active) return;
        setSession(storedSession);
        setFactor(
          storedFactor && storedFactor.account === storedSession?.email
            ? storedFactor
            : null,
        );
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
    if (!challenge && !session && !factor) return;
    setNow(Date.now());
    const interval = setInterval(
      () => setNow(Date.now()),
      challenge || factor ? 1_000 : 60_000,
    );
    return () => clearInterval(interval);
  }, [challenge, session]);
  useEffect(() => {
    if (!session || Date.parse(session.expiresAt) > now) return;
    void clearAuthenticatorSession();
    setSession(null);
    setScreen("credentials");
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
        setFactor(null);
        if (screen === "home") setScreen("locked");
      }
      if (state === "active") {
        setApprovalRefresh((value) => value + 1);
        void loadAuthenticatorFactor()
          .then((storedFactor) => setFactor(storedFactor))
          .catch(() => setFactor(null));
      }
    });
    return () => subscription.remove();
  }, [screen]);
  useEffect(() => {
    if (screen !== "settings") return;
    let active = true;
    setBiometricReadiness(null);
    void inspectBiometricReadiness()
      .then((next) => {
        if (active) setBiometricReadiness(next);
      })
      .catch(() => {
        if (active) {
          setBiometricReadiness({
            available: false,
            method: Platform.OS === "ios" ? "Face ID" : "Face or fingerprint",
            detail: "Biometric availability could not be checked. Open device Settings and verify your biometric lock.",
          });
        }
      });
    return () => {
      active = false;
    };
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
          const enrolledFactor = await enrollAuthenticatorFactor(next);
          if (disposed) return;
          setFactor(enrolledFactor);
          setScreen("home");
          setMessage("This phone is trusted and its local sign-in code is ready.");
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
            setScreen("credentials");
            setMessage(
              current.status === "DECLINED"
                ? "This sign-in was ignored. The device was signed out immediately."
                : "This device request is no longer available. Sign in again if this was you.",
            );
          }
        }
      } catch (error) {
        if (disposed) return;
        if (
          error instanceof IdentityApiError &&
          [404, 409, 410].includes(error.status)
        ) {
          await clearPendingDeviceApproval();
          setPendingDevice(null);
          setScreen("credentials");
          setMessage(
            "This device request is no longer available. Sign in again if this was you.",
          );
          return;
        }
        setScreen("locked");
        setMessage(
          error instanceof Error
            ? error.message
            : "This phone is trusted, but local code setup could not finish. Unlock it and try again.",
        );
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
  const totp = useMemo(
    () =>
      factor
        ? currentTotp(factor.secret, now, {
            digits: factor.digits,
            period: factor.period,
          })
        : null,
    [factor, now],
  );
  async function enrollAuthenticatorFactor(
    sessionForActivation: AuthenticatorDeviceSession,
  ) {
    const activation = await requestAuthenticatorActivation(
      sessionForActivation.accessToken,
    );
    const nextFactor = await claimAuthenticatorActivation(activation);
    if (nextFactor.account !== sessionForActivation.email) {
      throw new Error("The Authenticator factor does not match this trusted account.");
    }
    await saveAuthenticatorFactor(nextFactor);
    return nextFactor;
  }
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
        try {
          const enrolledFactor = await enrollAuthenticatorFactor(result.session);
          setFactor(enrolledFactor);
          setScreen("home");
          setMessage("Email verified. Your trusted Authenticator is ready.");
        } catch (activationError) {
          setScreen("locked");
          setMessage(
            activationError instanceof Error
              ? activationError.message
              : "This phone is trusted, but local code setup could not finish. Unlock it and try again.",
          );
        }
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
      setScreen("credentials");
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
    setScreen("credentials");
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
                clearAuthenticatorFactor(),
                clearTrustedDeviceBinding(),
                clearPendingDeviceApproval(),
              ]);
              setSession(null);
              setFactor(null);
              setTrustedDevice(null);
              setPendingDevice(null);
              setScreen("credentials");
              setMessage("This phone is no longer trusted.");
            })();
          },
        },
      ],
    );
  }
  if (launchPhase === "splash")
    return <BrandArtwork source={SPLASH_ART} label="KRAVIA loading screen" />;
  if (launchPhase === "loading") return <SecureLoadingScreen />;
  if (screen === "welcome")
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.welcomeContent, compactHeight && styles.compactScreen]}>
          <AuthHeader />
          <View style={styles.welcomeMain}>
            <Text style={styles.kicker}>KRAVIA OFFICE</Text>
            <Text style={styles.welcomeTitle}>Your sign-in{`\n`}companion</Text>
            <Text style={styles.body}>
              Sign in with your corporate account to register this phone for KRAVIA Office.
            </Text>
            <View style={styles.welcomeSecurityPanel}>
              <Text style={styles.welcomePanelTitle}>Protected by design</Text>
              <View style={styles.welcomeSecurityRow}>
                <Text style={styles.welcomeSecurityTitle}>Registered email verification</Text>
                <Text style={styles.welcomeSecurityCopy}>Confirm every new phone from your KRAVIA email.</Text>
              </View>
              <View style={styles.welcomeSecurityRow}>
                <Text style={styles.welcomeSecurityTitle}>One trusted phone</Text>
                <Text style={styles.welcomeSecurityCopy}>Trusting a replacement phone signs this one out.</Text>
              </View>
              <AccountStatus label="Managed protection" />
            </View>
            <Text style={styles.welcomeFootnote}>
              No scan. No shared code. Your verification code stays on this phone.
            </Text>
            {message ? <Text style={styles.info}>{message}</Text> : null}
          </View>
          <View style={styles.actionFooter}>
            <Button
              label={trustedDevice ? "Verify and unlock" : "Sign in to KRAVIA Office"}
              onPress={() => {
                setMessage(undefined);
                setScreen("credentials");
              }}
            />
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
            <AppTopBar title="Authenticator" />
            <View style={styles.authIntro}>
              <Text style={styles.kicker}>SIGN IN</Text>
              <Text style={styles.title}>Continue to Authenticator</Text>
              <Text style={styles.body}>
                Use the corporate credentials registered to your KRAVIA Office account.
              </Text>
            </View>
            <View style={styles.formSurface}>
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
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.passwordToggle}
                  disabled={busy}
                >
                  <Text style={styles.passwordToggleText}>{showPassword ? "Hide" : "Show"}</Text>
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
            <AppTopBar title="Authenticator" />
            <Pressable
              accessibilityRole="button"
              onPress={resetToCredentials}
              disabled={busy}
              style={styles.textAction}
            >
              <Text style={styles.backLink}>Use another account</Text>
            </Pressable>
            <View style={styles.authIntro}>
              <Text style={styles.kicker}>EMAIL VERIFICATION</Text>
              <Text style={styles.title}>Confirm it’s you</Text>
              <Text style={styles.body}>
                Enter the six-digit code sent to {emailMask(challenge.email)}.
              </Text>
            </View>
            <View style={styles.otpSurface}>
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
            </View>
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
          <AppTopBar title="Authenticator" />
          <View style={styles.approvalMain}>
            <View style={styles.approvalStatusSurface}>
              <ApprovalPulse expiresAt={pendingDevice.expiresAt} />
              <Text style={styles.kicker}>DEVICE CONFIRMATION</Text>
              <Text style={styles.approvalTitle}>Check your email</Text>
              <Text style={styles.approvalBody}>
                Your credentials are verified. Approve this exact phone from the KRAVIA security email. Authenticator continues automatically after approval.
              </Text>
            </View>
            <View style={styles.approvalDevicePanel}>
              <Text style={styles.approvalDeviceLabel}>DEVICE REQUEST</Text>
              <Text style={styles.approvalDeviceName}>{pendingDevice.deviceLabel}</Text>
              <AccountStatus label="Waiting for an email decision" tone="muted" />
              <Text style={styles.approvalDeviceCopy}>
                Trust approves only this phone. Deny ends this sign-in immediately.
              </Text>
            </View>
            {message ? <Text style={styles.info}>{message}</Text> : null}
          </View>
          <Text style={styles.securityNote}>
            This screen checks securely for your decision. There is nothing else to submit here.
          </Text>
        </View>
      </SafeAreaView>
    );
  if (screen === "locked" && session)
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.lockContent, compactHeight && styles.compactScreen]}>
          <AppTopBar title="Authenticator" />
          <View style={styles.lockMain}>
            <Image source={BRAND_ICON} style={styles.lockMark} />
            <Text style={styles.kicker}>APP LOCKED</Text>
            <Text style={styles.title}>Authenticator is locked</Text>
            <Text style={styles.centerBody}>
              Unlock with your device biometrics to view the current KRAVIA Office code.
            </Text>
            <AccountStatus label={emailMask(session.email)} tone="muted" />
            {message ? <Text style={styles.info}>{message}</Text> : null}
          </View>
          <View style={styles.actionFooter}>
            <Button
              label={unlocking ? "Unlocking…" : "Unlock with biometrics"}
              onPress={() => void unlock()}
              disabled={unlocking}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => void signOut()}
              disabled={unlocking}
              style={styles.textActionCentered}
            >
              <Text style={styles.backLink}>Sign out of this phone</Text>
            </Pressable>
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
          <AppTopBar title="Security centre" actionLabel="Done" onAction={() => setScreen("home")} />
          <View style={styles.settingsHero}>
            <Text style={styles.kicker}>DEVICE PROTECTION</Text>
            <Text style={styles.title}>Your security, on this phone</Text>
            <Text style={styles.body}>Security controls are required for every KRAVIA Office account and cannot be turned off here.</Text>
          </View>
          <Text style={styles.listSectionLabel}>BIOMETRIC UNLOCK</Text>
          <View style={styles.settingsBiometricSurface}>
            <BiometricControl readiness={biometricReadiness} />
            <Text style={styles.settingsBiometricState}>
              {biometricReadiness?.available ? "REQUIRED AND ENABLED" : biometricReadiness ? "ACTION REQUIRED IN DEVICE SETTINGS" : "CHECKING"}
            </Text>
          </View>
          <Text style={styles.listSectionLabel}>ALWAYS ON</Text>
          <View style={styles.settingsGroup}>
            <View style={styles.settingsReadOnlyRow}>
              <View style={styles.settingsRowCopy}>
                <Text style={styles.settingsRowLabel}>Background lock</Text>
                <Text style={styles.settingsRowDetail}>Authenticator locks when it leaves the foreground.</Text>
              </View>
              <AccountStatus label="Enabled" />
            </View>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsReadOnlyRow}>
              <View style={styles.settingsRowCopy}>
                <Text style={styles.settingsRowLabel}>Screen protection</Text>
                <Text style={styles.settingsRowDetail}>The current verification code cannot be copied or captured by this app.</Text>
              </View>
              <AccountStatus label="Enabled" />
            </View>
          </View>
          <Text style={styles.listSectionLabel}>ACCOUNT</Text>
          <View style={styles.settingsGroup}>
            <View style={styles.settingsReadOnlyRow}>
              <View style={styles.settingsRowCopy}>
                <Text style={styles.settingsRowLabel}>Signed-in account</Text>
                <Text style={styles.settingsRowDetail}>{session.email}</Text>
              </View>
              <AccountStatus label="Trusted" />
            </View>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsReadOnlyRow}>
              <View style={styles.settingsRowCopy}>
                <Text style={styles.settingsRowLabel}>Verification session</Text>
                <Text style={styles.settingsRowDetail}>Sign in again in {sessionRemaining(session.expiresAt)}.</Text>
              </View>
            </View>
          </View>
          <Text style={styles.listSectionLabel}>DEVICE</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              label="Sign out"
              detail="Keep this phone registered and sign in again when needed."
              actionLabel="Sign out"
              onPress={() => void signOut()}
            />
            <View style={styles.settingsDivider} />
            <SettingsRow
              label="Remove trusted device"
              detail="A new Trust decision is required before this phone can be used again."
              actionLabel="Remove"
              danger
              onPress={removeTrustedDevice}
            />
          </View>
          <Text style={styles.securityNote}>
            Removing this phone does not remove your Office account.
          </Text>
          <View style={styles.settingsFooter}>
            <Text style={styles.settingsVersion}>Authenticator v{APP_VERSION}</Text>
            <Text style={styles.settingsOperator}>Operated by KRAVIA PRIVATE LIMITED</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  if (screen === "home" && session)
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.homeScreen, compactHeight && styles.compactScreen]}>
          <AppTopBar title="Authenticator" actionLabel="Security" onAction={() => setScreen("settings")} />
          <View style={styles.homeAccountRow}>
            <Image source={BRAND_ICON} style={styles.accountAvatar} />
            <View style={styles.homeAccountCopy}>
              <Text style={styles.homeHeading}>Office account</Text>
              <Text numberOfLines={1} style={styles.homeEmail}>{session.email}</Text>
              <AccountStatus label="This phone is trusted" />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lock Authenticator"
              onPress={() => setScreen("locked")}
              style={styles.lockButton}
            >
              <Text style={styles.lockLink}>Lock</Text>
            </Pressable>
          </View>
          <Text style={styles.listSectionLabel}>ONE-TIME PASSCODE</Text>
          <View style={styles.codeCard}>
            <Text style={styles.codeIssuer}>VERIFICATION CODE</Text>
            <Text style={styles.codeAccount}>Generated locally for secure sign-in.</Text>
            {totp ? (
              <>
                <Text
                  accessibilityLabel={"Current six digit Authenticator code " + totp.code}
                  style={styles.totpCode}
                >
                  {totp.code}
                </Text>
                <View
                  accessible
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={"Authenticator code changes in " + totp.remaining + " seconds"}
                  style={styles.totpTimerRow}
                >
                  <View style={styles.totpTimerRing}>
                    <View
                      style={[
                        styles.totpTimerMarker,
                        {
                          transform: [
                            { rotate: String(Math.round(totp.progress * 360)) + "deg" },
                            { translateY: -27 },
                          ],
                        },
                      ]}
                    />
                    <Text style={styles.totpTimerValue}>
                      {totp.remaining.toString().padStart(2, "0")}
                    </Text>
                  </View>
                  <Text style={styles.totpTimerLabel}>
                    Changes in {totp.remaining} second{totp.remaining === 1 ? "" : "s"}
                  </Text>
                </View>
                <Text style={styles.codeHint}>
                  Enter this code only on the Office sign-in page. It is generated locally and never copied.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.trustedMark}>CODE SETUP NEEDED</Text>
                <Text style={styles.codeHint}>
                  Securely sign in again to finish local code setup for this trusted phone.
                </Text>
              </>
            )}
          </View>
          {message ? <Text style={styles.info}>{message}</Text> : null}
          <View style={styles.homeSecurityNote}>
            <Text style={styles.homeSecurityTitle}>Secure on this device</Text>
            <Text style={styles.homeSecurityCopy}>
              The code stays local. Screen capture and background access remain protected.
            </Text>
          </View>
          {!factor ? (
            <Button
              label="Finish secure setup"
              onPress={() => {
                void (async () => {
                  setBusy(true);
                  setMessage(undefined);
                  try {
                    const enrolledFactor = await enrollAuthenticatorFactor(session);
                    setFactor(enrolledFactor);
                    setMessage("Your local sign-in code is ready.");
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Authenticator code setup could not be completed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              disabled={busy}
            />
          ) : null}
        </View>
      </SafeAreaView>
    );
  return <UnavailableScreen onContinue={resetToCredentials} />;
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
  loadingContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  loadingMark: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  loadingHalo: {
    position: "absolute",
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.primarySoft,
    borderColor: colors.accent,
    borderWidth: 1,
  },
  loadingIcon: { width: 58, height: 58, borderRadius: 15 },
  unavailableContent: {
    flex: 1,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  unavailableMain: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  unavailableMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.semanticErrorSurface,
    borderColor: colors.semanticErrorBorder,
    borderWidth: 1,
  },
  unavailableMarkText: {
    color: colors.semanticError,
    fontFamily: DISPLAY_FONT,
    fontSize: 27,
    fontWeight: "700",
  },
  authScreen: {
    flex: 1,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 14,
  },
  compactScreen: { paddingTop: 8, paddingBottom: 8, gap: 9 },
  authHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 9 },
  headerLogo: { width: 34, height: 34, borderRadius: 8 },
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
  headerAction: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerActionText: {
    color: colors.primary,
    fontFamily: TEXT_FONT,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
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
  welcomeMain: { gap: 14, marginTop: "auto", marginBottom: "auto" },
  actionFooter: { gap: 10, marginTop: "auto" },
  formStack: { gap: 6 },
  authIntro: { gap: 7, marginTop: "auto" },
  formSurface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  otpSurface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
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
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  approvalContentCompact: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  approvalTop: { gap: 10 },
  approvalMain: {
    flex: 1,
    width: "100%",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 12,
  },
  approvalStatusSurface: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8,
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
  approvalTimerMarker: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  approvalTitle: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 29,
    textAlign: "center",
  },
  approvalBody: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 440,
  },
  approvalDevicePanel: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
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
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  homeScreen: {
    flex: 1,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  lockContent: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  lockMain: { alignItems: "center", gap: 12, marginTop: "auto", marginBottom: "auto" },
  lockMark: { width: 62, height: 62, borderRadius: 16, marginBottom: 2 },
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
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 29,
  },
  title: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 29,
  },
  homeHeading: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  body: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 13,
    lineHeight: 19,
  },
  centerBody: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 13,
    lineHeight: 19,
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
  textAction: { alignSelf: "flex-start", minHeight: 30, justifyContent: "center" },
  textActionCentered: { alignSelf: "center", minHeight: 32, justifyContent: "center" },
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
  welcomeSecurityPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  welcomePanelTitle: {
    color: colors.primary,
    fontFamily: DISPLAY_FONT,
    fontSize: 14,
    fontWeight: "800",
  },
  welcomeSecurityRow: { gap: 2 },
  welcomeSecurityTitle: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 13,
    fontWeight: "700",
  },
  welcomeSecurityCopy: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    lineHeight: 17,
  },
  welcomeFootnote: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    lineHeight: 16,
  },
  accountStatusRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.semanticSuccess,
  },
  statusDotMuted: { backgroundColor: colors.accent },
  accountStatusText: {
    color: colors.semanticSuccess,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    fontWeight: "800",
  },
  accountStatusMuted: { color: colors.mutedText },
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
    minHeight: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
    paddingHorizontal: 20,
    fontVariant: ["tabular-nums"],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  homeAccountRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
  },
  accountAvatar: { width: 46, height: 46, borderRadius: 12 },
  homeAccountCopy: { flex: 1, gap: 2, minWidth: 0 },
  homeEmail: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 12,
  },
  lockButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 4 },
  lockLink: {
    color: colors.primary,
    fontFamily: DISPLAY_FONT,
    fontSize: 14,
    fontWeight: "700",
    padding: 10,
  },
  codeCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    gap: 7,
  },
  codeIssuer: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  codeAccount: { color: colors.onPrimaryMuted, fontFamily: TEXT_FONT, fontSize: 12, lineHeight: 17 },
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
    marginTop: 3,
  },
  totpCode: {
    color: colors.onPrimary,
    fontFamily: DISPLAY_FONT,
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: 6,
    lineHeight: 48,
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  totpTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
  },
  totpTimerRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: colors.onPrimaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  totpTimerMarker: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onPrimary,
  },
  totpTimerValue: {
    color: colors.onPrimary,
    fontFamily: DISPLAY_FONT,
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  totpTimerLabel: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    fontWeight: "700",
  },
  homeSecurityNote: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4,
  },
  homeSecurityTitle: {
    color: colors.primary,
    fontFamily: DISPLAY_FONT,
    fontSize: 13,
    fontWeight: "700",
  },
  homeSecurityCopy: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    lineHeight: 16,
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
  appTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
  },
  appTopBarTitle: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  appTopBarAction: {
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 40,
    minWidth: 62,
  },
  appTopBarActionText: {
    color: colors.primary,
    fontFamily: TEXT_FONT,
    fontSize: 13,
    fontWeight: "800",
  },
  appTopBarPlaceholder: { minWidth: 62 },
  settingsHero: {
    backgroundColor: colors.primarySoft,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 6,
  },
  settingsBiometricSurface: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 11,
  },
  biometricControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  biometricControlTitle: {
    color: colors.onPrimary,
    fontFamily: DISPLAY_FONT,
    fontSize: 15,
    fontWeight: "700",
  },
  biometricControlDetail: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    lineHeight: 17,
  },
  biometricToggleTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 3,
    backgroundColor: colors.disabledSurface,
    justifyContent: "center",
  },
  biometricToggleTrackOn: {
    backgroundColor: colors.accent,
    alignItems: "flex-end",
  },
  biometricToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    opacity: 0.75,
  },
  biometricToggleThumbOn: { opacity: 1 },
  settingsBiometricLabel: {
    color: colors.onPrimary,
    fontFamily: DISPLAY_FONT,
    fontSize: 15,
    fontWeight: "700",
  },
  settingsBiometricDetail: {
    color: colors.onPrimaryMuted,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    lineHeight: 17,
  },
  settingsBiometricState: {
    color: colors.onPrimary,
    fontFamily: TEXT_FONT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.05,
  },
  settingsFooter: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    gap: 3,
  },
  settingsVersion: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 11,
  },
  settingsOperator: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  settingsIntro: { gap: 7, marginBottom: 4 },
  listSectionLabel: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.25,
    marginTop: 5,
  },
  settingsGroup: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  settingsReadOnlyRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  settingsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  settingsRowPressed: { backgroundColor: colors.primarySoft },
  settingsRowCopy: { flex: 1, gap: 3 },
  settingsRowLabel: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 13,
    fontWeight: "700",
  },
  settingsRowDetail: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    lineHeight: 16,
  },
  settingsRowAction: {
    color: colors.primary,
    fontFamily: TEXT_FONT,
    fontSize: 12,
    fontWeight: "800",
  },
  settingsRowDanger: { color: colors.semanticError },
  settingsDivider: { height: 1, backgroundColor: colors.border, marginLeft: 14 },
});
