-- KRAVIA Finance — corporate card spend-policy enforcement.
-- Merchant-category and monthly-limit controls are enforced server-side before approval.

create or replace function public.office_card_spend_request(
 p_actor uuid,p_card uuid,p_purpose text,p_category text,p_amount bigint,p_currency text,p_project text,p_expense text,p_needed timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.office_corporate_cards%rowtype; v_id uuid; category text:=upper(trim(coalesce(p_category,'')));
begin
 if not public.office_effective_permission(p_actor,'finance.card.spend.request','OWN',p_actor::text,null) then
   raise exception 'Corporate-card spend request permission is required';
 end if;
 select * into c from public.office_corporate_cards
 where id=p_card and cardholder_user_id=p_actor and status='ACTIVE';
 if c.id is null then raise exception 'Active assigned corporate card is required'; end if;
 if upper(trim(p_currency))<>c.currency then raise exception 'Spend request currency must match card currency'; end if;
 if c.per_transaction_limit_minor is not null and p_amount>c.per_transaction_limit_minor then
   raise exception 'Requested amount exceeds card per-transaction limit';
 end if;
 if jsonb_array_length(c.allowed_merchant_categories)>0 then
   if category='' then raise exception 'Merchant category is required for this card'; end if;
   if not exists(
     select 1 from jsonb_array_elements_text(c.allowed_merchant_categories) x(value)
     where upper(trim(x.value))=category
   ) then raise exception 'Merchant category is outside the approved card policy';
   end if;
 end if;
 insert into public.office_card_spend_requests(
   card_id,requester_user_id,merchant_or_purpose,merchant_category,amount_minor,currency,
   project_reference,expense_reference,needed_by
 )
 values(
   c.id,p_actor,trim(p_purpose),nullif(category,''),p_amount,c.currency,
   nullif(trim(coalesce(p_project,'')),''),nullif(trim(coalesce(p_expense,'')),''),p_needed
 )
 returning id into v_id;
 insert into public.office_card_events(actor_user_id,card_id,spend_request_id,event_type,new_status)
 values(p_actor,c.id,v_id,'CARD_SPEND_REQUESTED','REQUESTED');
 return v_id;
end;
$$;

create or replace function public.office_card_spend_review(
 p_actor uuid,p_request uuid,p_status text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare
 r public.office_card_spend_requests%rowtype;
 c public.office_corporate_cards%rowtype;
 target text:=upper(trim(p_status));
 dept text;
 month_start timestamptz;
 month_end timestamptz;
 committed bigint;
begin
 select * into r from public.office_card_spend_requests where id=p_request for update;
 if r.id is null or r.status<>'REQUESTED' then raise exception 'Requested card spend is required'; end if;
 select * into c from public.office_corporate_cards where id=r.card_id for update;
 dept:=c.department_code;
 if not public.office_effective_permission(p_actor,'finance.card.spend.review','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'finance.card.spend.review','DEPARTMENT',dept,null) then
   raise exception 'Card-spend review permission is required';
 end if;
 if p_actor=r.requester_user_id then raise exception 'Requester cannot approve their own card spend'; end if;
 if target not in ('APPROVED','REJECTED') then raise exception 'Invalid card-spend decision'; end if;

 if target='APPROVED' and c.monthly_limit_minor is not null then
   month_start:=date_trunc('month',coalesce(r.needed_by,r.created_at));
   month_end:=month_start+interval '1 month';
   select coalesce(sum(x.amount_minor),0) into committed
   from public.office_card_spend_requests x
   where x.card_id=c.id
     and x.id<>r.id
     and x.status in ('APPROVED','USED')
     and coalesce(x.needed_by,x.created_at)>=month_start
     and coalesce(x.needed_by,x.created_at)<month_end;
   if committed+r.amount_minor>c.monthly_limit_minor then
     raise exception 'Approval would exceed the corporate card monthly limit';
   end if;
 end if;

 update public.office_card_spend_requests
 set status=target,reviewer_user_id=p_actor,reviewed_at=now(),
     review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now()
 where id=r.id;
 insert into public.office_card_events(
   actor_user_id,card_id,spend_request_id,event_type,previous_status,new_status,note,metadata
 )
 values(
   p_actor,r.card_id,r.id,'CARD_SPEND_REVIEW',r.status,target,left(p_note,2000),
   jsonb_build_object('monthly_committed_before',coalesce(committed,0),'request_amount_minor',r.amount_minor)
 );
 return target;
end;
$$;

revoke all on function public.office_card_spend_request(uuid,uuid,text,text,bigint,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_card_spend_review(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.office_card_spend_request(uuid,uuid,text,text,bigint,text,text,text,timestamptz) to service_role;
grant execute on function public.office_card_spend_review(uuid,uuid,text,text) to service_role;
