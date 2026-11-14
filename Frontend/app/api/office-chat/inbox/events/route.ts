import {NextResponse} from "next/server";
import {listOfficeChatConversations,OfficeChatError} from "@/lib/office/chat-server";
import {z} from "zod";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const MAX_BATCH=40,STREAM_MS=24000,PULSE_MS=3600;
const encoder=new TextEncoder(),cursor=/^(?:0|[1-9]\d{0,17})$/;
const event=(name:string,payload:{kind:string},id?:string)=>
 (id?"id: "+id+"\n":"")+"event: "+name+"\n"+
 "data: "+JSON.stringify(payload)+"\n\n";
/** First-party inbox invalidation, not content delivery. Membership is
 * revalidated for every batch, including department transfers and removals. */
export async function GET(request:Request){
 const parsed=new URL(request.url).searchParams.get("since")||
  request.headers.get("last-event-id")||"";
 if(parsed&&!cursor.test(parsed))
  return NextResponse.json({detail:"Invalid live inbox cursor"},{status:400,headers});
 let initial:Awaited<ReturnType<typeof listOfficeChatConversations>>;
 try{initial=await listOfficeChatConversations();}
 catch(error){
  return NextResponse.json({detail:"Private inbox unavailable"},{
   status:error instanceof OfficeChatError?error.status:503,headers});
 }
 let since=parsed||"0",cancelled=false;
 const known=new Set(initial.conversations.map(c=>String(c.id)));
 const actor=initial.actor_user_id;
 // Only authorized conversation IDs are queried, never all company messages.
 const stream=new ReadableStream<Uint8Array>({
  start(controller){
   void (async()=>{
    const send=(s:string)=>{if(!cancelled&&controller.desiredSize!==null&&
      controller.desiredSize>0)controller.enqueue(encoder.encode(s));};
    send("retry: 3000\n\n");
    send(event("ready",{kind:"PRIVATE_INBOX"}));
    const start=Date.now();
    while(!cancelled&&Date.now()-start<STREAM_MS){
     try{
      const current=await listOfficeChatConversations();
      if(current.actor_user_id!==actor)throw new OfficeChatError(403,"Inbox identity changed");
      const ids=current.conversations.map(c=>String(c.id));
      if(ids.length!==known.size||ids.some(id=>!known.has(id))){
       known.clear();for(const id of ids)known.add(id);
       send(event("change",{kind:"MEMBERSHIP"}));
      }
      if(ids.length){
       const {requireOfficeActor}=await import("@/lib/office/permission-engine");
       const currentActor=await requireOfficeActor();
       const results=await currentActor.admin.from("office_chat_change_events")
        .select("id").in("conversation_id",ids).gt("id",since)
        .order("id",{ascending:true}).limit(MAX_BATCH);
       if(results.error)throw new Error("Private inbox event ledger unavailable");
       for(const row of results.data??[]){
        if(controller.desiredSize!==null&&controller.desiredSize<=0)break;
        const next=String(row.id);
        if(!cursor.test(next))throw new Error("Invalid stored inbox cursor");
        send(event("change",{kind:"CONVERSATION"},next));
        since=next;
       }
       if(results.data?.length===MAX_BATCH)continue;
      }
      send(": keepalive\n\n");
      await new Promise<void>(r=>setTimeout(r,PULSE_MS));
     }catch(error){
      const forbidden=error instanceof OfficeChatError&&
       [401,403,404].includes(error.status);
      send(event(forbidden?"access-revoked":"unavailable",{
       kind:forbidden?"AUTHORITY_ENDED":"SOURCE_UNAVAILABLE",
      }));
      break;
     }
    }
    if(!cancelled){cancelled=true;controller.close();}
   })().catch(()=>{if(!cancelled){cancelled=true;controller.close();}});
  },
  cancel(){cancelled=true;},
 });
 return new Response(stream,{headers:{
  "Content-Type":"text/event-stream; charset=utf-8",
  "Cache-Control":"private, no-store, no-transform",
  "X-Accel-Buffering":"no",
  "X-Content-Type-Options":"nosniff",
  "Content-Security-Policy":"default-src 'none'",
 }});
}
