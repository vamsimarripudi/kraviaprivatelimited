import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { getOfficeChatMessages, OfficeChatError, sendOfficeChatMessage, markOfficeChatRead } from "@/lib/office/chat-server";
import type {ChatHistoryCursor} from "@/lib/office/chat-history";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const message = z.object({ body: z.string().trim().min(1).max(4000), client_nonce: uuid, mention_user_ids: z.array(uuid).max(10).default([]), attachment_ids:z.array(uuid).max(5).default([]) }).strict();
function failure(error: unknown) {
  return NextResponse.json({ detail: error instanceof OfficeChatError ? error.message : "Message service unavailable" },
    { status: error instanceof OfficeChatError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request, { params }: Context) {
  const {id}=await params;
  if(!uuid.safeParse(id).success)return NextResponse.json({detail:"Not found"},{status:404,headers:{"Cache-Control":"no-store"}});
  const search=new URL(request.url).searchParams;
  const beforeAt=search.get("before_at"),beforeId=search.get("before_id");
  if((beforeAt===null)!==(beforeId===null))return NextResponse.json(
   {detail:"Incomplete history cursor"},{status:400,headers:{"Cache-Control":"no-store"}});
  let cursor:ChatHistoryCursor|undefined;
  if(beforeAt!==null&&beforeId!==null){
    const parsed=z.object({at:z.string().datetime({offset:true}),id:uuid}).safeParse({at:beforeAt,id:beforeId});
    if(!parsed.success)return NextResponse.json({detail:"Invalid history cursor"},
      {status:400,headers:{"Cache-Control":"no-store"}});
    cursor=parsed.data;
  }
  try{return NextResponse.json(await getOfficeChatMessages(id,cursor),
    {headers:{"Cache-Control":"no-store"}});}
  catch(error){return failure(error);}
}
export async function POST(request: Request, { params }: Context) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin requests are forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  const parsed = message.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid message" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try { return NextResponse.json(await sendOfficeChatMessage(id,parsed.data.body,parsed.data.client_nonce,parsed.data.mention_user_ids,parsed.data.attachment_ids),
    { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin requests are forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  try { return NextResponse.json(await markOfficeChatRead(id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
