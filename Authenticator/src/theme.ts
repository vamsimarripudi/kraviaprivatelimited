/**
 * Harbor Reserve is the native Authenticator interface theme.
 *
 * The artwork backdrop intentionally stays separate: it must match the locked
 * splash artwork and Expo splash configuration byte-for-byte.
 */
export const colors = Object.freeze({
  primary: "#102A43",
  accent: "#2F6F9F",
  background: "#F5F7FA",
  surface: "#FFFFFF",
  text: "#16212B",
  onPrimary: "#FFFFFF",

  primaryPressed: "#0B1E31",
  primarySoft: "#E1EAF2",
  primarySoftBorder: "#B9CBDA",
  border: "#D8E2EA",
  borderStrong: "#8EA9BF",
  mutedText: "#52687A",
  placeholder: "#6F8596",
  disabledSurface: "#E6EDF3",
  disabledText: "#718698",
  onPrimaryMuted: "#DCE9F2",
  onPrimaryFaint: "#FFFFFF26",
  accentSoft: "#E6EFF6",
  timerAccent: "#B8893E",
  timerSoft: "#F4E8D5",
  overlay: "#0B1C2CD9",

  semanticSuccess: "#0CA65B",
  semanticError: "#8A302A",
  semanticErrorSurface: "#FFF1F0",
  semanticErrorBorder: "#E8C8C5",

  artworkBackdrop: "#05251C",
} as const);
