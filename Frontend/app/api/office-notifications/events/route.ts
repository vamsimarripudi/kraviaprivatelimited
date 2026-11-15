import {NextResponse} from "next/server";
import {getOfficeNotificationCenter,OfficeNotificationError} from "@/lib/office/notification-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const encoder=new TextEncoder();
function event(name:string,payload:unknown) {
  return encoder.encode("event: "+name+"\ndata: "+JSON.stringify(payload)+"\n\n");
}

/** Short-lived credentialled SSE. Each poll repeats identity authorization.
 * No database service key, employee identity or private payload is exposed.
 */
export async function GET(request:Request) {
  let initial:Awaited<ReturnType<typeof getOfficeNotificationCenter>>;
  try{initial=await getOfficeNotificationCenter();}
  catch(error){return NextResponse.json({
    detail:error instanceof OfficeNotificationError?error.message:"Notification stream unavailable",
  },{status:error instanceof OfficeNotificationError?error.status:503});}

  const stream=new ReadableStream<Uint8Array>({
    start(controller) {
      let closed=false;
      let busy=false;
      const previous=new Map<string,string>(
        initial.notifications.map(row=>[row.id,row.status])
      );
      let lastUnread=initial.unread;
      const send=(kind:string,payload:unknown)=>{
        if(!closed)try{controller.enqueue(event(kind,payload));}catch{close();}
      };
      let interval:ReturnType<typeof setInterval> | null=null;
      let timeout:ReturnType<typeof setTimeout> | null=null;
      const close=()=>{
        if(closed)return;
        closed=true;if(interval)clearInterval(interval);if(timeout)clearTimeout(timeout);
        request.signal.removeEventListener("abort",close);
        try{controller.close();}catch{}
      };
      const poll=async()=>{
        if(closed||busy)return;
        busy=true;
        try{
          const fresh=await getOfficeNotificationCenter();
          const changes=fresh.notifications.filter(row=>{
            const state=previous.get(row.id);
            return !state || state!==row.status;
          });
          const newest=new Map(fresh.notifications.map(row=>[row.id,row.status]));
          previous.clear();for(const [id,value] of newest)previous.set(id,value);
          if(changes.length || fresh.unread!==lastUnread)
            send("change",{ids:changes.map(r=>r.id).slice(0,50),unread:fresh.unread});
          lastUnread=fresh.unread;
        }catch{
          send("unavailable",{detail:"Source requires reauthorization or is temporarily unavailable"});
          close();
        }finally{busy=false;}
      };
      send("ready",{unread:initial.unread});
      interval=setInterval(()=>void poll(),4000);
      timeout=setTimeout(close,52000);
      request.signal.addEventListener("abort",close,{once:true});
    },
  });
  return new Response(stream,{headers:{
    "Content-Type":"text/event-stream; charset=utf-8",
    "Cache-Control":"private, no-store, no-transform",
    "X-Accel-Buffering":"no",
    "Connection":"keep-alive",
  }});
}
