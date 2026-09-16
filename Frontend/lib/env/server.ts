import "server-only";
import { z } from "zod";
import { getPublicSupabaseEnvironment } from "@/lib/env/public";

const serverEnvironmentSchema = z.object({ SUPABASE_SECRET_KEY: z.string().min(1) });
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(): ServerEnvironment | null {
  const result = serverEnvironmentSchema.safeParse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined });
  return result.success ? result.data : null;
}

export function getSupabaseAdminEnvironment() {
  const publicEnvironment = getPublicSupabaseEnvironment();
  const serverEnvironment = getServerEnvironment();
  if (!publicEnvironment || !serverEnvironment) return null;
  return { ...publicEnvironment, ...serverEnvironment };
}
