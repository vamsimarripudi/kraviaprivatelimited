import {NextResponse} from "next/server";
export const dynamic="force-dynamic";

type Note = readonly [frequency:number,onset:number,amplitude:number,decay:number,brightness:number,bend:number];
const presets:Record<string,{length:number;notes:Note[]}> = {
  orbit:{length:0.78,notes:[
    [493.883,.028,.44,.148,.075,.012],
    [659.255,.184,.48,.210,.087,-.016],
    [987.767,.184,.046,.150,.065,0],
  ]},
  prism:{length:.99,notes:[
    [523.251,.045,.24,.165,.075,.011],
    [783.991,.182,.33,.24,.13,.015],
    [1046.502,.326,.19,.26,.09,.012],
    [1567.982,.350,.035,.18,.08,0],
  ]},
  flux:{length:.82,notes:[
    [392,.027,.25,.115,.16,.045],
    [587.33,.092,.21,.146,.11,-.020],
    [698.456,.270,.41,.19,.10,-.012],
    [1047,.291,.06,.14,.025,0],
  ]},
  beacon:{length:1.23,notes:[
    [440,.038,.33,.145,.08,.004],
    [554.365,.118,.29,.17,.08,.012],
    [440,.500,.34,.165,.085,.010],
    [659.255,.585,.30,.23,.075,-.012],
  ]},
};

/** Identical note schedules to the approved original synthesized MP3 presets.
 * Generated as cacheable PCM to avoid shipping third-party audio dependencies.
 */
function tone({length,notes}:{length:number;notes:Note[]}) {
  const sampleRate=24000;
  const frames=Math.floor(length*sampleRate);
  const header=44,channelCount=2;
  const output=new Uint8Array(header+frames*2*channelCount);
  const view=new DataView(output.buffer);
  const ascii=(off:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(off+i,text.charCodeAt(i));};
  ascii(0,"RIFF");view.setUint32(4,output.length-8,true);ascii(8,"WAVE");
  ascii(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);
  ascii(36,"data");view.setUint32(40,output.length-header,true);

  const left=new Float64Array(frames),right=new Float64Array(frames);
  for(let i=0;i<frames;i++){
    const t=i/sampleRate;
    let signal=0;
    for(const [freq,onset,amp,decay,bright,bend] of notes){
      const d=t-onset;
      if(d<0)continue;
      const attack=Math.min(1,d/.008);
      const envelope=Math.exp(-d/decay)*attack*amp;
      const phase=2*Math.PI*(freq*d+bend*.028*freq*(1-Math.exp(-d/.028)));
      signal+=envelope*(Math.sin(phase)+bright*Math.sin(2.001*phase+.35)+.05*Math.sin(3.93*phase+.7));
    }
    left[i]=signal;
    right[i]=signal;
  }
  const echoes:[number,number,number,number]=[57,77,.085,.075];
  for(const [buffer,delay,gain] of [[left,echoes[0],echoes[2]],[right,echoes[1],echoes[3]]] as const){
    const shifted=Math.floor(delay*sampleRate/1000);
    for(let i=frames-1;i>=shifted;i--)buffer[i]+=buffer[i-shifted]*gain;
  }
  let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
  const scale=peak?Math.min(.32/peak,1):1;
  const fade=Math.floor(.095*sampleRate);
  for(let i=0;i<frames;i++){
    const start=Math.min(1,i/(sampleRate*.012));
    const end=i>=frames-fade?Math.max(0,(frames-i)/fade):1;
    view.setInt16(header+i*4,Math.round(left[i]*scale*start*end*32767),true);
    view.setInt16(header+i*4+2,Math.round(right[i]*scale*start*end*32767),true);
  }
  return output;
}
export async function GET(_request:Request,{params}:{params:Promise<{sound:string}>}) {
  const {sound}=await params;
  const preset=presets[sound];
  if(!preset)return NextResponse.json({detail:"Unknown KRAVIA sound"},{status:404});
  const audio=tone(preset);
  return new Response(audio.buffer as ArrayBuffer,{headers:{
    "Content-Type":"audio/wav",
    "Cache-Control":"public, max-age=604800, immutable",
    "X-Content-Type-Options":"nosniff",
  }});
}
