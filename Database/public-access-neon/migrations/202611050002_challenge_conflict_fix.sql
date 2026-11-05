-- Fix PL/pgSQL RETURNS TABLE(email,account_id) ambiguity in ON CONFLICT targets.
-- Additive correction; preserves existing records, sessions and consent decisions.
-- Tested with rollback-only synthetic signup challenge in Neon PostgreSQL 17.
BEGIN;
CREATE OR REPLACE FUNCTION public_access.complete_challenge(p_id uuid, p_hash text, p_session_hash text, p_confirm_hash text, p_unsub_hash text, p_consent_version text)
 RETURNS TABLE(account_id uuid, email text, display_name text, new_account boolean, newsletter_pending boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public_access', 'pg_temp'
AS $function$
declare v_challenge public_access.email_challenges%rowtype;
 v_id uuid; v_created boolean:=false; v_pending boolean:=false; v_state text;
begin
 if p_hash !~ '^[a-f0-9]{64}$' or p_session_hash !~ '^[a-f0-9]{64}$' or
 p_confirm_hash !~ '^[a-f0-9]{64}$' or p_unsub_hash !~ '^[a-f0-9]{64}$' then return; end if;
 select * into v_challenge from public_access.email_challenges where id=p_id for update;
 if not found or v_challenge.consumed_at is not null or v_challenge.expires_at < now() or v_challenge.attempt_count >= 5 then return; end if;
 update public_access.email_challenges set attempt_count=attempt_count+1 where id=p_id;
 if v_challenge.code_hash != p_hash then return; end if;
 update public_access.email_challenges set consumed_at=now() where id=p_id;
 insert into public_access.accounts(email,display_name) values(v_challenge.email,v_challenge.display_name)
 on conflict on constraint accounts_email_key do nothing returning id into v_id;
 if v_id is not null then v_created:=true;
 else select a.id into v_id from public_access.accounts a where a.email=v_challenge.email and a.status='ACTIVE'; end if;
 if v_id is null then return; end if;
 insert into public_access.sessions(token_hash,account_id,expires_at)
 values(p_session_hash,v_id,now()+interval '30 days');
 if v_challenge.marketing_requested then
  insert into public_access.newsletters(account_id,status,consent_version,consent_source,confirm_token_hash,confirm_expires_at,unsubscribe_token_hash)
  values(v_id,'PENDING',p_consent_version,'PUBLIC_ACCOUNT_FORM',p_confirm_hash,now()+interval '48 hours',p_unsub_hash)
  on conflict on constraint newsletters_pkey do update set status='PENDING',consent_version=excluded.consent_version,
   consent_source=excluded.consent_source,requested_at=now(),confirm_token_hash=excluded.confirm_token_hash,
   confirm_expires_at=excluded.confirm_expires_at,unsubscribe_token_hash=excluded.unsubscribe_token_hash,
   unsubscribed_at=null where public_access.newsletters.status <> 'ACTIVE';
  select n.status into v_state from public_access.newsletters n where n.account_id=v_id;
  v_pending:=v_state='PENDING';
  if v_pending then insert into public_access.newsletter_events(account_id,event,source,consent_version)
   values(v_id,'CONSENT_REQUESTED','PUBLIC_ACCOUNT_FORM',p_consent_version); end if;
 end if;
 return query select v_id,a.email,a.display_name,v_created,v_pending from public_access.accounts a where a.id=v_id;
end;
$function$;
COMMIT;
