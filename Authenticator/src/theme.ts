/**
 * Midnight Sapphire is the native Authenticator interface theme.
 *
 * The artwork backdrop intentionally stays separate: it must match the locked
 * splash artwork and Expo splash configuration byte-for-byte.
 */
export const colors = Object.freeze({
  primary: "#193B5B",
  accent: "#5D809D",
  background: "#EFF3F7",
  surface: "#FFFFFF",
  text: "#172331",
  onPrimary: "#FFFFFF",

  primaryPressed: "#112E47",
  primarySoft: "#E1EAF1",
  primarySoftBorder: "#C7D5E1",
  border: "#D7E1E9",
  borderStrong: "#AABCCC",
  mutedText: "#516477",
  placeholder: "#73879A",
  disabledSurface: "#E3EAF0",
  disabledText: "#788A99",
  onPrimaryMuted: "#DCE7EF",
  onPrimaryFaint: "#FFFFFF29",
  accentSoft: "#E3EBF2",

  semanticSuccess: "#0CA65B",
  semanticError: "#8A302A",
  semanticErrorSurface: "#FFF1F0",
  semanticErrorBorder: "#E8C8C5",

  artworkBackdrop: "#05251C",
} as const);
