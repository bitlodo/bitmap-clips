import {importedSoundtrack,type ImportedAudio} from './imported-audio';
import { clamp, scores, type ScoreStyle } from './editor-model';

const tau=2*Math.PI;
const pitch=(note:number)=>440*Math.pow(2,(note-69)/12);
const jazzInstruments='108 BPM · Syncopated electric bass, FM electric piano, ride cymbal and a reed-like lead';
export const scoreInstruments:Record<ScoreStyle,string>={
 deep:'172 BPM · Broken drums, detuned Reese bass, suspended pads and a glassy melody',
 acid:'128 BPM · Pulse-wave arpeggios, triangle bass, noise drums and an eight-bit melody',
 ambient:'96 BPM · Slow air pads, evolving overtones and deep drones; no drums',
 jazz:jazzInstruments,pulse:jazzInstruments,minimal:jazzInstruments,
};

/** Deterministic, arranged scores shared by waveform, playback and export. */
export function synthesizeTechno(duration:number,sampleRate=44100,style:ScoreStyle='deep'):Float32Array {
 if(style==='pulse'||style==='minimal')style='jazz';
 const length=Math.max(0,Math.ceil(duration*sampleRate)),mix=new Float32Array(length),send=new Float32Array(length);
 if(!length)return mix;
 const beat=60/scores[style].bpm,bar=beat*4;
 const ambient=style==='ambient',chip=style==='acid',jazz=style==='jazz',dnb=style==='deep';
 let seed=170170;
 const noise=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967295*2-1;};
 const voice=(at:number,seconds:number,render:(age:number,index:number)=>number,level:number,wet=0)=>{
  const start=Math.round(at*sampleRate),count=Math.min(Math.ceil(seconds*sampleRate),length-start);
  for(let j=0;j<count;j++){const index=start+j;if(index<0)continue;const value=render(j/sampleRate,j)*level;mix[index]!+=value;send[index]!+=value*wet;}
 };
 const envelope=(age:number,seconds:number,attack=.006,release=.06)=>Math.min(1,age/attack)*Math.min(1,Math.max(0,(seconds-age)/release));
 const kick=(at:number,level=1)=>voice(at,.25,t=>{
  const phase=chip?(Math.round((140*Math.exp(-t*55)+45)/8)*8)*t:jazz?55*t+65/45*(1-Math.exp(-t*45)):60*t+150/65*(1-Math.exp(-t*65));
  return Math.sin(tau*phase)*Math.exp(-t*(chip?32:jazz?20:24))*(1-Math.exp(-t*1800));
 },level*(jazz?.42:.62));
 const snare=(at:number,level=1)=>{
  let low=0;
  voice(at,chip?.1:.23,(t,index)=>{
   const n=chip?(Math.floor(index/(sampleRate/6000))%2?noise():low):noise();low+=.23*(n-low);
   if(chip)return n*Math.exp(-t*42);
   return ((n-low)*(jazz?.35:.7)*Math.exp(-t*(jazz?32:19))+Math.sin(tau*(jazz?170:205)*t)*.25*Math.exp(-t*34))*(1-Math.exp(-t*2200));
  },level*(jazz?.36:.5),jazz?.12:0);
 };
 const hat=(at:number,open=false,level=1)=>{
  let previous=0;
  voice(at,jazz?.28:open?.19:.065,t=>{
   const n=noise(),high=n-previous;previous=n;
   const color=jazz?Math.sin(tau*2473*t)*Math.sin(tau*3937*t)*.6+high*.15:dnb?high:n;
   return color*Math.exp(-t*(jazz?18:open?24:85))*(1-Math.exp(-t*3000));
  },level*(jazz?.05:.065));
 };
 const tone=(at:number,note:number,seconds:number,kind:'sub'|'pluck'|'chip'|'pad'|'reese'|'triangle'|'fm'|'air'|'electric-bass'|'reed',level:number)=>{
  const frequency=pitch(note),harmonics=kind==='chip'?9:kind==='pluck'?5:1;
  voice(at,seconds,t=>{
   let value=0;
   if(kind==='electric-bass')value=(Math.sin(tau*frequency*t)+.38*Math.sin(tau*frequency*2*t)*Math.exp(-t*7)+.15*Math.sin(tau*frequency*3*t)*Math.exp(-t*14))*Math.exp(-t*2);
   else if(kind==='reed')value=(Math.sin(tau*frequency*t+.018*Math.sin(tau*5.5*t))+.28*Math.sin(tau*frequency*3*t))*Math.exp(-t*2.5);
   else if(kind==='reese'){
    for(let h=1;h<=6&&frequency*h<sampleRate*.4;h++)value+=(Math.sin(tau*frequency*.994*h*t)+Math.sin(tau*frequency*1.006*h*t))/(h*h*1.4);
   }else if(kind==='triangle'){
    for(let h=1;h<=9&&frequency*h<sampleRate*.4;h+=2)value+=Math.sin(tau*frequency*h*t)*(h%4===1?1:-1)/(h*h);
   }else if(kind==='fm')value=Math.sin(tau*frequency*t+2.4*Math.exp(-t*7)*Math.sin(tau*frequency*3*t))*Math.exp(-t*3);
   else if(kind==='air')value=(Math.sin(tau*frequency*t+.3*Math.sin(tau*.13*t))+Math.sin(tau*frequency*.998*t)+.35*Math.sin(tau*frequency*3*t))/2.35;
   else if(kind==='sub')value=Math.sin(tau*frequency*t)+.13*Math.sin(tau*frequency*2*t);
   else if(kind==='pad')value=(Math.sin(tau*frequency*t)+.45*Math.sin(tau*frequency*1.003*t)+.18*Math.sin(tau*frequency*2*t))/1.63;
   else for(let h=1;h<=harmonics;h++){
    if(frequency*h>sampleRate*.42)break;
    if(kind==='chip'&&h%2===0)continue;
    value+=Math.sin(tau*frequency*h*t)/(h*h**(kind==='chip'?0: .45));
   }
   const shape=envelope(t,seconds,kind==='air'?.9:kind==='pad'?.25:.004,kind==='air'?1:kind==='pad'?.4:.035);
   return value*shape*(kind==='pluck'?Math.exp(-t*8):kind==='chip'?Math.exp(-t*3):1);
  },level,kind==='air'?.75:kind==='pad'?.35:kind==='fm'?.22:kind==='reed'?.2:kind==='sub'||kind==='electric-bass'||kind==='reese'||kind==='triangle'||kind==='chip'?0:.26);
 };
 // Jazz uses a ii-V-I-vi turnaround with ninths, thirteenths and a separate bass groove.
 const roots=dnb?[38,41,34,36]:chip?[48,43,45,41]:jazz?[38,43,36,45]:[48,53,45,55];
 const melody=dnb?[12,19,22,26,19,15,14,10]:chip?[0,4,7,12,11,7,4,2,0,7,12,16,14,11,7,4]:jazz?[14,15,19,21,22,19,16,14]:[7,14,19,23,16,12,9,4];
 for(let measure=0;measure*bar<duration;measure++){
  const at=measure*bar,root=roots[Math.floor(measure/(jazz?1:2))%roots.length]!,phrase=measure%8;
  const breakdown=measure%16>=12&&measure%16<14;
  const jazzVoicings=[[15,19,22,26],[16,22,26,33],[16,19,23,26],[15,19,22,26]];
  const chordNotes=(jazz?jazzVoicings[measure%4]!:ambient?[12,16,19,23,26]:[12,15,19,26]).map(interval=>root+interval);
  if((ambient||dnb)&&measure%2===0)for(const note of chordNotes)tone(at,note,bar*(ambient?3:2.1),ambient?'air':'pad',ambient?.065:.028);
  if(jazz)for(const offset of (phrase%2?[.5,2.25,3.5]:[0,1.5,2.75]))for(const note of chordNotes)tone(at+offset*beat,note,beat*1.05,'fm',.055);
  if(!ambient&&!breakdown){
   for(const step of (dnb?[0,1.75,2.5]:jazz?[0,1.75,2.5]:[0,2.5]))kick(at+step*beat,jazz?.7:chip?.7:1);
   for(const step of [1,3])snare(at+step*beat,jazz?.7:chip?.65:.9);
   for(let step=0;step<8;step++)hat(at+(step*.5+(jazz&&step%2?.06:0))*beat,step%2===1,step%2?.8:.45);
   if(jazz)for(const step of [.75,2.75])snare(at+step*beat,.18);
   if(phrase===7)for(const step of [3.25,3.5,3.75])snare(at+step*beat,.3+(step-3)*.45);
  }
  const bassSteps=dnb?[0,.75,1.5,2,2.75,3.5]:jazz?[0,.75,1.5,2.25,3,3.75]:ambient?[0]:[0,.75,1.5,2.5,3.25];
  for(const [index,step] of bassSteps.entries()){
   const interval=jazz?[0,7,12,9,7,(roots[(measure+1)%4]!-root)-1][index]!:index%4===3?7:0;
   tone(at+step*beat,root-12+interval,beat*(ambient?3.8:dnb?.55:jazz?.5:.6),chip?'triangle':dnb?'reese':jazz?'electric-bass':'sub',breakdown?.06:ambient?.1:.22);
  }
  const subdivisions=chip?16:ambient?1:jazz?4:8;
  for(let step=0;step<subdivisions;step++){
   if(jazz&&phrase%4===0)continue;
   if(!chip&&!ambient&&(step+measure)%4===3)continue;
   const offset=step*4/subdivisions,note=root+12+melody[(step+phrase*2)%melody.length]!;
   tone(at+(offset+(jazz&&step%2?.08:0))*beat,note,beat*(chip?.22:ambient?2.8:jazz?.8:.7),chip?'chip':ambient?'air':jazz?'reed':'pluck',chip?.09:ambient?.09:jazz?.065:.045);
  }
 }
 // Tempo-synced echo, gentle saturation and DC removal keep voices spacious and bounded.
 const delay=Math.max(1,Math.round(beat*(ambient?1.5:jazz?.5:dnb?.5:.375)*sampleRate));let previous=0,highpass=0;
 for(let i=0;i<length;i++){
  if(i>=delay)send[i]!+=send[i-delay]!*(ambient?.62:jazz?.25:.25);
  const t=i/sampleRate;
  const input=Math.tanh((mix[i]!+send[i]!*.34)*1.25);
  highpass=input-previous+.995*highpass;previous=input;
  const fade=clamp(t/.025,0,1)*clamp((duration-t)/.18,0,1);
  mix[i]=highpass*.78*fade;
 }
 return mix;
}
export function audioBuffer(duration:number,volume:number,style:ScoreStyle='deep'):AudioBuffer {
  const samples=synthesizeTechno(duration,44100,style),buffer=new AudioBuffer({length:samples.length,sampleRate:44100,numberOfChannels:2});
  for(let channel=0;channel<2;channel++){
    const values=buffer.getChannelData(channel);
    for(let i=0;i<samples.length;i++)values[i]=samples[i]!*volume;
  }
  return buffer;
}
export class ScorePlayer {
  private ctx?:AudioContext;
  private source?:AudioBufferSourceNode;
  private gain?:GainNode;
  private buffer?:AudioBuffer;
  private fileData?:string;
  private style:ScoreStyle='deep';
  muted=false;
  private epoch=0;
  async prepare():Promise<void>{
    this.ctx??=new AudioContext();
    await this.ctx.resume();
  }
  async play(duration:number,offset:number,volume:number,style:ScoreStyle='deep',file?:ImportedAudio):Promise<void>{
    this.stop();
    const epoch=this.epoch;await this.prepare();
    if(epoch!==this.epoch)return;
    if(!this.buffer||Math.abs(this.buffer.duration-duration)>.001||this.style!==style||this.fileData!==file?.data){const buffer=file?await importedSoundtrack(file,duration,1):audioBuffer(duration,1,style);if(epoch!==this.epoch)return;this.buffer=buffer;this.style=style;this.fileData=file?.data;}
    this.gain=this.ctx!.createGain();this.gain.gain.value=this.muted?0:volume;this.gain.connect(this.ctx!.destination);
    this.source=this.ctx!.createBufferSource();this.source.buffer=this.buffer;this.source.connect(this.gain);
    this.source.start(0,Math.min(offset,duration-.001));
  }
  setVolume(volume:number){if(this.gain)this.gain.gain.setTargetAtTime(this.muted?0:volume,this.ctx!.currentTime,.02);}
  stop(){this.epoch++;if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=undefined;}this.gain?.disconnect();this.gain=undefined;}
  dispose(){this.stop();void this.ctx?.close();}
}
