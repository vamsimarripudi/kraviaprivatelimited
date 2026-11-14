/** RFC 6266 / RFC 5987 response header encoding for private evidence.
 * Filenames are presentation-only, never storage paths. */
export function privateDocumentDisposition(filename:string):string{
 const sanitized=filename.replace(/[\x00-\x1f\x7f/\\]/g,"_").trim().slice(0,180);
 const name=sanitized||"protected-document";
 // Fallback is header-safe ASCII; extended parameter retains UTF-8.
 const fallback=name.normalize("NFKD").replace(/[^\x20-\x7e]/g,"_")
  .replace(/["\\]/g,"_").slice(0,150)||"protected-document";
 const encoded=encodeURIComponent(name).replace(/['()*]/g,char=>
  "%"+char.charCodeAt(0).toString(16).toUpperCase());
 return 'attachment; filename="'+fallback+'"; filename*=UTF-8'+"''"+encoded;
}
