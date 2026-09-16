import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeSessionContext, officeIdentityIsProvisioned, writeOfficeSessionCookies } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const passwordSchema = z.object({
  password: z.string().min(14).max(256)
    .refine((value) => /[a-z]/.test(value), "Lowercase character required")
    .refine((value) => /[A-Z]/.test(value), "Uppercase character required")
    .refine((value) => /\d/.test(value), "Number required")
    .refine((value) => /[^A-Za-z0-9]/.test(value), "Symbol required"),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin Office password change is not allowed" }, { status: 403 });
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) return NextResponse.json({ detail: "Valid Office invitation/session required" }, { status: 401 });
  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Password does not meet KRAVIA Office requirements" }, { status: 400 });

  const { data, error } = await context.client.auth.updateUser({ password: parsed.data.password });
  if (error) return NextResponse.json({ detail: "Unable to set Office password" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (data.user) {
    const current = await context.client.auth.getSession();
    if (current.data.session) await writeOfficeSessionCookies(current.data.session);
  }
  return NextResponse.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
}
