import { manualRoles } from "@/lib/office/manuals";
import { OFFICE_MANUAL_COMMON_FULL_TEXT, OFFICE_MANUAL_ROLES_FULL_TEXT, OFFICE_MANUAL_ATLAS_FULL_TEXT } from "@/lib/office/manual-full-text";

/** Source-complete handbook content, maintained separately in Frontend/manual-content. */
export function getDetailedCommonManual():string {
  return OFFICE_MANUAL_COMMON_FULL_TEXT;
}
const roleSections=(()=>{
  const source=OFFICE_MANUAL_ROLES_FULL_TEXT;
  const starts=Array.from(source.matchAll(/^## Role guide · /gm),match=>match.index);
  if(starts.length!==26 || starts.length!==manualRoles.length){
    throw new Error("Published role handbook source does not match the current catalogue");
  }
  return starts.map((start,index)=>source.slice(start,starts[index+1]??source.length)
    .replace(/\n---\s*$/,"").trim());
})();
export function getDetailedRoleManual(id:string):string {
  const index=manualRoles.findIndex(role=>role.id===id);
  if(index<0)throw new Error("Unknown assigned employee role guide");
  return roleSections[index];
}

/** Audited all-route atlas. Only exposed in authorised Owner and administrator views. */
export function getCompleteOfficeRouteAtlas():string {return OFFICE_MANUAL_ATLAS_FULL_TEXT;}
