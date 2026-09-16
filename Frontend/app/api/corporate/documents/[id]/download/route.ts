import { NextResponse } from "next/server";
import { requireCorporateCapability, CorporateAccessError } from "@/lib/corporate/authorization";
import { safeDocumentFilename } from "@/lib/corporate/document-download";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Documents are streamed only after an authenticated, RLS-authorised server read.
 * Do not replace this with a public object URL or a long-lived signed URL.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireCorporateCapability("document.download");
    const { id } = await params;
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Corporate Office is not configured." }, { status: 503 });
    const { data: document, error: documentError } = await supabase.from("corporate_documents").select("id,current_version_id").eq("id", id).maybeSingle();
    if (documentError || !document?.current_version_id) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { data: version, error: versionError } = await supabase.from("document_versions").select("storage_path,mime_type").eq("id", document.current_version_id).maybeSingle();
    if (versionError || !version) return NextResponse.json({ error: "Document version is unavailable." }, { status: 404 });
    const { data: blob, error: storageError } = await supabase.storage.from("corporate-private").download(version.storage_path);
    if (storageError || !blob) return NextResponse.json({ error: "Document download is unavailable." }, { status: 404 });
    const { error: auditError } = await supabase.from("document_access_events").insert({ document_id: id, actor_id: actor.id, event_type: "DOWNLOADED", context: { aal: actor.aal, delivery: "authenticated_proxy" } });
    if (auditError) return NextResponse.json({ error: "Download evidence could not be recorded. The document was not released." }, { status: 409 });
    const body = await blob.arrayBuffer();
    return new NextResponse(body, { status: 200, headers: {
      "Content-Type": version.mime_type,
      "Content-Disposition": `attachment; filename="${safeDocumentFilename(id, version.mime_type)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof CorporateAccessError) return NextResponse.json({ error: error.code === "UNAUTHENTICATED" ? "Sign in is required to download this document." : "You are not authorised to download this document." }, { status: error.code === "UNAUTHENTICATED" ? 401 : 403 });
    return NextResponse.json({ error: "Document download could not be completed." }, { status: 500 });
  }
}
