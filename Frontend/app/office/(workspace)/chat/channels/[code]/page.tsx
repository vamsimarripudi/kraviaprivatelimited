import {notFound} from "next/navigation";
import {OfficeConnectChannel} from "@/components/office-connect-channel";
export const dynamic="force-dynamic";
type Props={params:Promise<{code:string}>};
export default async function DepartmentChannel({params}:Props){
 const {code}=await params;
 if(!/^[A-Za-z0-9_-]{2,80}$/.test(code))notFound();
 return <OfficeConnectChannel code={code.toUpperCase()}/>;
}
