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
              { transform: [{ rotate: rotation }, { translateY: -36 }] },
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
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);
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
          setScreen("locked");
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
        setScreen("locked");
        setMessage("Email verified. This trusted device is ready to unlock.");
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
        <View style={styles.welcomeContent}>
          <Image source={BRAND_ICON} style={styles.welcomeLogo} />
          <Text style={styles.kicker}>KRAVIA OFFICE</Text>
          <Text style={styles.welcomeTitle}>Welcome to{`\n`}Authenticator</Text>
          <Text style={styles.body}>
            Verify your registered corporate email to use this phone as your
            protected KRAVIA sign-in device.
          </Text>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>One trusted device</Text>
            <Text style={styles.panelCopy}>
              Your password and email code verify you. A Trust decision from
              your registered mailbox locks your account to this exact device;
              ignoring the email signs it out immediately.
            </Text>
          </View>
          {message ? <Text style={styles.info}>{message}</Text> : null}
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
      </SafeAreaView>
    );
  if (screen === "credentials")
    return (
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMessage(undefined);
                setScreen("welcome");
              }}
            >
              <Text style={styles.backLink}>‹ Back</Text>
            </Pressable>
            <Image source={BRAND_ICON} style={styles.logo} />
            <Text style={styles.kicker}>KRAVIA OFFICE</Text>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.body}>
              Use the corporate credentials registered to your Office account.
            </Text>
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
              >
                <Text style={styles.passwordToggleText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Button
              label={busy ? "Checking credentials…" : "Continue"}
              onPress={() => void beginEmailVerification()}
              disabled={busy}
            />
            <Text style={styles.securityNote}>
              Your password is never stored on this phone.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  if (screen === "otp" && challenge)
    return (
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
          >
            <Pressable
              accessibilityRole="button"
              onPress={resetToCredentials}
              disabled={busy}
            >
              <Text style={styles.backLink}>‹ Use another account</Text>
            </Pressable>
            <Image source={BRAND_ICON} style={styles.logo} />
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
            />
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
                      ? `Resend available in ${clockLabel(resendRemaining)}`
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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  if (screen === "approval" && pendingDevice)
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.approvalContent}>
          <Image source={BRAND_ICON} style={styles.logo} />
          <Text style={styles.kicker}>DEVICE PROTECTION</Text>
          <Text style={styles.title}>Confirm from your email</Text>
          <Text style={styles.body}>
            Your credentials and email code are verified. Open the security
            review in your registered mailbox to trust or block this device.
          </Text>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{pendingDevice.deviceLabel}</Text>
            <Text style={styles.panelCopy}>
              This app checks the protected KRAVIA status and continues
              automatically as soon as the account owner trusts this exact device.
            </Text>
          </View>
          {message ? <Text style={styles.info}>{message}</Text> : null}
          <Text style={styles.securityNote}>
            The email page never signs in the browser or phone that opens it.
          </Text>
        </View>
      </SafeAreaView>
    );
  if (screen === "locked" && session)
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.lockContent}>
          <Image source={BRAND_ICON} style={styles.logo} />
          <Text style={styles.kicker}>KRAVIA AUTHENTICATOR</Text>
          <Text style={styles.title}>This device is trusted</Text>
          <Text style={styles.centerBody}>
            Unlock with your device biometrics to view your KRAVIA security
            status. The app locks when it leaves the foreground.
          </Text>
          {message ? <Text style={styles.info}>{message}</Text> : null}
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
          >
            <Text style={styles.backLink}>‹ Back</Text>
          </Pressable>
          <Image source={BRAND_ICON} style={styles.logo} />
          <Text style={styles.kicker}>AUTHENTICATOR</Text>
          <Text style={styles.title}>Security</Text>
          <View style={styles.accountPanel}>
            <Text style={styles.accountEyebrow}>TRUSTED DEVICE</Text>
            <Text style={styles.accountName}>KRAVIA Office</Text>
            <Text style={styles.accountEmail}>{session.email}</Text>
            <Text style={styles.accountStatus}>● Registered to this phone</Text>
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
          <View style={styles.topRow}>
            <View>
              <Text style={styles.kicker}>AUTHENTICATOR</Text>
              <Text style={styles.homeHeading}>Device security</Text>
            </View>
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
            <Text style={styles.trustedMark}>✓</Text>
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
  welcomeContent: {
    flex: 1,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  approvalContent: {
    flex: 1,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
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
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  welcomeLogo: { width: 64, height: 64, borderRadius: 18, marginBottom: 4 },
  logo: { width: 48, height: 48, borderRadius: 14, marginTop: 2 },
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
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1.2,
    lineHeight: 37,
  },
  title: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.9,
    lineHeight: 35,
  },
  homeHeading: {
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
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
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 6,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
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
    fontSize: 13,
    lineHeight: 19,
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
    minHeight: 50,
    borderRadius: 12,
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
    marginTop: 4,
  },
  input: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: TEXT_FONT,
    fontSize: 15,
  },
  passwordField: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: TEXT_FONT,
    fontSize: 15,
  },
  passwordToggle: {
    paddingHorizontal: 14,
    minHeight: 48,
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
    borderRadius: 12,
    padding: 12,
    lineHeight: 19,
  },
  securityNote: {
    color: colors.mutedText,
    fontFamily: TEXT_FONT,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 2,
  },
  timerWrap: { alignItems: "center", marginVertical: 2 },
  timerTrack: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
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
    fontSize: 22,
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
    minHeight: 54,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    color: colors.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 9,
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
    borderRadius: 22,
    padding: 23,
    gap: 8,
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
    color: colors.onPrimary,
    fontFamily: DISPLAY_FONT,
    fontSize: 52,
    fontWeight: "700",
    marginTop: 5,
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
    borderRadius: 20,
    padding: 20,
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
