import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { sameOrigin } from "@/lib/public-access/auth";
import { requireResourceOwner } from "@/lib/public-access/owner";
import { publicAccessSql } from "@/lib/public-access/db";
import { sendPublicMail } from "@/lib/public-access/mail";
import { makeCampaignUnsubscribeToken } from "@/lib/public-access/campaign-tokens";
import { remainingDailyAttempts, canMarkCampaignSent } from "@/lib/public-access/campaign-state";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
const headers={"Cache-Control":"private, no-store"} as const;
const draftSchema=z.object({
  action:z.literal("DRAFT"),
  subject:z.string().trim().min(5).max(180),
  body:z.string().trim().min(20).max(5000),
}).strict();
const decisionSchema=z.object({
  action:z.enum(["APPROVE","CANCEL","SEND_BATCH"]),
  campaignId:z.uuid(),
}).strict();
function unavailable(){
  const missingPublicDatabase = !process.env.KRAVIA_PUBLIC_ACCESS_DATABASE_URL?.trim();
  return NextResponse.json({
    error: missingPublicDatabase
      ? "Newsletter drafts require a separate public-access database. Configure KRAVIA_PUBLIC_ACCESS_DATABASE_URL in the website deployment before publishing."
      : "Newsletter service could not read the public-access database. Verify the public_access schema, database credentials and service health.",
    status: missingPublicDatabase ? "NEEDS_CONFIGURATION" : "SERVICE_ERROR",
  },{status:503,headers});
}
async function ownerOnly(){try{return await requireResourceOwner();}catch{return null;}}
export async function GET(){
  const owner=await ownerOnly();
  if(!owner)return NextResponse.json({error:"Office owner MFA required."},{status:403,headers});
  try{
    const sql=publicAccessSql();
    const [campaigns,subscribers]=await Promise.all([
      sql`select c.id,c.subject,c.body_text,c.status,c.created_by,c.approved_by,
        c.created_at,c.approved_at,
        count(d.account_id)::int as total,
        count(d.account_id) filter (where d.state='SUBMITTED')::int as submitted,
        count(d.account_id) filter (where d.state='UNKNOWN')::int as unknown,
        count(d.account_id) filter (where d.state='SUPPRESSED')::int as suppressed,
        count(d.account_id) filter (where d.state='PENDING')::int as pending
        from public_access.campaigns c left join public_access.campaign_deliveries d on d.campaign_id=c.id
        group by c.id order by c.created_at desc limit 35`,
      sql`select count(*)::int as count
        from public_access.newsletters n join public_access.accounts a on a.id=n.account_id
        where n.status='ACTIVE' and a.status='ACTIVE'`,
    ]);
    return NextResponse.json({campaigns,confirmedSubscribers:Number(subscribers[0]?.count||0),
      sendingEnabled:process.env.KRAVIA_NEWSLETTER_SENDING_ENABLED==="true"},{headers});
  }catch{return unavailable();}
}

