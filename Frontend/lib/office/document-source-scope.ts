/** Source-record visibility. A document creator, colleague, or company-owned
 * template does not confer read access to someone else's document instances.
 * Department grants are accepted only after canonical current job verification. */
export type DocumentScopeRow = {owner_user_id?:string|null;template_id?:string|null};
export function sourceVisibleDocumentInstances<T extends DocumentScopeRow>(
 rows:readonly T[],actorId:string,company:boolean,own:boolean,
 departmentTemplateIds:ReadonlySet<string>,
):T[]{
 return rows.filter(row=>company ||
  (own&&row.owner_user_id===actorId) ||
  (typeof row.template_id==="string"&&departmentTemplateIds.has(row.template_id)));
}
