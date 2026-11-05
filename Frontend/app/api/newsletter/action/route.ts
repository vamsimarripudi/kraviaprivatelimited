import { NextResponse } from "next/server";
import { z } from "zod";
import { CONSENT_VERSION, sameOrigin, tokenDigest } from "@/lib/public-access/auth";
import { publicAccessSql } from "@/lib/public-access/db";
import { verifyCampaignUnsubscribeToken } from "@/lib/public-access/campaign-tokens";
import { sendPublicMail } from "@/lib/public-access/mail";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({action:z.enum(["confirm","unsubscribe"]),token:z.string().min(40).max(100)}).strict();
export async function POST(request:Request) {
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin."},{status:403});
 const input=schema.safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Invalid action."},{status:400});
 try{
  const sql=publicAccessSql();
  if(input.data.action==="confirm"){
    const hash=tokenDigest("newsletter-confirm",input.data.token);
    const rows=await sql`update public_access.newsletters
      set status='ACTIVE',confirmed_at=now(),confirm_token_hash=null,confirm_expires_at=null
      where confirm_token_hash=${hash} and status='PENDING' and confirm_expires_at>now()
      returning account_id`;
    if(!rows.length)return NextResponse.json({error:"This confirmation link has expired or was already used."},{status:400});
    const id=String(rows[0].account_id);
    await sql`insert into public_access.newsletter_events(account_id,event,source,consent_version)
      values(${id}::uuid,'SUBSCRIBED','EMAIL_CONFIRMATION',${CONSENT_VERSION})`;
    const a=await sql`select email,display_name from public_access.accounts where id=${id}::uuid`;
    if(a[0]) await sendPublicMail({kind:"NEWSLETTER_WELCOME",event_id:`newsletter-welcome:${id}`,
      recipient_email:String(a[0].email),recipient_name:String(a[0].display_name)}).catch(()=>undefined);
    return NextResponse.json({status:"ACTIVE"},{headers:{"Cache-Control":"no-store"}});
  }
  const campaignAccountId=verifyCampaignUnsubscribeToken(input.data.token);
  const rows=campaignAccountId
    ? await sql`update public_access.newsletters
       set status='UNSUBSCRIBED',unsubscribed_at=now(),confirm_token_hash=null,confirm_expires_at=null
       where account_id=${campaignAccountId}::uuid and status<>'UNSUBSCRIBED' returning account_id`
    : await sql`update public_access.newsletters
       set status='UNSUBSCRIBED',unsubscribed_at=now(),confirm_token_hash=null,confirm_expires_at=null
       where unsubscribe_token_hash=${tokenDigest("newsletter-unsubscribe",input.data.token)}
         and status<>'UNSUBSCRIBED' returning account_id`;
  if(!rows.length)return NextResponse.json({status:"UNSUBSCRIBED"},{headers:{"Cache-Control":"no-store"}});
  const id=String(rows[0].account_id);
  await sql`insert into public_access.newsletter_events(account_id,event,source,consent_version)
    values(${id}::uuid,'UNSUBSCRIBED','EMAIL_LINK',${CONSENT_VERSION})`;
  return NextResponse.json({status:"UNSUBSCRIBED"},{headers:{"Cache-Control":"no-store"}});
 }catch {
  return NextResponse.json({error:"We could not process your request."},{status:503});
 }
}
