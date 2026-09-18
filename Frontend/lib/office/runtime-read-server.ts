import "server-only";

import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";

export class OfficeRuntimeReadError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeRuntimeReadError"}
}

const allowedRoots=new Set([
  "assets","commercial","command-center","company","compliance","contracts","customers",
  "integrations","invoices","operational-alerts","products","vendors",
]);

function safePath(path:string){
  const segments=path.split("/").filter(Boolean);
  if(!segments.length||!allowedRoots.has(segments[0]))return null;
  if(segments.some(segment=>segment==="."||segment===".."||segment.includes("\\")||segment.includes("?")||segment.includes("#")))return null;
  return segments.map(encodeURIComponent).join("/");
}

export async function readOfficeRuntime<T>(path:string):Promise<T>{
  const normalized=safePath(path);
  if(!normalized)throw new OfficeRuntimeReadError(404,"Office runtime read path is not permitted");
  const origin=getOfficeRuntimeOrigin();
  if(!origin)throw new OfficeRuntimeReadError(503,"KRAVIA Office runtime is not activated on this deployment");
  const session=await getOfficeSessionContext();
  if(!session||!officeIdentityIsProvisioned(session.identity))throw new OfficeRuntimeReadError(401,"Office sign-in required");
  if(session.identity.aal!=="aal2")throw new OfficeRuntimeReadError(403,"MFA verification required");

  const target=new URL("/api/v1/"+normalized,origin);
  let response:Response;
  try{
    response=await fetch(target,{
      method:"GET",
      headers:{
        "Accept":"application/json",
        "Authorization":`Bearer ${session.session.access_token}`,
        "X-Kravia-Gateway":"server-runtime-read",
      },
      cache:"no-store",
      redirect:"manual",
      signal:AbortSignal.timeout(25_000),
    });
  }catch{
    throw new OfficeRuntimeReadError(502,"KRAVIA Office runtime is unavailable");
  }
  if(response.status>=300&&response.status<400)throw new OfficeRuntimeReadError(502,"Unexpected Office runtime redirect");
  const body=await response.json().catch(()=>null);
  if(!response.ok){
    const detail=body&&typeof body==="object"&&typeof (body as Record<string,unknown>).detail==="string"
      ? String((body as Record<string,unknown>).detail)
      : "Canonical Office runtime request failed";
    throw new OfficeRuntimeReadError(response.status,detail);
  }
  return body as T;
}
