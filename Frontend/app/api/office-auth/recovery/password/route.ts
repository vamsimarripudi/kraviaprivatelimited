import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeSessionContext, officeIdentityIsProvisioned, officeRecoveryIsVerified, signOutOffice } from "@/lib/office/auth-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

const passwordSchema = z.object({
  password: z.string().min(14).max(256)
    .refine((value) => /[a-z]/.test(value), "Lowercase character required")
    .refine((value) => /[A-Z]/.test(value), "Uppercase character required")
    .refine((value) => /\d/.test(value), "Number required")
    .refine((value) => /[^A-Za-z0-9]/.test(value), "Symbol required"),
});

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin request rejected" }, { status: 403 });
  }

  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) {
    return NextResponse.json({ detail: "Valid Office recovery session required" }, { status: 401 });
  }
  if (!(await officeRecoveryIsVerified(context.identity.userId))) {
    return NextResponse.json({ detail: "Recovery authorization expired. Request a new recovery link." }, { status: 401 });
  }

  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues[0]?.message ?? "Password policy not satisfied" }, { status: 422 });
  }

  const { error } = await context.client.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return NextResponse.json({ detail: "Password update failed" }, { status: 400 });
  }

  await signOutOffice(context, "global");
  return NextResponse.json(
    { updated: true, signed_out: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
