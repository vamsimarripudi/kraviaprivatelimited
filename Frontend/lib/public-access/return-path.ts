/** Pure redirect allowlist shared by both public server and page code. */
export function safePublicReturnPath(input: string | undefined | null): string {
  if (typeof input !== "string" || input.length > 240 || !input.startsWith("/") ||
    input.startsWith("//") || input.includes("\\") || /[\u0000-\u001f]/.test(input)) return "/resources";
  if (input === "/resources" || input === "/account") return input;
  return /^\/api\/public-resources\/[a-z0-9][a-z0-9-]{2,79}\/download$/.test(input) ? input : "/resources";
}
