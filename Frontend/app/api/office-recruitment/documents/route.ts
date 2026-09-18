import { NextResponse } from "next/server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { OfficeRecruitmentError, uploadCandidateDocument } from "@/lib/office/recruitment-server";

export const runtime = "nodejs";
const MAX_BYTES = 26_214_400;

function errorResponse(error: unknown) {
  const status = error instanceof OfficeRecruitmentError ? error.status : 500;
  const detail = error instanceof Error ? error.message : "Unable to upload candidate document";
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin candidate document upload is not allowed" }, { status: 403 });
  }
  try {
    const length = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(length) && length > MAX_BYTES + 1_000_000) {
      return NextResponse.json({ detail: "Candidate document exceeds the upload limit" }, { status: 413 });
    }
    const form = await request.formData();
    const requestId = String(form.get("request_id") || "").trim();
    const sourceReference = String(form.get("source_reference") || "").trim() || undefined;
    const value = form.get("file");
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
      return NextResponse.json({ detail: "Valid candidate document request is required" }, { status: 400 });
    }
    if (!(value instanceof File)) {
      return NextResponse.json({ detail: "Candidate document file is required" }, { status: 400 });
    }
    if (value.size <= 0 || value.size > MAX_BYTES) {
      return NextResponse.json({ detail: "Candidate document must be between 1 byte and 25 MiB" }, { status: 413 });
    }
    const bytes = Buffer.from(await value.arrayBuffer());
    const result = await uploadCandidateDocument({
      requestId,
      fileName: value.name || "candidate-document",
      claimedMime: value.type || "application/octet-stream",
      bytes,
      sourceReference,
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
