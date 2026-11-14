import type {VaultCategory} from "@/lib/office/vault-categories";
/** A source permission and a current Vault grant are independent requirements.
 * Record-level source authorization is still rechecked on every read/action. */
const recordRead:Readonly<Record<string,string>>={
 identity:"registration.read",registrations:"registration.read",
 documents:"document.instance.read",custody:"custody.read",
};
export function visibleVaultCategories<T extends VaultCategory>(
 categories:readonly T[],sourcePermissions:ReadonlySet<string>,activeGrantCategories:ReadonlySet<string>,
):T[]{
 return categories.filter(category=>{
  if(category.slug==="secrets")return sourcePermissions.has("vault.secret.upload")||
    sourcePermissions.has("vault.secret.review")||
    (sourcePermissions.has("vault.secret.read")&&activeGrantCategories.has("secrets"));
  return activeGrantCategories.has(category.slug)&&
    (recordRead[category.slug]?sourcePermissions.has(recordRead[category.slug]):
     category.permissions.some(code=>sourcePermissions.has(code)));
 });
}