export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request)||!sameOrigin(request))
    return NextResponse.json({error:"Invalid request origin."},{status:403,headers});
  const owner=await ownerOnly();
  if(!owner)return NextResponse.json({error:"Office owner MFA required."},{status:403,headers});
  const data=await request.json().catch(()=>null);
  const draft=draftSchema.safeParse(data);
  const decision=decisionSchema.safeParse(data);
  if(!draft.success&&!decision.success)
    return NextResponse.json({error:"Invalid newsletter operation."},{status:400,headers});
  try{
    const sql=publicAccessSql();
    if(draft.success){
      const {subject,body}=draft.data;
      if(Buffer.byteLength(JSON.stringify(body),"utf8")>4_800)
        return NextResponse.json({error:"Newsletter content is too large for safe email delivery."},{status:400,headers});
      const rows=await sql`insert into public_access.campaigns(subject,body_text,status,created_by)
        values(${subject},${body},'DRAFT',${owner.userId})
        returning id,status`;
      return NextResponse.json({id:rows[0]?.id,status:"DRAFT"}, {status:201,headers});
    }
    if(!decision.success)return NextResponse.json({error:"Invalid campaign decision."},{status:400,headers});
    const {campaignId,action}=decision.data;
    if(action==="APPROVE"){
      const updated=await sql`update public_access.campaigns
        set status='APPROVED',approved_by=${owner.userId},approved_at=now()
        where id=${campaignId}::uuid and status='DRAFT'
        returning id,status`;
      if(!updated.length)return NextResponse.json({error:"Only drafts can be approved."},{status:409,headers});
      return NextResponse.json({id:campaignId,status:"APPROVED"},{headers});
    }
    if(action==="CANCEL"){
      const updated=await sql`update public_access.campaigns set status='CANCELLED'
        where id=${campaignId}::uuid and status in ('DRAFT','APPROVED')
        returning id,status`;
      if(!updated.length)return NextResponse.json({error:"Cannot cancel a campaign already sending or completed."},{status:409,headers});
      return NextResponse.json({id:campaignId,status:"CANCELLED"},{headers});
    }
    if(process.env.KRAVIA_NEWSLETTER_SENDING_ENABLED!=="true")
      return NextResponse.json({error:"Newsletter sending is disabled until delivery configuration and approval checks are complete."},{status:503,headers});
    const campaigns=await sql`select id,subject,body_text,status from public_access.campaigns
      where id=${campaignId}::uuid and status in ('APPROVED','SENDING') limit 1`;
    const campaign=campaigns[0];
    if(!campaign)return NextResponse.json({error:"Only approved campaigns can be delivered."},{status:409,headers});
    if(Buffer.byteLength(JSON.stringify(String(campaign.body_text)),"utf8")>4_800)
      return NextResponse.json({error:"This campaign exceeds the validated email size limit. Cancel and create a shorter issue."},{status:422,headers});
    // Count reserved-but-unconfirmed sends too: UNKNOWN is never free quota.
    const daily=await sql`select count(*)::int as attempts
      from public_access.campaign_deliveries
      where state in ('SUBMITTED','UNKNOWN')
        and submitted_at>now()-interval '24 hours'`;
    const remaining=remainingDailyAttempts(Number(daily[0]?.attempts||0));
    if(remaining===0)return NextResponse.json({error:"Newsletter safety cap reached (80 per rolling 24 hours). No further sends."},{status:429,headers});
    if(campaign.status==="APPROVED"){
      // One-time audience snapshot. Future sign-ups are not appended to an already sending issue.
      await sql`insert into public_access.campaign_deliveries(campaign_id,account_id,state)
        select ${campaignId}::uuid,n.account_id,'PENDING'
        from public_access.newsletters n join public_access.accounts a on a.id=n.account_id
        where n.status='ACTIVE' and a.status='ACTIVE'
        on conflict(campaign_id,account_id) do nothing`;
      await sql`update public_access.campaigns set status='SENDING'
        where id=${campaignId}::uuid and status='APPROVED'`;
    }
    // Consent withdrawals remain authoritative over the previously captured audience.
    await sql`update public_access.campaign_deliveries d set state='SUPPRESSED'
      where d.campaign_id=${campaignId}::uuid and d.state='PENDING'
      and not exists (
        select 1 from public_access.newsletters n join public_access.accounts a on a.id=n.account_id
        where n.account_id=d.account_id and n.status='ACTIVE' and a.status='ACTIVE')`;
    const batchSize=Math.min(10,remaining);
    // Transition to UNKNOWN before the provider call; a process crash must never cause a duplicate send.
    const reserved=await sql`with chosen as (
       select d.account_id from public_access.campaign_deliveries d
       join public_access.newsletters n on n.account_id=d.account_id
       join public_access.accounts a on a.id=d.account_id
       where d.campaign_id=${campaignId}::uuid and d.state='PENDING'
          and n.status='ACTIVE' and a.status='ACTIVE'
       order by d.created_at,d.account_id limit ${batchSize}
       for update of d skip locked
      )
      update public_access.campaign_deliveries d set state='UNKNOWN',submitted_at=now()
      from chosen c where d.campaign_id=${campaignId}::uuid
        and d.account_id=c.account_id and d.state='PENDING'
      returning d.account_id`;
    let submitted=0,unknown=0,suppressed=0;
    for(const reservedRow of reserved){
      const accountId=String(reservedRow.account_id);
      const verified=await sql`select a.email,a.display_name
        from public_access.accounts a join public_access.newsletters n on n.account_id=a.id
        where a.id=${accountId}::uuid and a.status='ACTIVE' and n.status='ACTIVE' limit 1`;
      if(!verified.length){
        await sql`update public_access.campaign_deliveries set state='SUPPRESSED'
          where campaign_id=${campaignId}::uuid and account_id=${accountId}::uuid and state='UNKNOWN'`;
        suppressed++;continue;
      }
      const recipient=verified[0];
      const token=makeCampaignUnsubscribeToken(accountId);
      const url=`https://www.kraviaprivatelimited.com/newsletter/unsubscribe?token=${token}`;
      try{
        await sendPublicMail({
          kind:"NEWSLETTER_DIGEST",event_id:`newsletter:${campaignId}:${accountId}`,
          recipient_email:String(recipient.email),recipient_name:String(recipient.display_name),
          issue_subject:String(campaign.subject),message:String(campaign.body_text),
          unsubscribe_url:url,
        });
        await sql`update public_access.campaign_deliveries
          set state='SUBMITTED',submitted_at=now()
          where campaign_id=${campaignId}::uuid and account_id=${accountId}::uuid and state='UNKNOWN'`;
        submitted++;
      }catch{
        // Unknown delivery outcome is terminal. Never auto-retry without provider reconciliation.
        unknown++;
      }
    }
    const stateCounts=await sql`select
       count(*) filter (where state='PENDING')::int as remaining,
       count(*) filter (where state='UNKNOWN')::int as unresolved
       from public_access.campaign_deliveries where campaign_id=${campaignId}::uuid`;
    const pending=Number(stateCounts[0]?.remaining||0);
    const unresolved=Number(stateCounts[0]?.unresolved||0);
    if(canMarkCampaignSent(pending,unresolved)){
      await sql`update public_access.campaigns set status='SENT'
         where id=${campaignId}::uuid and status='SENDING'`;
    }
    return NextResponse.json({campaignId,submitted,unknown,suppressed,
      pending,unresolved,
      instruction:unresolved?"Some delivery outcomes require provider reconciliation. The campaign remains SENDING and UNKNOWN recipients will not be retried.":undefined
    },{headers});
  }catch{
    return unavailable();
  }
}
