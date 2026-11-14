/** A QR or trusted-device reference must be a canonical UUID shape. */
export function isOfficeUuid(value:unknown):value is string{
 return typeof value==="string"&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
