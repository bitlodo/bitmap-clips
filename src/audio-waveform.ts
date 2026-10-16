import { synthesizeTechno } from './techno';
import {scores,type ScoreStyle} from './editor-model';
import type {Film} from './clips/film';

/** Audio selection and waveform use the available playback duration, including audio-only preview. */
export function audioTimelineState(audio:Film['audio'],frames:number){
 const name=audio.file?.name??`${scores[audio.score].name} · ${scores[audio.score].bpm} BPM`;
 const hasWaveform=audio.enabled&&frames>0;
 const message=audio.enabled?`${name} · Add a scene or text to set the video duration.`:'No audio added. Click to choose a soundtrack.';
 return {hasWaveform,message,label:audio.enabled?`${name} · Audio properties`:message};
}


/** Peak envelope of the synthesized soundtrack, including its opening/end fades. */
export function scoreWaveform(duration:number,style:ScoreStyle,bins=2048):Float32Array {
  const samples=synthesizeTechno(duration,8000,style),peaks=new Float32Array(bins);
  for(let i=0;i<samples.length;i++){
    const bin=Math.min(bins-1,Math.floor(i/samples.length*bins));
    peaks[bin]=Math.max(peaks[bin]!,Math.abs(samples[i]!));
  }
  return peaks;
}

export function drawWaveform(canvas:HTMLCanvasElement,peaks:Float32Array,volume:number) {
  const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
  const density=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*density);canvas.height=Math.round(height*density);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.scale(density,density);ctx.clearRect(0,0,width,height);ctx.fillStyle='#c3b4dc';
  const bars=Math.max(1,Math.floor(width/3)),middle=height/2,amplitude=(height-8)/2;
  for(let i=0;i<bars;i++){
    const start=Math.floor(i/bars*peaks.length),end=Math.max(start+1,Math.ceil((i+1)/bars*peaks.length));let peak=0;
    for(let j=start;j<end;j++)peak=Math.max(peak,peaks[j]??0);
    const half=Math.max(.5,peak/.65*volume*amplitude);
    ctx.fillRect(i*width/bars,middle-half,Math.max(1,width/bars-1),half*2);
  }
}
