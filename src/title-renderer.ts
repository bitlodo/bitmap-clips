import {fontFamilies} from './text-style';
import { clamp, smooth, titleAlpha, titleContent, type Project, type SceneData, type TitleClip } from './editor-model';
export interface Anchor {x:number;y:number;visible:boolean;}
export interface TitleFrame {width:number;height:number;anchor?:(txIndex:number)=>Anchor;}
const sans="'Segoe UI',Arial,sans-serif";
function wrap(ctx:CanvasRenderingContext2D,text:string,width:number):string[]{
  const lines:string[]=[];
  for(const paragraph of text.split('\n')){
    let line='';for(const word of paragraph.split(' ')){
      if(ctx.measureText(line?line+' '+word:word).width>width&&line){lines.push(line);line='';}
      if(ctx.measureText(word).width>width){for(const char of word){if(ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}}
      else line=line?line+' '+word:word;
    }lines.push(line);
  }return lines;
}
function fitted(ctx:CanvasRenderingContext2D,text:string,width:number,maxHeight:number,size:number,family=sans,weight=600){
  ctx.font=`${weight} ${size}px ${family}`;
  const widestWord=Math.max(0,...text.split(/\s+/).map(word=>ctx.measureText(word).width));
  if(widestWord>width)size*=width*.98/widestWord;
  let lines:string[]=[];for(let pass=0;pass<15;pass++){ctx.font=`${weight} ${size}px ${family}`;lines=wrap(ctx,text,width);if(lines.length*size*1.18<=maxHeight)break;size*=.86;}
  return {lines,size,height:lines.length*size*1.18};
}
function textLines(ctx:CanvasRenderingContext2D,lines:string[],x:number,y:number,size:number){lines.forEach((line,i)=>ctx.fillText(line,x,y+i*size*1.18));}
function frameY(position:TitleClip['position'],height:number,boxHeight:number,margin:number){return position==='top'?margin+55:position==='center'?(height-boxHeight)/2:height-margin-boxHeight;}
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function fadeBackdrop(ctx:CanvasRenderingContext2D,width:number,height:number,y:number,boxHeight:number,paper:boolean,position:TitleClip['position'],panel?:string){
  const padding=Math.max(24,width/720*64),color=panel??(paper?'#f2ede6':'#060a10');
  const top=position==='top'?0:Math.max(0,y-padding);
  const bottom=position==='bottom'?height:Math.min(height,y+boxHeight+padding);
  const g=ctx.createLinearGradient(0,top,0,bottom);
  const transparent=color+'00',opaque=color+(paper?'f2':'ee');
  if(position==='top'){
    g.addColorStop(0,opaque);g.addColorStop(.6,opaque);g.addColorStop(1,transparent);
  }else if(position==='center'){
    g.addColorStop(0,transparent);g.addColorStop(.25,opaque);g.addColorStop(.75,opaque);g.addColorStop(1,transparent);
  }else{
    g.addColorStop(0,transparent);g.addColorStop(.4,opaque);g.addColorStop(1,opaque);
  }
  ctx.fillStyle=g;ctx.fillRect(0,top,width,bottom-top);
}
/** Type sizes follow frame width: a phone sees the same hierarchy in every aspect. */
export function drawTitle(ctx:CanvasRenderingContext2D,clip:TitleClip,project:Project,data:SceneData,time:number,frame:TitleFrame):void{
  const alpha=titleAlpha(clip,time);if(alpha<=0)return;
  const sans=project.textStyle?fontFamilies[project.textStyle.font]:"'Segoe UI',Arial,sans-serif",mono=project.textStyle?fontFamilies[project.textStyle.font]:"'SFMono-Regular',Consolas,monospace";
  const {width:w,height:h}=frame,u=w/720*project.textScale*clip.scale,m=Math.max(w*.055,h*(w<h?.065:.04)),paper=project.background==='paper',ink=project.textStyle?.color??(paper?'#20212a':'#f2f5f5'),muted=project.textStyle?.secondaryColor??(paper?'#555e67':'#bbced4');
  const {text,kicker,txIndex}=titleContent(clip,project,data),age=time-clip.start,enter=clip.animation==='template'?smooth(age/.55):1,offset=clip.animation==='slide'?(1-smooth(age/Math.max(.1,clip.fadeIn)))*24*u:(1-enter)*18*u;
  ctx.save();ctx.globalAlpha=alpha;ctx.textBaseline='top';ctx.textAlign='left';
  if(clip.template==='cinematic'){
    const content=fitted(ctx,text,w-m*2,h*.32,72*u,sans,450),tag=fitted(ctx,kicker,w-m*2,h*.12,24*u,mono,400),boxH=content.height+tag.height+36*u;
    const y=frameY(clip.position,h,boxH,m)+offset;
    fadeBackdrop(ctx,w,h,y,boxH,paper,clip.position,project.textStyle?.panelColor);ctx.textAlign='center';ctx.fillStyle=project.accent;ctx.fillRect(w/2-34*u,y,68*u*enter,2*u);
    ctx.font=`400 ${tag.size}px ${mono}`;ctx.fillStyle=muted;textLines(ctx,tag.lines,w/2,y+15*u,tag.size);
    ctx.beginPath();ctx.rect(m,y+tag.height+30*u,(w-m*2)*enter,content.height+12*u);ctx.clip();
    ctx.font=`450 ${content.size}px ${sans}`;ctx.fillStyle=ink;textLines(ctx,content.lines,w/2,y+tag.height+30*u,content.size);
  }else if(clip.template==='terminal'){
    const panelW=w-m*2,content=fitted(ctx,text,panelW-36*u,h*.3,40*u,mono,450),tag=fitted(ctx,kicker,panelW-36*u,h*.12,22*u,mono,400);
    const boxH=content.height+tag.height+58*u,y=frameY(clip.position,h,boxH,m)+offset;
    ctx.fillStyle=paper?'#e0e6dff5':'#031109f0';ctx.fillRect(m,y,panelW,boxH);ctx.strokeStyle=project.accent;ctx.lineWidth=u;ctx.strokeRect(m,y,panelW,boxH);ctx.fillStyle=project.accent;ctx.fillRect(m,y,panelW*enter,3*u);
    ctx.font=`400 ${tag.size}px ${mono}`;ctx.fillStyle=muted;textLines(ctx,tag.lines,m+18*u,y+17*u,tag.size);
    const chars=clip.animation==='template'?Math.ceil(text.length*clamp(age/Math.min(1.25,clip.duration*.4),0,1)):text.length;ctx.font=`450 ${content.size}px ${mono}`;ctx.fillStyle=project.accent;
    const typed=wrap(ctx,text.slice(0,chars),panelW-36*u),bodyY=y+tag.height+34*u;textLines(ctx,typed,m+18*u,bodyY,content.size);
    if(Math.floor(time*3)%2===0){const last=typed.at(-1)??'',cx=m+18*u+ctx.measureText(last).width;ctx.fillRect(cx+3*u,bodyY+2*u+(typed.length-1)*content.size*1.18,9*u,content.size*.8);}
  }else if(clip.template==='counter'){
    const [headline,...rest]=text.split('\n'),number=headline!.match(/[\d.,]+/),progress=clip.animation==='template'?smooth(age/Math.min(1.15,clip.duration*.4)):1;let display=headline!;
    if(number){const n=Number(number[0].replaceAll(',','')),decimals=number[0].includes('.')?number[0].split('.')[1]!.length:0;if(Number.isFinite(n)&&progress<1)display=headline!.replace(number[0],(n*progress).toLocaleString('en-US',{minimumFractionDigits:Math.min(8,decimals),maximumFractionDigits:Math.min(8,decimals)}));}
    const available=w-m*2-18*u,content=fitted(ctx,display,available,h*.27,112*u,sans,750),secondary=fitted(ctx,rest.join('\n'),available,h*.14,30*u,sans,450),tag=fitted(ctx,kicker,available,h*.11,24*u,mono,400);
    const boxH=content.height+secondary.height+tag.height+27*u,y=frameY(clip.position,h,boxH,m)+offset;
    fadeBackdrop(ctx,w,h,y,boxH,paper,clip.position,project.textStyle?.panelColor);ctx.fillStyle=project.accent;ctx.fillRect(m,y,4*u,boxH);
    ctx.font=`400 ${tag.size}px ${mono}`;ctx.fillStyle=muted;textLines(ctx,tag.lines,m+18*u,y,tag.size);
    ctx.font=`750 ${content.size}px ${sans}`;ctx.fillStyle=ink;textLines(ctx,content.lines,m+18*u,y+tag.height+9*u,content.size);
    ctx.font=`450 ${secondary.size}px ${sans}`;ctx.fillStyle=muted;textLines(ctx,secondary.lines,m+18*u,y+tag.height+content.height+16*u,secondary.size);
  }else if(clip.template==='card'||clip.template==='callout'){
    const isCallout=clip.template==='callout',panelW=Math.min(w-m*2,w*(w<h?.87:.57)),available=panelW-32*u;
    const [first,...rest]=text.split('\n'),headline=fitted(ctx,first!,available,h*.24,52*u,sans,650),secondary=fitted(ctx,rest.join('\n'),available,h*.17,29*u,sans,500),tag=fitted(ctx,kicker,available,h*.13,22*u,mono,400);
    // The card belongs to the screen layout; only its connector follows the parcel.
    const boxH=headline.height+secondary.height+tag.height+48*u,x=m,y=frameY(clip.position,h,boxH,m)+offset;const anchor=isCallout?frame.anchor?.(txIndex):undefined;
    if(anchor?.visible){ctx.strokeStyle=project.accent;ctx.lineWidth=1.2*u;ctx.beginPath();ctx.arc(anchor.x,anchor.y,6*u+3*u*(1-enter),0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);const endX=clamp(anchor.x,x+16*u,x+panelW-16*u);ctx.lineTo(endX,anchor.y);ctx.lineTo(endX,y);ctx.stroke();}
    ctx.fillStyle=paper?'#f8f6f0f8':'#101d25f5';rounded(ctx,x,y,panelW,boxH,5*u);ctx.fill();ctx.strokeStyle=paper?'#333a453c':'#84b2b45c';ctx.lineWidth=u;ctx.stroke();ctx.fillStyle=project.accent;ctx.fillRect(x,y,4*u,boxH*enter);
    ctx.font=`400 ${tag.size}px ${mono}`;ctx.fillStyle=muted;textLines(ctx,tag.lines,x+16*u,y+13*u,tag.size);
    ctx.font=`650 ${headline.size}px ${sans}`;ctx.fillStyle=ink;textLines(ctx,headline.lines,x+16*u,y+tag.height+21*u,headline.size);
    ctx.font=`500 ${secondary.size}px ${sans}`;ctx.fillStyle=muted;textLines(ctx,secondary.lines,x+16*u,y+tag.height+headline.height+27*u,secondary.size);
    ctx.fillStyle=project.accent;ctx.fillRect(x+16*u,y+boxH-12*u,(panelW-32*u)*enter,2*u);
  }else if(clip.template==='poster'){
    const [first,...rest]=text.split('\n'),content=fitted(ctx,first!,w-m*2,h*.32,100*u,sans,800),secondary=fitted(ctx,rest.join('\n'),w-m*2,h*.15,32*u,sans,500),tag=fitted(ctx,kicker,w-m*2,h*.1,24*u,mono,400);
    const boxH=content.height+secondary.height+tag.height+41*u,y=frameY(clip.position,h,boxH,m)+offset;
    ctx.fillStyle=paper?'#f2ede6f5':'#0d151ef4';ctx.fillRect(0,y-12*u,w,boxH+26*u);ctx.fillStyle=project.accent;ctx.fillRect(0,y+6*u,8*u,boxH-10*u);ctx.fillRect(m,y,w-m*2,2*u);
    ctx.font=`400 ${tag.size}px ${mono}`;ctx.fillStyle=muted;textLines(ctx,tag.lines,m,y+11*u,tag.size);
    ctx.font=`800 ${content.size}px ${sans}`;ctx.fillStyle=ink;textLines(ctx,content.lines,m,y+tag.height+23*u,content.size);
    ctx.font=`500 ${secondary.size}px ${sans}`;ctx.fillStyle=muted;textLines(ctx,secondary.lines,m,y+tag.height+content.height+29*u,secondary.size);
  }else{
    const content=fitted(ctx,text,w-m*2-28*u,h*.22,34*u,sans,550),tag=fitted(ctx,kicker,w-m*2-28*u,h*.1,22*u,mono,400);
    ctx.font=`550 ${content.size}px ${sans}`;const bodyWidth=Math.max(...content.lines.map(line=>ctx.measureText(line).width));ctx.font=`400 ${tag.size}px ${mono}`;
    const panelW=Math.min(w-m*2,Math.max(bodyWidth,...tag.lines.map(line=>ctx.measureText(line).width))+28*u),boxH=content.height+tag.height+33*u,y=frameY(clip.position,h,boxH,m)+offset;
    ctx.fillStyle=project.textStyle?project.textStyle.panelColor+'f2':paper?'#f9f6f0f3':'#111e28f2';rounded(ctx,m,y,panelW,boxH,10*u);ctx.fill();ctx.font=`400 ${tag.size}px ${mono}`;ctx.fillStyle=project.accent;textLines(ctx,tag.lines,m+14*u,y+11*u,tag.size);
    ctx.font=`550 ${content.size}px ${sans}`;ctx.fillStyle=ink;textLines(ctx,content.lines,m+14*u,y+tag.height+19*u,content.size);
  }ctx.restore();
}
export function drawFilmHUD(ctx:CanvasRenderingContext2D,project:Project,data:SceneData,time:number,width:number,height:number){
  const mono=project.textStyle?fontFamilies[project.textStyle.font]:"'SFMono-Regular',Consolas,monospace";
  const u=width/720*Math.min(project.textScale,1.25),m=width*.045,paper=project.background==='paper',font=24*u;ctx.save();ctx.textBaseline='top';ctx.font=`${font}px ${mono}`;ctx.fillStyle=project.textStyle?.color??(paper?'#4b4b53':'#c0ced6');
  const identity=`${data.height}.bitmap`;
  if(project.preset==='terminal'){
    ctx.fillStyle=project.accent;ctx.fillText(identity+' / NODE',m,m);ctx.font=`${22*u}px ${mono}`;ctx.fillText(`${data.txCount.toLocaleString('en-US')} TX / IMMUTABLE`,m,m+32*u);
    ctx.strokeStyle=project.accent+'55';ctx.lineWidth=u;ctx.strokeRect(m-10*u,m-10*u,width-m*2+20*u,height-m*2+20*u);
    ctx.textAlign='right';ctx.fillText(Math.floor(time*30).toString().padStart(5,'0'),width-m,m+34*u);
  }else if(project.preset==='editorial'){
    ctx.fillStyle=project.accent;ctx.fillRect(m,m+4*u,12*u,12*u);ctx.fillStyle='#35333a';ctx.fillText(identity,m+22*u,m);ctx.textAlign='right';ctx.font=`${22*u}px ${mono}`;ctx.fillText('BITCOIN',width-m,m+2*u);
  }else if(project.preset==='data-city'){
    ctx.fillStyle=project.accent;ctx.fillText(identity,m,m);ctx.font=`${22*u}px ${mono}`;ctx.fillStyle='#b9d4d9';ctx.fillText(`X ${data.layout.width} / Y ${data.layout.height}`,m,m+32*u);
    for(const [x,y,sx,sy] of [[m,m,1,1],[width-m,m,-1,1],[m,height-m,1,-1],[width-m,height-m,-1,-1]]){ctx.strokeStyle='#6fddd866';ctx.beginPath();ctx.moveTo(x!,y!+sy!*14*u);ctx.lineTo(x!,y!);ctx.lineTo(x!+sx!*14*u,y!);ctx.stroke();}
  }else{ctx.fillText(identity,m,m);ctx.textAlign='right';ctx.font=`${22*u}px ${mono}`;ctx.fillText('BITCOIN',width-m,m+2*u);}
  ctx.font=`${20*u}px ${mono}`;ctx.fillStyle=project.textStyle?.secondaryColor??(paper?'#676467':'#a7bac6');ctx.textAlign='right';ctx.fillText((data.source==='snapshot'?'SNAPSHOT / ':'ON-CHAIN / ')+data.hash.slice(-10),width-m,height-34*u);ctx.restore();
}
