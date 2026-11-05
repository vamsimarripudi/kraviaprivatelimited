import { NextResponse } from "next/server";
import { z } from "zod";
import { CONSENT_VERSION, currentPublicAccount, issueNewsletterToken, issueUnsubscribeToken, sameOrigin } from "@/lib/public-access/auth";
import { publicAccessSql } from "@/lib/public-access/db";
import { sendPublicMail } from "@/lib/public-access/mail";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({subscribe:z.boolean()}).strict();
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin."},{status:403});
 const input=schema.safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Invalid preference."},{status:400});
 const account=await currentPublicAccount();
 if(!account)return NextResponse.json({error:"Sign in is required."},{status:401});
 try{
  const sql=publicAccessSql();
  if(input.data.subscribe){
    if(account.newsletterStatus==="ACTIVE")return NextResponse.json({status:"ACTIVE"});
    const c=issueNewsletterToken(),u=issueUnsubscribeToken();
    await sql`insert into public_access.newsletters(
      account_id,status,consent_version,consent_source,confirm_token_hash,confirm_expires_at,unsubscribe_token_hash
    ) values(${account.id}::uuid,'PENDING',${CONSENT_VERSION},'ACCOUNT_PREFERENCES',
      ${c.hash},now()+interval '48 hours',${u.hash})
    on conflict(account_id) do update set
      status='PENDING',consent_version=excluded.consent_version,consent_source=excluded.consent_source,
      requested_at=now(),confirm_token_hash=excluded.confirm_token_hash,
      confirm_expires_at=excluded.confirm_expires_at,unsubscribe_token_hash=excluded.unsubscribe_token_hash,
      unsubscribed_at=null`;
    await sql`insert into public_access.newsletter_events(account_id,event,source,consent_version)
       values(${account.id}::uuid,'CONSENT_REQUESTED','ACCOUNT_PREFERENCES',${CONSENT_VERSION})`;
    await sendPublicMail({kind:"NEWSLETTER_CONFIRM",event_id:`newsletter-preferences:${c.hash}`,
      recipient_email:account.email,recipient_name:account.displayName,
      action_url:`https://www.kraviaprivatelimited.com/newsletter/confirm?token=${encodeURIComponent(c.token)}`});
    return NextResponse.json({status:"PENDING"},{headers:{"Cache-Control":"no-store"}});
  }
  const rows=await sql`update public_access.newsletters set status='UNSUBSCRIBED',
   confirm_token_hash=null,confirm_expires_at=null,unsubscribed_at=now()
   where account_id=${account.id}::uuid and status<>'UNSUBSCRIBED' returning account_id`;
  if(rows.length){
    await sql`insert into public_access.newsletter_events(account_id,event,source,consent_version)
      values(${account.id}::uuid,'UNSUBSCRIBED','ACCOUNT_PREFERENCES',${CONSENT_VERSION})`;
    await sendPublicMail({kind:"NEWSLETTER_UNSUBSCRIBED",event_id:`newsletter-unsub:${account.id}:${Date.now()}`,
      recipient_email:account.email,recipient_name:account.displayName}).catch(()=>undefined);
  }
  return NextResponse.json({status:"UNSUBSCRIBED"},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({error:"Newsletter preferences could not be updated."},{status:503});
 }
}
