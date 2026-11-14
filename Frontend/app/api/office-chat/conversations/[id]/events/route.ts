import {NextResponse} from "next/server";
import {z} from "zod";
import {requireOfficeChatConversation,OfficeChatError} from "@/lib/office/chat-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

type Context={params:Promise<{id:string}>};
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const uuid=z.string().uuid();
const MAX_EVENTS_PER_BATCH=40;
const STREAM_MS=24000;
const PULSE_MS=2300;
const encoder=new TextEncoder();
const cursor=/^(?:0|[1-9]\d{0,17})$/;
function event(kind:string,payload:Record<string,string>,id?:string){
 return (id?"id: "+id+"\n":"")+"event: "+kind+"\n"+"data: "+JSON.stringify(payload)+"\n\n";
}
function failure(error:unknown){
 const status=error instanceof OfficeChatError?error.status:503;
 return NextResponse.json({detail:status===404?"Conversation unavailable":"Live updates unavailable"},
  {status,headers});
}
/** The stream is a first-party notification transport. It carries no message
 * text, name, file key, receipt or private access-grant metadata. */
export async function GET(request:Request,{params}:Context){
 const {id}=await params;
 if(!uuid.safeParse(id).success)return NextResponse.json(
  {detail:"Conversation unavailable"},{status:404,headers});
 const search=new URL(request.url).searchParams;
 const raw=search.get("since")??request.headers.get("last-event-id")??"";
 if(raw&&!cursor.test(raw))return NextResponse.json(
  {detail:"Invalid event cursor"},{status:400,headers});
 let actor:Awaited<ReturnType<typeof requireOfficeChatConversation>>;
 try{actor=await requireOfficeChatConversation(id);}
 catch(error){return failure(error);}
 // If there is no cursor, subscribe to changes from NOW. The client still
 // loads the canonical history independently before relying on invalidations.
 let since=raw||"0";
 if(!raw){
  const latest=await actor.admin.from("office_chat_change_events")
   .select("id").eq("conversation_id",id).order("id",{ascending:false}).limit(1);
  if(latest.error)return NextResponse.json({detail:"Live event source is not configured"},
    {status:503,headers});
  since=latest.data?.[0]?.id==null?"0":String(latest.data[0].id);
 }
 let cancelled=false;
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   const emit=(value:string)=>{if(!cancelled)controller.enqueue(encoder.encode(value));};
   emit("retry: 3000\n\n");
   emit(event("ready",{mode:"private",cursor:since},since==="0"?undefined:since));
   const begun=Date.now();
   while(!cancelled&&Date.now()-begun<STREAM_MS){
    try{
     // Check current membership, Office status and DEPARTMENT assignment for
     // EACH event batch, not just at the start of a WebSocket/session.
     await requireOfficeChatConversation(id);
     const result=await actor.admin.from("office_chat_change_events")
      .select("id,event_type").eq("conversation_id",id).gt("id",since)
      .order("id",{ascending:true}).limit(MAX_EVENTS_PER_BATCH);
     if(result.error)throw new Error("Event source unavailable");
     for(const row of result.data??[]){
      const next=String(row.id);
      if(!cursor.test(next))throw new Error("Event cursor unavailable");
      emit(event(row.event_type==="PRESENCE"?"presence":"change",{kind:String(row.event_type)},next));
      since=next;
     }
     // Heartbeats are comments and are never interpreted as business events.
     emit(": keepalive\n\n");
     if(result.data?.length===MAX_EVENTS_PER_BATCH)continue;
     await new Promise<void>(resolve=>setTimeout(resolve,PULSE_MS));
    }catch(error){
     const revoked=error instanceof OfficeChatError&&
       (error.status===401||error.status===403||error.status===404);
     emit(event(revoked?"access-revoked":"unavailable",{detail:revoked?
      "Conversation access ended":"Live event stream unavailable"}));
     break;
    }
   }
   if(!cancelled){cancelled=true;controller.close();}
  },
  cancel(){cancelled=true;},
 });
 return new Response(stream,{
  headers:{
   "Content-Type":"text/event-stream; charset=utf-8",
   "Cache-Control":"private, no-store, no-transform",
   "X-Content-Type-Options":"nosniff",
   "X-Accel-Buffering":"no",
   "Content-Security-Policy":"default-src 'none'",
  },
 });
}
