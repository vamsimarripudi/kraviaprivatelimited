/** Pure, source-independent visibility filter. A category grant is never a
 * replacement for effective Company/OWN authority over the actual record. */
export function visibleVaultRecordIds(
 rows:readonly {id:string;owner_user_id?:string|null}[],
 actorUserId:string,canReadCompany:boolean,canReadOwn:boolean,
):Set<string>{
 const result=new Set<string>();
 for(const row of rows){
  if(!row.id)continue;
  if(canReadCompany||(canReadOwn&&row.owner_user_id===actorUserId)){
   result.add(row.id);
  }
 }
 return result;
}
