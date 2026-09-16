/**
 * Canonical location for generated Supabase types. Generate after linking the
 * intended project: npx supabase gen types typescript --project-id <project-id> > lib/supabase/types.ts
 * Do not hand-maintain a large schema type map here.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
