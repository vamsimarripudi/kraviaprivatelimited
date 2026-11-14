/** Stream decrypted secret evidence in bounded copies without caching it.
 * Plaintext is never placed into a public bucket or returned as JSON. */
export function streamSealedDocument(bytes:Uint8Array,chunkSize=65536):ReadableStream<Uint8Array>{
 if(!Number.isInteger(chunkSize)||chunkSize<1024||chunkSize>262144)
  throw new Error("Invalid private download stream chunk size");
 let offset=0;
 let closed=false;
 const release=()=>{
  if(closed)return;
  closed=true;
  bytes.fill(0); // wipe the retained server buffer after delivery/cancellation
 };
 return new ReadableStream<Uint8Array>({
  pull(controller){
   if(closed){controller.close();return;}
   if(offset>=bytes.length){release();controller.close();return;}
   const next=Math.min(offset+chunkSize,bytes.length);
   controller.enqueue(Uint8Array.from(bytes.subarray(offset,next)));
   offset=next;
   if(offset===bytes.length){release();controller.close();}
  },
  cancel(){release();},
 });
}
