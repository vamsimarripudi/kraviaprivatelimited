import { NextResponse } from "next/server";
import { getOfficeVaultMyActivity, OfficeVaultAccessError } from "@/lib/office/vault-access-server";

export const dynamic = "force-dynamic";
export async function GET() {
 try {
  return NextResponse.json(await getOfficeVaultMyActivity(), {
   headers: { "Cache-Control": "no-store" },
  });
 } catch (error) {
  return NextResponse.json({
   detail: error instanceof OfficeVaultAccessError ? error.message : "Vault history unavailable",
  }, {
   status: error instanceof OfficeVaultAccessError ? error.status : 500,
   headers: { "Cache-Control": "no-store" },
  });
 }
}
