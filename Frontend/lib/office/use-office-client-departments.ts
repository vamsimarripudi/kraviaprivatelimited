"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {officeDepartmentLabels} from "@/lib/office/client-department-navigation";
type Data={actor?:{user_id:string};departments?:Array<{code:string;active?:boolean}>;ownership?:Array<{department_code:string;owner_user_id:string}>};
type State={status:"loading"|"ready"|"unavailable";codes:string[];lastCheckedAt:number|null;error:string|null};
const RECHECK_MS=30000;
/** Uses the existing authorized Office endpoint; never grants access. */
export function useOfficeClientDepartments(userId:string,primaryDepartment?:string|null){
 const [state,setState]=useState<State>({status:"loading",codes:[],lastCheckedAt:null,error:null});
 const inFlight=useRef(false);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  if(inFlight.current)return;
  inFlight.current=true;
  try{
   const response=await fetch("/api/office-departments",{credentials:"same-origin",cache:"no-store",signal});
   if(!response.ok)throw new Error(response.status===401?"Office sign-in required":"Department directory unavailable");
   const source=await response.json() as Data;
   if(source.actor?.user_id!==userId||!Array.isArray(source.departments)||!Array.isArray(source.ownership))
    throw new Error("Department authority could not be verified");
   const catalog=new Set(source.departments.filter(d=>d.active!==false&&d.code in officeDepartmentLabels).map(d=>d.code));
   const mine=source.ownership.filter(o=>o.owner_user_id===userId&&catalog.has(o.department_code))
    .map(o=>o.department_code);
   // Primary department comes from the signed-in Office identity, not localStorage.
   const primary=(primaryDepartment??"").toUpperCase();
   if(primary in officeDepartmentLabels)mine.push(primary);
   if(!signal?.aborted)setState({status:"ready",codes:[...new Set(mine)].sort(),lastCheckedAt:Date.now(),error:null});
  }catch(error){
   if(!signal?.aborted)setState({status:"unavailable",codes:[],lastCheckedAt:null,
    error:error instanceof Error?error.message:"Unable to read department assignments"});
  }finally{inFlight.current=false;}
 },[userId,primaryDepartment]);
 useEffect(()=>{
  const controller=new AbortController();
  void refresh(controller.signal);
  const sync=()=>{if(document.visibilityState==="visible")void refresh(controller.signal);};
  const interval=window.setInterval(sync,RECHECK_MS);
  document.addEventListener("visibilitychange",sync);
  window.addEventListener("focus",sync);
  window.addEventListener("kravia-office-departments-changed",sync);
  return()=>{controller.abort();window.clearInterval(interval);
   document.removeEventListener("visibilitychange",sync);window.removeEventListener("focus",sync);
   window.removeEventListener("kravia-office-departments-changed",sync);
  };
 },[refresh]);
 return {...state,refresh:()=>refresh()};
}
