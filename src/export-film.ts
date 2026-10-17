import {importedSoundtrack,type ImportedAudio} from './imported-audio';
import {standardQuality,type RenderQualityProfile} from './render-quality';
import { Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget, CanvasSource, AudioBufferSource, canEncodeVideo, canEncodeAudio, Quality } from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import { dimensions, type Aspect,type ScoreStyle } from './editor-model';
import { audioBuffer } from './techno';
export interface RenderableFilm {audioFile?:ImportedAudio;aspect:Aspect;duration:number;music:boolean;volume:number;score:ScoreStyle;renderQuality?:{export:RenderQualityProfile};}
export interface VideoRenderer<T> {canvas:HTMLCanvasElement;data:{height:number};prepare(project:T):Promise<unknown>;render(project:T,time:number,width:number,height:number,quality?:RenderQualityProfile):void;}

export interface ExportMode { name:string;extension:'mp4'|'webm';method:'frames'|'realtime';video?:'avc'|'vp9'|'vp8';audio?:'aac'|'opus';mime:string; }
let aacRegistered=false;
export async function exportMode(project:RenderableFilm,quality:'720'|'1080'):Promise<ExportMode|null>{
  const [width,height]=dimensions(project.aspect,quality);
  if('VideoEncoder' in globalThis){
    if(project.music&&!aacRegistered&&!await canEncodeAudio('aac',{sampleRate:44100,numberOfChannels:2})){registerAacEncoder();aacRegistered=true;}

    if(await canEncodeVideo('avc',{width,height,frameRate:30,quality:new Quality({bitrate:qualityBitrate(width,height)})}) && (!project.music || await canEncodeAudio('aac',{sampleRate:44100,numberOfChannels:2})))
      return {name:'MP4 · H.264'+(project.music?' + AAC':''),extension:'mp4',method:'frames',video:'avc',audio:'aac',mime:'video/mp4'};
    for(const codec of ['vp9','vp8'] as const){
      if(await canEncodeVideo(codec,{width,height,frameRate:30,quality:new Quality({bitrate:qualityBitrate(width,height)})}) && (!project.music || await canEncodeAudio('opus',{sampleRate:44100,numberOfChannels:2})))
        return {name:`WebM · ${codec.toUpperCase()}`+(project.music?' + Opus':''),extension:'webm',method:'frames',video:codec,audio:'opus',mime:'video/webm'};
    }
  }
  if(typeof MediaRecorder!=='undefined'){
    const options=project.music?['video/mp4;codecs=avc1.42001E,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']:['video/mp4;codecs=avc1.42001E','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    for(const mime of options)if(MediaRecorder.isTypeSupported(mime))return {name:(mime.includes('mp4')?'MP4':'WebM')+' · real-time render',extension:mime.includes('mp4')?'mp4':'webm',method:'realtime',mime};
  }
  return null;
}
const yieldUI=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
export async function renderVideo<T extends RenderableFilm>(renderer:VideoRenderer<T>,project:T,quality:'720'|'1080',mode:ExportMode,signal:AbortSignal,progress:(value:number,phase:string)=>void):Promise<Blob>{
  progress(0,'Preparing scene animations…');signal.throwIfAborted();
  if(typeof document!=='undefined')await document.fonts.load('16px "Silkscreen"');
  signal.throwIfAborted();
  await new Promise<void>((resolve,reject)=>{const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});renderer.prepare(project).then(()=>resolve(),reject).finally(()=>signal.removeEventListener('abort',abort));});
  signal.throwIfAborted();
  const [width,height]=dimensions(project.aspect,quality);
  if(mode.method==='realtime')return realtimeExport(renderer,project,width,height,mode,signal,progress);
  const target=new BufferTarget(),output=new Output({target,format:mode.extension==='mp4'?new Mp4OutputFormat({fastStart:'in-memory'}):new WebMOutputFormat()});
  renderer.render(project,0,width,height,project.renderQuality?.export??standardQuality);
  const encodingCanvas=createEncodingCanvas(width,height);
  copyEncodingFrame(encodingCanvas,renderer.canvas);
  const source=new CanvasSource(encodingCanvas,{codec:mode.video!,quality:new Quality({bitrate:qualityBitrate(width,height)}),keyFrameInterval:2});
  output.addVideoTrack(source,{frameRate:30});
  let music:AudioBufferSource|undefined;
  if(project.music){music=new AudioBufferSource({codec:mode.audio!,quality:new Quality({bitrate:128_000})});output.addAudioTrack(music);}
  output.setMetadataTags({title:`${renderer.data.height}.bitmap`,artist:'Bitmap Studio',comment:'Bitcoin block geometry. Values represent transaction outputs, including change and coinbase.'});
  try{
    signal.throwIfAborted();await output.start();
    if(music){progress(0,'Preparing the soundtrack…');await yieldUI();signal.throwIfAborted();await music.add((project.audioFile?await importedSoundtrack(project.audioFile,project.duration,project.volume):audioBuffer(project.duration,project.volume,project.score)));music.close();}
    const frames=Math.round(project.duration*30);
    for(let frame=0;frame<frames;frame++){
      signal.throwIfAborted();renderer.render(project,frame/30,width,height,project.renderQuality?.export??standardQuality);
      copyEncodingFrame(encodingCanvas,renderer.canvas);
      await source.add(frame/30,1/30,{keyFrame:frame%60===0});
      if(frame%4===0){progress((frame+1)/frames,`Frame ${frame+1} / ${frames}`);await yieldUI();}
    }
    source.close();signal.throwIfAborted();progress(1,'Finalizing the file…');await output.finalize();signal.throwIfAborted();
    if(!target.buffer)throw Error('The encoder did not produce a file.');
    return new Blob([target.buffer],{type:mode.mime});
  }catch(error){if(output.state!=='finalized'&&output.state!=='canceled')await output.cancel();throw error;}
}
async function realtimeExport<T extends RenderableFilm>(renderer:VideoRenderer<T>,project:T,width:number,height:number,mode:ExportMode,signal:AbortSignal,progress:(value:number,phase:string)=>void):Promise<Blob>{
  renderer.render(project,0,width,height,project.renderQuality?.export??standardQuality);
  const encodingCanvas=createEncodingCanvas(width,height);
  copyEncodingFrame(encodingCanvas,renderer.canvas);
  const stream=encodingCanvas.captureStream(30),chunks:Blob[]=[];
  let ctx:AudioContext|undefined,score:AudioBufferSourceNode|undefined,raf=0;
  let failure:unknown;
  try{
    if(project.music){
      ctx=new AudioContext();await ctx.resume();const destination=ctx.createMediaStreamDestination();
      score=ctx.createBufferSource();score.buffer=(project.audioFile?await importedSoundtrack(project.audioFile,project.duration,project.volume):audioBuffer(project.duration,project.volume,project.score));score.connect(destination);
      for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
    }
    const recorder=new MediaRecorder(stream,{mimeType:mode.mime,videoBitsPerSecond:qualityBitrate(width,height)});
    const finished=new Promise<void>((resolve,reject)=>{recorder.onstop=()=>failure?reject(failure):resolve();recorder.onerror=()=>{failure=Error('The browser interrupted recording.');if(recorder.state!=='inactive')recorder.stop();else reject(failure);};});
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    const abort=()=>{failure=signal.reason??new DOMException('Render canceled','AbortError');if(recorder.state!=='inactive')recorder.stop();};
    const visibility=()=>{if(document.hidden){failure=Error('Real-time recording stopped because the tab was hidden. Keep the tab visible while rendering.');if(recorder.state!=='inactive')recorder.stop();}};
    signal.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',visibility);
    try{
      signal.throwIfAborted();recorder.start(250);score?.start();const start=performance.now();
      const tick=()=>{
        if(recorder.state==='inactive')return;
        const time=Math.min(project.duration,(performance.now()-start)/1000);
        try{renderer.render(project,time,width,height,project.renderQuality?.export??standardQuality);copyEncodingFrame(encodingCanvas,renderer.canvas);progress(time/project.duration,'Recording in real time…');}
        catch(error){failure=error;recorder.stop();return;}
        if(time>=project.duration){recorder.stop();return;}raf=requestAnimationFrame(tick);
      };
      raf=requestAnimationFrame(tick);await finished;signal.throwIfAborted();
    }finally{signal.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',visibility);if(recorder.state!=='inactive')recorder.stop();}
    return new Blob(chunks,{type:mode.mime});
  }finally{cancelAnimationFrame(raf);try{score?.stop();}catch{}stream.getTracks().forEach(t=>t.stop());await ctx?.close();}
}
/** Detailed moving geometry needs more bandwidth than ordinary camera footage. */
export function qualityBitrate(width:number,height:number){return width*height>1_000_000?24_000_000:12_000_000;}
function createEncodingCanvas(width:number,height:number){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 canvas.getContext('2d',{alpha:false});return canvas;
}
/** Video has no alpha channel: flatten fades and scene gaps explicitly before encoding. */
export function copyEncodingFrame(target:HTMLCanvasElement,source:HTMLCanvasElement){
 const ctx=target.getContext('2d')!;
 ctx.fillStyle='#000000';ctx.fillRect(0,0,target.width,target.height);
 ctx.drawImage(source,0,0,target.width,target.height);
}
