-- Download evidence is written only by an authenticated user who can already read that document.
-- The document binary remains in the private corporate-private bucket.
create policy "document access audit own download insert" on public.document_access_events
for insert to authenticated
with check (
  actor_id = auth.uid()
  and event_type in ('DOWNLOADED', 'SIGNED_URL_ISSUED')
  and public.can_read_document(document_id)
);
