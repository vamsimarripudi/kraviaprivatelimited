import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCorporateCapability, CorporateAccessError } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const input = z.object({ title: z.string().trim().min(2).max(180), category: z.string().trim().min(2).max(80), classification: z.enum(["INTERNAL", "CONFIDENTIAL", "HIGHLY_CONFIDENTIAL", "DIRECTORS_ONLY", "PROFESSIONAL_ASSIGNED"]) });

/** Controlled private-vault upload. Files are never written to a public bucket. */
export async function POST(request: Request) {
  try {
    const actor = await requireCorporateCapability("document.upload");
    const form = await request.formData();
    const data = input.parse({ title: form.get("title"), category: form.get("category"), classification: form.get("classification") });
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_SIZE || !allowedMimeTypes.has(file.type)) return NextResponse.json({ error: "Upload a supported PDF, image, Word or Excel file under 20 MB." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const documentId = randomUUID(); const versionId = randomUUID(); const storagePath = `${documentId}/v1.${extension}`;
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Corporate Office is not configured." }, { status: 503 });
    const { error: documentError } = await supabase.from("corporate_documents").insert({ id: documentId, document_type: "CORPORATE_RECORD", title: data.title, category: data.category, classification: data.classification, storage_path: storagePath, created_by: actor.id });
    if (documentError) return NextResponse.json({ error: "The document record could not be created." }, { status: 409 });
    const { error: storageError } = await supabase.storage.from("corporate-private").upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (storageError) return NextResponse.json({ error: "The private document upload could not be completed." }, { status: 409 });
    const { error: versionError } = await supabase.from("document_versions").insert({ id: versionId, document_id: documentId, version: 1, storage_path: storagePath, mime_type: file.type, byte_size: file.size, checksum, uploaded_by: actor.id });
    if (versionError) return NextResponse.json({ error: "The document version could not be recorded." }, { status: 409 });
    const { error: updateError } = await supabase.from("corporate_documents").update({ current_version_id: versionId, checksum }).eq("id", documentId);
    if (updateError) return NextResponse.json({ error: "The document could not be finalised." }, { status: 409 });
    const { error: auditError } = await supabase.rpc("write_audit_event", { p_action: "DOCUMENT_UPLOADED", p_entity_type: "corporate_document", p_entity_id: documentId, p_context: { classification: data.classification, byte_size: file.size } });
    if (auditError) return NextResponse.json({ error: "Upload evidence could not be recorded. The document remains unavailable for further workflow." }, { status: 409 });
    return NextResponse.json({ id: documentId, status: "DRAFT" }, { status: 201 });
  } catch (error) {
    if (error instanceof CorporateAccessError) return NextResponse.json({ error: error.code === "UNAUTHENTICATED" ? "Sign in is required." : "You are not authorised to upload documents." }, { status: error.code === "UNAUTHENTICATED" ? 401 : 403 });
    return NextResponse.json({ error: "The document could not be uploaded." }, { status: 400 });
  }
}
