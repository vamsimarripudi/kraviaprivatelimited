import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

const eventInput = z.object({ eventType: z.enum(["SIGNED_IN", "PAGE_VIEWED"]), path: z.string().startsWith("/corporate/").max(300).optional() });

/** Authenticated Corporate Office activity only; no public visitor behaviour is stored here. */
export async function POST(request: Request) {
  try {
    const input = eventInput.parse(await request.json());
    if ((input.eventType === "PAGE_VIEWED") !== Boolean(input.path)) return NextResponse.json({ error: "Invalid activity event." }, { status: 400 });
    const { supabase, user } = await requireAuthenticatedUser();
    const { error } = await supabase.from("corporate_access_events").insert({ actor_id: user.id, event_type: input.eventType, path: input.path ?? null, context: {} });
    if (error) return NextResponse.json({ error: "Activity could not be recorded." }, { status: 409 });
    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Activity could not be recorded." }, { status: 400 });
  }
}
