-- KRAVIA Connect escalation security / idempotency / source truth.
-- Each fixture test runs in a transaction that is deliberately rolled back.
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000001','ACTIVE'),
 ('00000000-0000-4000-8000-000000000002','ACTIVE'),
 ('00000000-0000-4000-8000-000000000003','ACTIVE'),
 ('00000000-0000-4000-8000-000000000004','PENDING');
insert into public.office_it_service_tickets(id,status,due_at) values
 ('00000000-0000-4000-8000-000000000011','OPEN',now()+interval '4 hours'),
 ('00000000-0000-4000-8000-000000000012','CLOSED',now());

do $$
declare
 v_manager uuid:='00000000-0000-4000-8000-000000000001';
 v_recipient uuid:='00000000-0000-4000-8000-000000000002';
 v_outsider uuid:='00000000-0000-4000-8000-000000000003';
 v_pending uuid:='00000000-0000-4000-8000-000000000004';
 v_ticket uuid:='00000000-0000-4000-8000-000000000011';
 v_closed uuid:='00000000-0000-4000-8000-000000000012';
 v_nonce uuid:='00000000-0000-4000-8000-000000000020';
 v_l2 uuid;v_l3 uuid;v_again uuid;
begin
 if has_table_privilege('authenticated','public.office_chat_it_escalations','SELECT')
 or has_table_privilege('anon','public.office_chat_it_escalation_events','INSERT')
 or has_function_privilege('authenticated','public.office_chat_escalate_it(uuid,uuid,uuid,integer,text,uuid)','EXECUTE')
 then raise exception 'Browser privilege escalation detected'; end if;
 if not (select relrowsecurity from pg_class where oid='public.office_chat_it_escalations'::regclass)
 then raise exception 'Escalation RLS must be active'; end if;
 begin
   perform public.office_chat_escalate_it(v_outsider,v_ticket,v_recipient,2,
    'Unauthorized manager must not create escalations','00000000-0000-4000-8000-000000000024');
   raise exception 'Unauthorized caller created escalation';
 exception when raise_exception then
   if sqlerrm='Unauthorized caller created escalation' then raise; end if;
 end;
 begin
   perform public.office_chat_escalate_it(v_manager,v_ticket,v_outsider,2,
    'Unauthorized recipient should never see source ticket','00000000-0000-4000-8000-000000000025');
   raise exception 'Unauthorized recipient received ticket';
 exception when raise_exception then
   if sqlerrm='Unauthorized recipient received ticket' then raise; end if;
 end;
 begin
   perform public.office_chat_escalate_it(v_manager,v_closed,v_recipient,2,
    'Closed source ticket should not be escalated','00000000-0000-4000-8000-000000000026');
   raise exception 'Closed ticket was escalated';
 exception when raise_exception then
   if sqlerrm='Closed ticket was escalated' then raise; end if;
 end;
 begin
   perform public.office_chat_escalate_it(v_manager,v_ticket,v_pending,2,
    'Pending recipient is not active','00000000-0000-4000-8000-000000000027');
   raise exception 'Inactive recipient accepted';
 exception when raise_exception then
   if sqlerrm='Inactive recipient accepted' then raise; end if;
 end;
 v_l2:=public.office_chat_escalate_it(v_manager,v_ticket,v_recipient,2,
  'Escalate unresolved office connectivity impact',v_nonce);
 v_again:=public.office_chat_escalate_it(v_manager,v_ticket,v_recipient,2,
  'Escalate unresolved office connectivity impact',v_nonce);
 if v_l2<>v_again then raise exception 'Duplicate request created another escalation'; end if;
 if (select count(*) from public.office_chat_it_escalations where ticket_id=v_ticket)<>1
 then raise exception 'Idempotency did not prevent duplicate row'; end if;
 if (select count(*) from public.office_chat_it_escalation_events where escalation_id=v_l2 and event_type='CREATED')<>1
 then raise exception 'Created escalation event not unique'; end if;
 begin
   perform public.office_chat_ack_it_escalation(v_outsider,v_l2,'I was not assigned');
   raise exception 'Outsider acknowledged escalation';
 exception when raise_exception then
   if sqlerrm='Outsider acknowledged escalation' then raise; end if;
 end;
 if not public.office_chat_ack_it_escalation(v_recipient,v_l2,'Accepted for investigation') then
   raise exception 'Assigned eligible recipient could not acknowledge'; end if;
 begin
   perform public.office_chat_ack_it_escalation(v_recipient,v_l2,'Duplicate ack');
   raise exception 'Acknowledgement replay accepted';
 exception when raise_exception then
   if sqlerrm='Acknowledgement replay accepted' then raise; end if;
 end;
 v_l3:=public.office_chat_escalate_it(v_manager,v_ticket,v_recipient,3,
  'Additional authorized escalation due to ongoing incident',
  '00000000-0000-4000-8000-000000000021');
 if v_l3=v_l2 or not exists(select 1 from public.office_chat_it_escalations
    where id=v_l2 and status='ESCALATED') then
   raise exception 'Ordered escalation transition failed'; end if;
 begin
   perform public.office_chat_escalate_it(v_manager,v_ticket,v_recipient,2,
     'Cannot regress escalation to lower stage','00000000-0000-4000-8000-000000000022');
   raise exception 'Escalation level rolled backward';
 exception when raise_exception then
   if sqlerrm='Escalation level rolled backward' then raise; end if;
 end;
 begin
   perform public.office_chat_resolve_it_escalation(v_recipient,v_l3,
     'Recipient lacks source management authority');
   raise exception 'Unauthorized closure permitted';
 exception when raise_exception then
   if sqlerrm='Unauthorized closure permitted' then raise; end if;
 end;
 if not public.office_chat_resolve_it_escalation(v_manager,v_l3,
  'Incident coordination completed independently of source ticket') then
   raise exception 'Authorized escalation closure failed'; end if;
 if (select status from public.office_it_service_tickets where id=v_ticket)<>'OPEN'
 then raise exception 'Escalation incorrectly resolved the canonical ticket'; end if;
 if (select count(*) from public.office_chat_it_escalation_events
     where escalation_id in (v_l2,v_l3))<4 then
   raise exception 'Immutable escalation events missing'; end if;
end;
$$;
rollback;
