import {NextResponse} from "next/server";
import {z} from "zod";
import {getOfficeNotificationPreferences,updateOfficeNotificationPreferences,OfficeNotificationError}
  from "@/lib/office/notification-server";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";

export const dynamic="force-dynamic";
const categories=z.object({
  chat:z.boolean(),support:z.boolean(),department:z.boolean(),approval:z.boolean(),
  hr:z.boolean(),finance:z.boolean(),vault:z.boolean(),system:z.boolean(),
}).strict();
const schema=z.object({
  sound_enabled:z.boolean(),
  volume:z.number().min(0).max(1),
  quiet_enabled:z.boolean(),
  quiet_start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quiet_end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  browser_enabled:z.boolean(),
  categories,
}).strict();

function fail(error:unknown) {
  const status=error instanceof OfficeNotificationError?error.status:500;
  return NextResponse.json({detail:error instanceof Error?error.message:"Notification settings unavailable"},
    {status,headers:{"Cache-Control":"no-store"}});
}

export async function GET() {
  try{return NextResponse.json(await getOfficeNotificationPreferences(),{
    headers:{"Cache-Control":"no-store"}});}
  catch(error){return fail(error);}
}

export async function PUT(request:Request) {
  if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin updates forbidden"},
    {status:403,headers:{"Cache-Control":"no-store"}});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({detail:"Invalid notification preferences"},{status:400});
  try{return NextResponse.json(await updateOfficeNotificationPreferences(parsed.data),{
    headers:{"Cache-Control":"no-store"}});}
  catch(error){return fail(error);}
}
