import type { BlockResult } from './lib/block';
import type { BitmapLayout } from './lib/bitmap-layout';

export type ShotKind = 'establish'|'orbit'|'push-in'|'outro'|'dolly'|'truck'|'flyover'|'street'|'focus'|'top';
export type ModelKind = 'hold'|'build'|'destroy'|'rise'|'scatter'|'wave'|'drop'|'isolate'|'highlight'|'pulse'|'scale-rotate';
export interface ModelStyle {material?:MaterialLook;accent?:string;opacity?:number;}
export interface ModelClip {id:string;kind:ModelKind;start:number;duration:number;txIndex:number;strength:number;stagger:number;targetLift?:number;buildOrder?:'sequential'|'random';bounceBack?:number;simulationDuration?:number;emitterRadius?:number;physicsVariant?:string;fallSpeed?:number;seed:number;end:'hold'|'restore';style:ModelStyle|null;fadeIn:number;fadeOut:number;}
export interface FadeClip {id:string;kind:'fade-in'|'fade-out';start:number;duration:number;color:string;}
export type EditorClip = Shot|TitleClip|ModelClip|FadeClip;
export type Preset = 'monument'|'data-city'|'terminal'|'editorial';
export type Aspect = '16:9'|'1:1'|'9:16';
export type TextTemplate = 'cinematic'|'terminal'|'counter'|'card'|'callout'|'poster'|'caption';
export type Binding = 'identity'|'transactions'|'volume'|'transaction'|'date'|'size'|'fees'|'density'|'share'|'outro';
export type MaterialLook = 'solid'|'neon'|'wireframe'|'hologram';
export type ScoreStyle = 'deep'|'pulse'|'acid'|'minimal'|'ambient'|'jazz';
export interface SceneData {
  height:number;hash:string;timestamp:number;bytes:number;fees:number|null;totalSats:string;txCount:number;
  layout:BitmapLayout;source:'live'|'snapshot';checkedAt:string;
}
export interface CameraSettings {
  yawStart:number;yawEnd:number;elevation:number;elevationEnd:number;distanceStart:number;distanceEnd:number;fov:number;travel:number;
  compositionLift?:number;target:'block'|'parcel'|'flow';ease:'smooth'|'linear';transition:'blend'|'cut';blend:number;
  zoomIn?:{duration:number;distance:number};linearYaw?:boolean;
}
export interface Shot { id:string;kind:ShotKind;start:number;duration:number;txIndex:number;camera:CameraSettings; }
export interface TitleClip {
  id:string;label:string;text:string;kicker:string;start:number;duration:number;position:'bottom'|'center'|'top';
  template:TextTemplate;binding:Binding|null;sourceBinding:Binding|null;shotId:string|null;txIndex:number;scale:number;animation:'template'|'fade'|'slide'|'none';fadeIn:number;fadeOut:number;
}
export interface Project {
 textStyle?:import('./text-style').TextStyle;
 displayMotion?:{kind:'none'|'pulse'|'wave';speed:number;intensity:number};
 cubeType?:import('./cube-geometry').CubeType;
 cameraType?:'perspective'|'isometric';
 cameraSettings?:{cameraA?:import('./camera-settings').CameraSetting;cameraB?:import('./camera-settings').CameraSetting;rotation?:'none'|'rotating';zoomMode?:'none'|'zoom-in'|'zoom-out';animation?:'none'|'fixed'|'rotating'|'zoom-in';animationSpeed?:number;zoomStrength?:number;zoomEasing?:import('./easing').EasingName;interpolation?:'linear'};
  vignette?:number;backgroundColor?:string;lightIntensity?:number;ambientIntensity?:number;rimIntensity?:number;shadowOpacity?:number;
  fog?:boolean;fogNear?:number;fogFar?:number;lightRotation?:number;
  version:4;duration:number;aspect:Aspect;preset:Preset;accent:string;scanlines:boolean;grid:boolean;
  material:MaterialLook;background:'void'|'studio'|'paper';bloom:number;shadows:boolean;score:ScoreStyle;
  music:boolean;volume:number;textScale:number;shots:Shot[];titles:TitleClip[];models:ModelClip[];fades:FadeClip[];
}
export const uid=()=>crypto.randomUUID();
export const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
export const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*t*(t*(t*6-15)+10);};
export const shotNames:Record<ShotKind,string>={establish:'Opening shot',orbit:'Orbit', 'push-in':'Zoom in',outro:'Zoom out',dolly:'Dolly / push in',truck:'Sideways tracking',flyover:'Flyover',street:'Parcel fly-through',focus:'Transaction focus',top:'Top view'};
export const modelNames:Record<ModelKind,string>={hold:'Static model / style',build:'Build',destroy:'Disassembly',rise:'Vertical assembly',scatter:'Radial assembly',wave:'Wave assembly',drop:'Physics stream / faucet',isolate:'Isolate transaction',highlight:'Highlight transaction','scale-rotate':'Scale & Rotate',pulse:'Cube pulse'};
export const fadeNames:Record<FadeClip['kind'],string>={'fade-in':'Fade in','fade-out':'Fade out'};
export const isTitleClip=(c:EditorClip):c is TitleClip=>'text' in c;
export const isCameraClip=(c:EditorClip):c is Shot=>'camera' in c;
export const isModelClip=(c:EditorClip):c is ModelClip=>'strength' in c;
export const isFadeClip=(c:EditorClip):c is FadeClip=>'color' in c;
export const allClips=(p:Project):EditorClip[]=>[...p.shots,...p.models,...p.titles,...p.fades];
export function makeModel(kind:ModelKind,start:number,duration:number,txIndex:number):ModelClip{return {id:uid(),kind,start,duration:kind==='drop'?Math.min(8,duration):duration,txIndex,strength:1,stagger:.35,seed:42,end:['isolate','highlight','pulse','hold'].includes(kind)?'restore':'hold',style:null,fadeIn:['highlight','isolate'].includes(kind)?.3:0,fadeOut:['highlight','isolate'].includes(kind)?.3:0};}
export function makeFade(kind:FadeClip['kind'],start:number,duration:number):FadeClip{return {id:uid(),kind,start,duration,color:'#000000'};}
export const textTemplates:Record<TextTemplate,{name:string;description:string;glyph:string}>={
  cinematic:{name:'Cinematic title',description:'Large title · mask and tracking',glyph:'Aa'},
  terminal:{name:'Terminal title',description:'Typewriter · prompt · cursor',glyph:'>_'},
  counter:{name:'Transaction counter',description:'Animated number · clear hierarchy',glyph:'128'},
  card:{name:'Information card',description:'Data panel · lines and accent',glyph:'▤'},
  callout:{name:'Transaction callout',description:'Label linked to a parcel',glyph:'⌖'},
  poster:{name:'Poster title',description:'Editorial typography · graphic band',glyph:'B.'},
  caption:{name:'Text badge',description:'Compact caption · badge',glyph:'[ T ]'},
};
export const availableScores=['deep','acid','ambient','jazz'] as const;
export const scores:Record<ScoreStyle,{name:string;bpm:number}>={deep:{name:'Liquid Drum & Bass',bpm:172},acid:{name:'Chiptune',bpm:128},ambient:{name:'Ambient Electronica',bpm:96},jazz:{name:'Jazz Fusion',bpm:108},pulse:{name:'Jazz Fusion',bpm:108},minimal:{name:'Jazz Fusion',bpm:108}};
interface Direction {name:string;description:string;tag:string;glyph:string;accent:string;material:MaterialLook;background:Project['background'];bloom:number;shadows:boolean;grid:boolean;scanlines:boolean;score:ScoreStyle;template:TextTemplate;kinds:readonly ShotKind[];weights:readonly number[];}
export const presets:Record<Preset,Direction>={
  monument:{name:'Monument',description:'Sculpture · dramatic light · slow movement',tag:'CINEMATIC',glyph:'◒',accent:'#e8b16c',material:'solid',background:'void',bloom:.08,shadows:true,grid:false,scanlines:false,score:'deep',template:'cinematic',kinds:['establish','orbit','focus','outro'],weights:[.27,.25,.26,.22]},
  'data-city':{name:'Data City',description:'Between parcels · neon · spatial information',tag:'IMMERSIVE',glyph:'▥',accent:'#60efdc',material:'neon',background:'void',bloom:.48,shadows:false,grid:true,scanlines:false,score:'pulse',template:'card',kinds:['flyover','street','focus','truck','outro'],weights:[.23,.18,.24,.17,.18]},
  terminal:{name:'Terminal title',description:'Reconstruction · wireframe · diagnostics',tag:'CYPHERPUNK',glyph:'>_',accent:'#91ff99',material:'wireframe',background:'void',bloom:.28,shadows:false,grid:true,scanlines:true,score:'acid',template:'terminal',kinds:['establish','top','focus','orbit','outro'],weights:[.25,.22,.22,.15,.16]},
  editorial:{name:'Editorial',description:'Solid forms · cuts · expressive typography',tag:'GRAPHIC',glyph:'E.',accent:'#f06437',material:'solid',background:'paper',bloom:0,shadows:true,grid:false,scanlines:false,score:'minimal',template:'poster',kinds:['top','truck','focus','outro'],weights:[.24,.23,.27,.26]},
};
export function btc(sats:string|number,digits=2):string {const v=BigInt(sats);return (v/100_000_000n).toLocaleString('en-US')+(digits?'.'+(v%100_000_000n).toString().padStart(8,'0').slice(0,digits):'');}
export function sceneFromBlock(r:BlockResult):SceneData{return {height:r.height,hash:r.block.hash,timestamp:r.block.time,bytes:r.block.size,fees:typeof r.info.total_fee==='number'?r.info.total_fee:null,totalSats:r.layout.parcels.reduce((v,p)=>v+BigInt(p.totalSats),0n).toString(),txCount:r.block.txCount,layout:r.layout,source:'live',checkedAt:r.checkedAt};}
export function largestParcel(data:SceneData):number {const list=data.layout.parcels.filter(p=>p.txIndex!==0);return (list.length?list:data.layout.parcels).reduce((best,p)=>BigInt(p.totalSats)>BigInt(best.totalSats)?p:best).txIndex;}
export function featuredParcels(data:SceneData):number[]{
  const largest=largestParcel(data),center=data.layout.parcels.filter(p=>p.txIndex!==0&&p.txIndex!==largest).sort((a,b)=>Math.hypot(a.x-data.layout.width/2,a.y-data.layout.height/2)-Math.hypot(b.x-data.layout.width/2,b.y-data.layout.height/2))[0];
  return [largest,center?.txIndex??largest,0];
}
export function infoBlocks(data:SceneData,txIndex:number){
  const tx=data.layout.parcels.find(p=>p.txIndex===txIndex)??data.layout.parcels[0]!;
  const density=data.layout.parcels.reduce((sum,p)=>sum+(p.size-.5)**2,0)/(data.layout.width*data.layout.height)*100;
  const total=BigInt(data.totalSats),share=total?Number(BigInt(tx.totalSats)*10000n/total)/100:0;
  const blocks:{key:Binding;label:string;kicker:string;text:string}[]=[
    {key:'identity',label:'Identity',kicker:'ONE BLOCK. ONE UNIVERSE.',text:`${data.height}.bitmap`},
    {key:'transactions',label:'Transactions',kicker:'ON-CHAIN ACTIVITY',text:`${data.txCount.toLocaleString('en-US')}\ntransactions in this block`},
    {key:'volume',label:'Output value',kicker:'TOTAL OUTPUT VALUE',text:`${btc(data.totalSats)} BTC\nIncludes change and coinbase.`},
    {key:'transaction',label:'Transaction spotlight',kicker:`TRANSACTION #${tx.txIndex} / ${data.height}`,text:`${btc(tx.totalSats)} BTC\nParcel #${tx.txIndex} · ${tx.size} × ${tx.size}`},
    {key:'date',label:'Block date',kicker:'RECORDED ON BITCOIN',text:new Date(data.timestamp*1000).toLocaleDateString('en-US',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'})},
    {key:'size',label:'Block size',kicker:'IMMUTABLE DATA',text:`${(data.bytes/1e6).toLocaleString('en-US',{maximumFractionDigits:2})} MB\nRecorded on-chain.`},
    {key:'density',label:'Layout density',kicker:'BITMAP TOPOLOGY',text:`${density.toLocaleString('en-US',{maximumFractionDigits:1})}%\ngeometric occupancy`},
    {key:'share',label:'Parcel share',kicker:`PARCEL #${tx.txIndex} / OUTPUT VALUE`,text:`${share.toLocaleString('en-US',{maximumFractionDigits:2})}%\nof this block’s outputs`},
    {key:'outro',label:'Ending',kicker:'BUILT ON BITCOIN',text:`${data.height}.bitmap\nYour block. Your story.`},
  ];
  if(data.fees!==null)blocks.splice(4,0,{key:'fees',label:'Block fees',kicker:'FEES PAID TO MINERS',text:`${btc(data.fees,8)} BTC`});return blocks;
}
export function cameraDefaults(kind:ShotKind,preset:Preset='monument'):CameraSettings{
  const c:CameraSettings={yawStart:42,yawEnd:65,elevation:46,elevationEnd:46,distanceStart:1.08,distanceEnd:1,fov:38,travel:.45,target:'block',ease:'smooth',transition:preset==='editorial'?'cut':'blend',blend:preset==='terminal'?.65:1};
  if(kind==='establish'){c.distanceStart=1.3;c.distanceEnd=1;c.yawStart=25;c.yawEnd=45;}
  if(kind==='orbit'){c.yawEnd=preset==='data-city'?150:112;c.distanceStart=1;c.distanceEnd=1;}
  if(kind==='push-in'){c.distanceStart=1.35;c.distanceEnd=.65;}
  if(kind==='outro'){c.yawStart=110;c.yawEnd=128;c.distanceStart=.85;c.distanceEnd=1.2;}
  if(kind==='top'){c.elevation=88;c.yawStart=0;c.yawEnd=preset==='terminal'?12:0;c.fov=32;}
  if(kind==='focus'){c.target='parcel';c.distanceStart=1.25;c.distanceEnd=1;c.elevation=38;c.yawStart=50;c.yawEnd=95;}
  if(kind==='flyover'){c.elevation=58;c.yawStart=12;c.yawEnd=32;c.distanceStart=.75;c.distanceEnd=.8;c.travel=.7;}
  if(kind==='street'){c.elevation=14;c.distanceStart=.22;c.distanceEnd=.24;c.yawStart=35;c.yawEnd=60;c.fov=58;c.travel=.75;}
  if(kind==='truck'){c.elevation=preset==='editorial'?62:26;c.distanceStart=.95;c.distanceEnd=.95;c.yawEnd=c.yawStart;c.travel=.6;}
  if(kind==='dolly'){c.elevation=24;c.distanceStart=.9;c.distanceEnd=.35;c.fov=48;}
  c.elevationEnd=c.elevation;return c;
}
export function makeShot(kind:ShotKind,start:number,duration:number,txIndex:number,preset:Preset):Shot{return {id:uid(),kind,start,duration,txIndex,camera:cameraDefaults(kind,preset)};}
export function createProject(data:SceneData,preset:Preset='monument',duration=20):Project{
  const d=presets[preset],features=featuredParcels(data);duration=clamp(duration,5,60);let start=0;
  const shots=d.kinds.map((requested,i)=>{const kind=data.txCount<8&&(requested==='street'||requested==='flyover')?'orbit':requested;
    const shot=makeShot(kind,start,duration*d.weights[i]!,features[kind==='truck'?1:0]!,preset);start+=shot.duration;return shot;});
  const focus=shots.find(s=>s.kind==='focus')!;
  const montage:ModelKind=preset==='data-city'?'rise':preset==='terminal'?'wave':preset==='editorial'?'scatter':'build';
  const models=[makeModel(montage,0,Math.min(3,duration*.2),features[0]!),makeModel(preset==='terminal'?'isolate':'highlight',focus.start,focus.duration,focus.txIndex)];
  if(preset==='terminal')models.push(makeModel('destroy',duration-Math.min(1.5,duration*.15),Math.min(1.5,duration*.15),features[0]!));
  const project:Project={version:4,duration,aspect:'16:9',preset,accent:d.accent,material:d.material,background:d.background,bloom:d.bloom,shadows:d.shadows,grid:d.grid,scanlines:d.scanlines,score:d.score,music:true,volume:.65,textScale:1,shots,titles:[],models,fades:[makeFade('fade-in',0,.4),makeFade('fade-out',duration-.6,.6)]};
  project.titles=shots.map((s,i)=>{
    const binding:Binding=i===0?'identity':i===shots.length-1?'outro':s.kind==='focus'?'transaction':preset==='terminal'?'density':s.kind==='truck'?'volume':'transactions';
    const b=infoBlocks(data,s.txIndex).find(b=>b.key===binding)!;
    const template:TextTemplate=s.kind==='focus'?(preset==='terminal'?'terminal':'callout'):preset==='monument'&&i===1?'caption':preset==='editorial'&&i===1?'counter':preset==='data-city'&&i===1?'counter':d.template;
    const inset=Math.min(.16,s.duration*.07);
    return {id:uid(),label:b.label,text:b.text,kicker:b.kicker,start:s.start+inset,duration:s.duration-inset*2,position:preset==='editorial'?'top':'bottom',template,binding,sourceBinding:binding,txIndex:s.txIndex,shotId:null,scale:1,animation:'template',fadeIn:.32,fadeOut:.32};
  });return project;
}
export function titleContent(title:TitleClip,_project:Project,data:SceneData){
  const block=title.binding?infoBlocks(data,title.txIndex).find(b=>b.key===title.binding):undefined;
  return {text:block?.text??title.text,kicker:block?.kicker??title.kicker,txIndex:title.txIndex};
}
export function retime(project:Project,duration:number):void{const next=clamp(duration,5,60),ratio=next/project.duration;for(const c of allClips(project)){c.duration=clamp(c.duration*ratio,1/30,isModelClip(c)&&c.kind==='drop'?Math.min(8,next):next);c.start=clamp(c.start*ratio,0,next-c.duration);}project.duration=next;}
export function dimensions(aspect:Aspect,quality:'720'|'1080'):[number,number]{const short=Number(quality),long=short===720?1280:1920;return aspect==='16:9'?[long,short]:aspect==='9:16'?[short,long]:[short,short];}
export function activeShot(project:Project,time:number):Shot{const sorted=[...project.shots].sort((a,b)=>a.start-b.start);return [...sorted].reverse().find(s=>time>=s.start&&time<s.start+s.duration)??[...sorted].reverse().find(s=>s.start<=time)??sorted[0]!;}
export function clipEnvelope(c:{start:number;duration:number;fadeIn:number;fadeOut:number},time:number):number{const age=time-c.start;return (c.fadeIn>0?smooth(age/Math.min(c.fadeIn,c.duration/2)):1)*(c.fadeOut>0?smooth((c.duration-age)/Math.min(c.fadeOut,c.duration/2)):1);}
export function titleAlpha(c:TitleClip,time:number):number{return time<c.start||time>=c.start+c.duration?0:clipEnvelope(c,time);}
export function moveClip(clip:{start:number;duration:number},start:number,duration:number,projectDuration:number):void{clip.duration=clamp(duration,.3,projectDuration);clip.start=clamp(start,0,projectDuration-clip.duration);}
/** Camera edits affect the exclusive camera sequence only. */
export function moveScene(project:Project,shot:Shot,start:number,duration:number):void{
  const ordered=[...project.shots].sort((a,b)=>a.start-b.start),others=ordered.filter(s=>s!==shot);
  const index=others.filter(s=>s.start<start-.001).length;others.splice(index,0,shot);project.shots=others;
  const neighbor=others[index+1]??others[index-1];
  if(neighbor){const minimum=Math.min(.3,neighbor.duration),next=clamp(duration,1/30,shot.duration+neighbor.duration-minimum),delta=next-shot.duration;shot.duration=next;neighbor.duration-=delta;}
  reflowCameras(project);
}
export function reflowCameras(p:Project){let start=0;for(const s of p.shots){s.start=start;start+=s.duration;}}
export function insertCamera(p:Project,shot:Shot,at:number){
 const current=activeShot(p,at),end=current.start+current.duration,minimum=Math.min(.3,current.duration);at=clamp(at,current.start,end-minimum);shot.start=at;shot.duration=Math.min(shot.duration,end-at);
 const pieces:Shot[]=[];if(at-current.start>=.3)pieces.push({...structuredClone(current),duration:at-current.start});else{shot.start=current.start;shot.duration+=at-current.start;}
 pieces.push(shot);const remaining=end-shot.start-shot.duration;if(remaining>=.3)pieces.push({...structuredClone(current),id:uid(),start:shot.start+shot.duration,duration:remaining});else shot.duration+=Math.max(0,remaining);
 p.shots=p.shots.flatMap(s=>s.id===current.id?pieces:[s]);reflowCameras(p);return shot;
}
export function removeCamera(p:Project,shot:Shot){if(p.shots.length===1)return;const index=p.shots.indexOf(shot),neighbor=p.shots[index+1]??p.shots[index-1]!;neighbor.duration+=shot.duration;p.shots=p.shots.filter(s=>s!==shot);reflowCameras(p);}
export function normalizeCameras(p:Project){
 const old=p.shots;if(!Array.isArray(old)||!old.length)return;
 const points=[...new Set([0,p.duration,...old.flatMap(s=>[clamp(s.start,0,p.duration),clamp(s.start+s.duration,0,p.duration)])])].sort((a,b)=>a-b),used=new Set<string>(),result:Shot[]=[];let previousSource='';
 for(let i=0;i<points.length-1;i++){const start=points[i]!,end=points[i+1]!;if(end-start<1/30-.000001)continue;const source=activeShot(p,(start+end)/2),previous=result.at(-1);
  if(previous&&previousSource===source.id)previous.duration=end-previous.start;
  else{result.push({...structuredClone(source),id:used.has(source.id)?uid():source.id,start,duration:end-start});used.add(source.id);}previousSource=source.id;
 }if(result.length){result[0]!.start=0;for(let i=0;i<result.length-1;i++)result[i]!.duration=result[i+1]!.start-result[i]!.start;result.at(-1)!.duration=p.duration-result.at(-1)!.start;p.shots=result;}
}
export function resizeFilm(p:Project,duration:number){
 const next=clamp(duration,5,60);if(next===p.duration)return;
 const endFade=p.fades.find(f=>f.kind==='fade-out'&&Math.abs(f.start+f.duration-p.duration)<.001);
 if(next>p.duration)p.shots.at(-1)!.duration+=next-p.duration;
 else{p.shots=p.shots.filter(s=>s.start<=next-1/30);p.shots.at(-1)!.duration=next-p.shots.at(-1)!.start;
 p.models=p.models.filter(c=>c.start<=next-1/30);p.titles=p.titles.filter(c=>c.start<=next-1/30);p.fades=p.fades.filter(c=>c.start<=next-1/30||c===endFade);
 for(const c of [...p.models,...p.titles,...p.fades])if(c!==endFade)c.duration=Math.min(c.duration,next-c.start);}
 if(endFade){endFade.duration=Math.min(endFade.duration,next);endFade.start=next-endFade.duration;}p.duration=next;
}
export function snapTime(value:number,project:Project,excludeId:string,tolerance:number):number{
  const scene=project.shots.find(s=>s.id===excludeId);const targets=[0,project.duration,...allClips(project).filter(c=>c.id!==excludeId&&(!scene||!('shotId'in c)||c.shotId!==scene.id)).flatMap(c=>[c.start,c.start+c.duration])];
  const closest=targets.reduce((best,t)=>Math.abs(t-value)<Math.abs(best-value)?t:best,Infinity);
  return Math.abs(closest-value)<=tolerance?closest:Math.round(value*30)/30;
}

export function parseProject(value:unknown):{project:Project;data:SceneData}{
  if(!value||typeof value!=='object')throw Error('Invalid project file.');
  let {project:p,data:d}=value as {project:any;data:SceneData};
  // Saved v1 edits are imported into the new contract without retaining the old UI.
  if((p as unknown as {version:number})?.version===1){
    const old=p as unknown as Record<string,any>,mapped:Preset=old.preset==='architect'?'editorial':old.preset==='overdrive'?'data-city':'monument',dir=presets[mapped];
    p={...old,version:2,preset:mapped,material:dir.material,background:dir.background,bloom:dir.bloom,shadows:dir.shadows,score:dir.score,textScale:1,
      shots:Array.isArray(old.shots)?old.shots.map((s:any)=>({...s,camera:{...cameraDefaults(s.kind==='reveal'?'establish':s.kind,mapped),context:s.kind==='focus'?'isolate':'keep'}})):old.shots,
      titles:Array.isArray(old.titles)?old.titles.map((t:any)=>{const {style,...clip}=t;return {...clip,template:style==='stat'?'counter':style==='caption'?'caption':'cinematic',binding:null,shotId:null};}):old.titles};
  }
  if(p?.version===2&&p.textScale===undefined)p={...p,textScale:1};
  if(p?.version===2){
    const models:ModelClip[]=[];
    const shots=Array.isArray(p.shots)?p.shots.map((s:any)=>{
      if(s.kind==='reveal')models.push(makeModel('build',s.start,Math.max(1/30,s.duration*.45),s.txIndex));
      const context=s.camera?.context;
      if(!['keep','dim','isolate'].includes(context))throw Error('Invalid legacy camera context.');
      if(context!=='keep'&&s.camera.target==='parcel')models.push(makeModel(context==='isolate'?'isolate':'highlight',s.start,s.duration,s.txIndex));
      const {context:removed,...camera}=s.camera;
      return {...s,kind:s.kind==='reveal'?'establish':s.kind,camera};
    }):p.shots;
    p={...p,version:3,shots,models,fades:[]};
  }
  if(p?.version===3){
    p={...p,version:4,shots:p.shots?.map((s:Shot)=>({...s,camera:{...s.camera,elevationEnd:s.camera.elevation}})),models:p.models?.map((m:ModelClip)=>({...makeModel(m.kind,m.start,m.duration,m.txIndex),...m,style:null})),titles:p.titles?.map((t:TitleClip)=>({...t,txIndex:p.shots?.find((s:Shot)=>s.id===t.shotId)?.txIndex??largestParcel(d),shotId:null,sourceBinding:t.sourceBinding??t.binding??infoBlocks(d,0).find(b=>b.label===t.label)?.key??null,scale:1,animation:'template',fadeIn:.32,fadeOut:.32}))};
    normalizeCameras(p);
  }
  const finite=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  const str=(s:unknown,max:number)=>typeof s==='string'&&s.length<=max;
  if(!p||p.version!==4||!finite(p.duration,5,60)||!['16:9','1:1','9:16'].includes(p.aspect)||!Object.hasOwn(presets,p.preset)||!/^#[\da-f]{6}$/i.test(p.accent)||!finite(p.volume,0,1)||!finite(p.textScale,.8,1.6)||!finite(p.bloom,0,1)||![p.music,p.scanlines,p.grid,p.shadows].every(v=>typeof v==='boolean')||!['solid','neon','wireframe','hologram'].includes(p.material)||!['void','studio','paper'].includes(p.background)||!Object.hasOwn(scores,p.score)||!Array.isArray(p.shots)||!p.shots.length||p.shots.length>100||!['titles','models','fades'].every(key=>Array.isArray(p[key])&&p[key].length<=100))throw Error('Invalid project settings.');
  if(!d||!finite(d.height,0,100_000_000)||!Number.isInteger(d.height)||!/^[a-f0-9]{64}$/.test(d.hash)||!finite(d.timestamp,0,10_000_000_000)||!finite(d.bytes,1,10_000_000)||!(d.fees===null||finite(d.fees,0,Number.MAX_SAFE_INTEGER))||!/^\d{1,30}$/.test(d.totalSats)||!str(d.checkedAt,100)||!['live','snapshot'].includes(d.source)||!d.layout||!finite(d.layout.width,1,10000)||!finite(d.layout.height,1,10000)||!Array.isArray(d.layout.parcels)||!d.layout.parcels.length||d.layout.parcels.length>100000||d.txCount!==d.layout.parcels.length)throw Error('Invalid bitmap data.');
  const txs=new Set<number>(),ids=new Set<string>();
  for(const x of d.layout.parcels){if(!finite(x.txIndex,0,d.txCount-1)||!Number.isInteger(x.txIndex)||txs.has(x.txIndex)||!/^[a-f0-9]{64}$/.test(x.txid)||!/^\d{1,30}$/.test(x.totalSats)||!finite(x.size,1,100)||!finite(x.x,0,d.layout.width)||!finite(x.y,0,d.layout.height)||x.x+x.size>d.layout.width||x.y+x.size>d.layout.height)throw Error('Invalid bitmap geometry.');txs.add(x.txIndex);}
  for(const c of allClips(p)){if(!str(c.id,100)||ids.has(c.id)||!finite(c.start,0,p.duration)||!finite(c.duration,1/30-.000001,p.duration)||c.start+c.duration>p.duration+.001)throw Error('Invalid timeline.');ids.add(c.id);}
  for(const s of p.shots){const c=s.camera;if(!Object.hasOwn(shotNames,s.kind)||!txs.has(s.txIndex)||!c||!finite(c.yawStart,-720,720)||!finite(c.yawEnd,-720,720)||!finite(c.elevation,10,89)||!finite(c.elevationEnd,10,89)||!finite(c.distanceStart,.1,3)||!finite(c.distanceEnd,.1,3)||!finite(c.fov,20,80)||!finite(c.travel,0,1)||!finite(c.blend,0,3)||!['block','parcel','flow'].includes(c.target)||!['smooth','linear'].includes(c.ease)||!['blend','cut'].includes(c.transition)||'context' in c)throw Error('Invalid camera shot.');}
  for(const s of p.shots){const c=s.camera;if((c.linearYaw!==undefined&&typeof c.linearYaw!=='boolean')||(c.zoomIn!==undefined&&(!c.zoomIn||!finite(c.zoomIn.duration,.1,s.duration)||!finite(c.zoomIn.distance,.1,3))))throw Error('Invalid camera approach.');}
  const ordered=[...p.shots].sort((a:Shot,b:Shot)=>a.start-b.start);let cameraEnd=0;for(const s of ordered){if(Math.abs(s.start-cameraEnd)>.001)throw Error('Cameras must form a sequence without overlap.');cameraEnd=s.start+s.duration;}if(Math.abs(cameraEnd-p.duration)>.001)throw Error('Incomplete camera sequence.');
  for(const m of p.models){if(!Object.hasOwn(modelNames,m.kind)||!txs.has(m.txIndex)||!finite(m.strength,.1,m.kind==='drop'&&m.simulationDuration!==undefined?4:2)||!finite(m.stagger,0,.9)||(m.targetLift!==undefined&&!finite(m.targetLift,0,20000))||(m.bounceBack!==undefined&&!finite(m.bounceBack,0,.6))||(m.emitterRadius!==undefined&&!finite(m.emitterRadius,.02,.5))||(m.fallSpeed!==undefined&&!finite(m.fallSpeed,.5,5))||!finite(m.seed,0,999999)||!Number.isInteger(m.seed)||(m.kind==='drop'&&m.simulationDuration===undefined&&m.duration>8)||(m.simulationDuration!==undefined&&(!finite(m.simulationDuration,1/30,60)))||!['hold','restore'].includes(m.end)||!finite(m.fadeIn,0,3)||!finite(m.fadeOut,0,3))throw Error('Invalid model effect.');const s=m.style;if(s!==null&&(!s||typeof s!=='object'||Object.keys(s).some(k=>!['material','accent','opacity'].includes(k))||(s.material!==undefined&&!['solid','neon','wireframe','hologram'].includes(s.material))||(s.accent!==undefined&&!/^#[\da-f]{6}$/i.test(s.accent))||(s.opacity!==undefined&&!finite(s.opacity,0,1))))throw Error('Invalid local style.');}
  for(const f of p.fades){if(!Object.hasOwn(fadeNames,f.kind)||!/^#[\da-f]{6}$/i.test(f.color))throw Error('Invalid fade.');}
  const shotIds=new Set(p.shots.map((s:Shot)=>s.id)),bindings=new Set(infoBlocks(d,0).map(b=>b.key));
  for(const t of p.titles){if(!str(t.text,500)||!str(t.kicker,100)||!str(t.label,100)||!Object.hasOwn(textTemplates,t.template)||!['bottom','top','center'].includes(t.position)||!(t.binding===null||bindings.has(t.binding))||!(t.sourceBinding===null||bindings.has(t.sourceBinding))||!(t.shotId===null||shotIds.has(t.shotId))||!txs.has(t.txIndex)||!finite(t.scale,.5,1.6)||!['template','fade','slide','none'].includes(t.animation)||!finite(t.fadeIn,0,3)||!finite(t.fadeOut,0,3))throw Error('Invalid text.');}
  return {project:p,data:d};
}
