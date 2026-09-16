const mimeExtensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export function documentDownloadPath(documentId: string) { return `/api/corporate/documents/${documentId}/download`; }
export function safeDocumentFilename(documentId: string, mimeType: string) {
  const extension = mimeExtensions[mimeType] ?? "bin";
  return `KRAVIA_Corporate_Document_${documentId}.${extension}`;
}
