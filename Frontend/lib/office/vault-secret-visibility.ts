/** Secret locker read admission: narrow per-record grants and pending review.
 * Pure code, but it must be called only AFTER verified AAL2 + managed-device IAM. */
export type SecretGrant={resource_id:string|null;action:string};
export type SecretGrantRights={read:boolean;preview:boolean;download:boolean};
export function secretGrantRights(grants:readonly SecretGrant[],documentId:string):SecretGrantRights{
 let read=false,preview=false,download=false;
 for(const grant of grants){
  if(grant.resource_id!==null&&grant.resource_id!==documentId)continue;
  if(grant.action==="READ"||grant.action==="PREVIEW"||grant.action==="DOWNLOAD")read=true;
  if(grant.action==="PREVIEW"||grant.action==="DOWNLOAD")preview=true;
  if(grant.action==="DOWNLOAD")download=true;
 }
 return {read,preview,download};
}
export function secretDocumentVisible(scope:{
 isOwner:boolean;canUpload:boolean;canRead:boolean;readGrant:boolean;
 canReview:boolean;hasPendingReview:boolean;
}):boolean{
 return (scope.canUpload&&scope.isOwner)||
  (scope.canRead&&scope.readGrant)||
  (scope.canReview&&scope.hasPendingReview);
}
export function secretVersionVisible(scope:{
 ownerUpload:boolean;independentReview:boolean;grantedRead:boolean;
 reviewState:string;scanState:string;
}):boolean{
 return scope.ownerUpload||
  (scope.independentReview&&scope.reviewState==="PENDING")||
  (scope.grantedRead&&scope.reviewState==="APPROVED"&&scope.scanState==="CLEAN");
}
