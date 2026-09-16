-- KRAVIA Phase 5B: align specialist content review rules with the application guard.
-- Forward-only. It preserves existing review evidence and enables authorised reviewers
-- to decide an unassigned review in their own domain only.

create or replace function public.content_can_review_domain(p_domain text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[])
    or (p_domain in ('CONTENT','PRODUCT','TECHNOLOGY','CORPORATE') and public.has_active_corporate_role(array['CORPORATE_ADMIN']::public.corporate_role[]))
    or (p_domain in ('CONTENT','TECHNOLOGY','CORPORATE') and public.has_active_corporate_role(array['COMPANY_SECRETARY','CORPORATE_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'PRODUCT' and public.has_active_corporate_role(array['PRODUCT_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'SECURITY' and public.has_active_corporate_role(array['SECURITY_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'PRIVACY' and public.has_active_corporate_role(array['PRIVACY_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'LEGAL' and public.has_active_corporate_role(array['LEGAL_REVIEWER']::public.corporate_role[]))
    or (p_domain = 'CONTENT' and public.has_active_corporate_role(array['PUBLISHER']::public.corporate_role[]));
$$;

revoke all on function public.content_can_review_domain(text) from public;
grant execute on function public.content_can_review_domain(text) to authenticated;

drop policy if exists "content reviews scoped read" on public.content_reviews;
create policy "content reviews scoped read" on public.content_reviews
for select to authenticated
using (
  public.content_can_edit()
  or assigned_to = auth.uid()
  or (assigned_to is null and public.content_can_review_domain(review_domain))
);

drop policy if exists "content reviews assigned reviewer update" on public.content_reviews;
create policy "content reviews assigned reviewer update" on public.content_reviews
for update to authenticated
using (
  (assigned_to = auth.uid() or (assigned_to is null and public.content_can_review_domain(review_domain)))
  and public.content_can_review_domain(review_domain)
)
with check (
  reviewer_id = auth.uid()
  and public.content_can_review_domain(review_domain)
);