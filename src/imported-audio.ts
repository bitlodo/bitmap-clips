import {z} from 'zod';
export const MAX_AUDIO_BYTES=20*1024*1024;
export const importedAudioSchema=z.object({name:z.string().min(1).max(255),data:z.string().max(Math.ceil(MAX_AUDIO_BYTES/3)*4).regex(/^[A-Za-z0-9+/]+={0,2}$/),duration:z.number().positive().max(7200)});
export type ImportedAudio=z.infer<typeof importedAudioSchema>;
let cachedData='',cached:Promise<AudioBuffer>|undefined;
export function decodeImportedAudio(file:ImportedAudio):Promise<AudioBuffer>{
 if(cachedData===file.data&&cached)return cached;
 cachedData=file.data;
 const pending=(async()=>{
  const binary=atob(file.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const context=new AudioContext({sampleRate:44100});
  try{return await context.decodeAudioData(bytes.buffer);}finally{await context.close();}
 })();
 cached=pending;
 void pending.catch(()=>{if(cached===pending){cached=undefined;cachedData='';}});
 return pending;
}
export async function importAudioFile(file:File):Promise<ImportedAudio>{
 if(!file.size||file.size>MAX_AUDIO_BYTES)throw Error('Choose an audio file up to 20 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
 for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 const imported={name:file.name,data:btoa(binary),duration:1};
 let decoded:AudioBuffer;
 try{decoded=await decodeImportedAudio(imported);}catch{throw Error('This audio file could not be decoded. Try MP3, WAV, M4A, or OGG.');}
 return importedAudioSchema.parse({...imported,duration:decoded.duration});
}
/** Trim longer tracks and leave silence after shorter tracks; never repeat music implicitly. */
export async function importedSoundtrack(file:ImportedAudio,duration:number,volume:number):Promise<AudioBuffer>{
 const source=await decodeImportedAudio(file),length=Math.max(1,Math.ceil(duration*44100));
 const output=new AudioBuffer({length,sampleRate:44100,numberOfChannels:2});
 for(let channel=0;channel<2;channel++){
  const input=source.getChannelData(Math.min(channel,source.numberOfChannels-1)),values=output.getChannelData(channel);
  for(let i=0;i<Math.min(length,input.length);i++)values[i]=input[i]!*volume;
 }
 return output;
}
export function importedWaveform(buffer:AudioBuffer,duration:number,bins=2048):Float32Array{
 const peaks=new Float32Array(bins),length=Math.min(buffer.length,Math.ceil(duration*buffer.sampleRate));
 for(let channel=0;channel<buffer.numberOfChannels;channel++){
  const values=buffer.getChannelData(channel);
  for(let i=0;i<length;i++){
   const bin=Math.min(bins-1,Math.floor(i/buffer.sampleRate/duration*bins));
   peaks[bin]=Math.max(peaks[bin]!,Math.abs(values[i]!));
  }
 }
 return peaks;
}
