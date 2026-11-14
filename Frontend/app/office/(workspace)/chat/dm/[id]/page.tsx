import { notFound } from "next/navigation";
import { OfficeConnect } from "@/components/office-connect";
export const dynamic = "force-dynamic";
type Props = {params:Promise<{id:string}>};
export default async function PrivateConversation({params}:Props){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
 return <OfficeConnect initialConversationId={id}/>;
}
