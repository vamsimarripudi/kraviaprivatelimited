/** The audience is a current authorization boundary, not display metadata. */
export type KnowledgeVisibilityContext={
 department:string|null;
 roles:readonly string[];
 companyManage:boolean;
 companyPublish:boolean;
 departmentManage:boolean;
 departmentPublish:boolean;
};
export type KnowledgeAudienceRow={id:string;status:string;audience_type:string;audience_key?:string|null};
const same=(a:string|null|undefined,b:string|null|undefined)=>
 Boolean(a&&b&&a.toUpperCase()===b.toUpperCase());
export function knowledgeArticleIsManaged(
 row:KnowledgeAudienceRow,context:KnowledgeVisibilityContext,
):boolean{
 if(context.companyManage||context.companyPublish)return true;
 return row.audience_type==="DEPARTMENT"&&same(row.audience_key,context.department)&&
  (context.departmentManage||context.departmentPublish);
}
export function knowledgeArticleIsVisible(
 row:KnowledgeAudienceRow,context:KnowledgeVisibilityContext,
):boolean{
 if(knowledgeArticleIsManaged(row,context))return true;
 if(row.status!=="PUBLISHED")return false;
 if(row.audience_type==="COMPANY")return true;
 if(row.audience_type==="DEPARTMENT")return same(row.audience_key,context.department);
 if(row.audience_type==="ROLE")return Boolean(row.audience_key&&context.roles.includes(row.audience_key));
 return false;
}
