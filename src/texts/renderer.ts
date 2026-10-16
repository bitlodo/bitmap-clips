import {fontFamilies,textStyleSchema} from '../text-style';
import {drawTitle,drawFilmHUD,type TitleFrame} from '../title-renderer';
import {type Project,type SceneData} from '../editor-model';
import {itemAlpha} from '../timeline-contract';
import type {TextPlan} from './types';

/** The same text plans render library previews, timeline previews and exports. */
export function drawTextPlan(ctx:CanvasRenderingContext2D,plan:TextPlan,project:Project,data:SceneData,time:number,frame:TitleFrame){
 const style=textStyleSchema.parse({...project.textStyle,...plan.common.textStyleOverride});if(project.textStyle||plan.common.textStyleOverride)project={...project,textStyle:style,accent:style.accent};
  if(plan.identity){const alpha=itemAlpha(plan.common,time*30);if(alpha>0){ctx.save();ctx.globalAlpha*=alpha;drawFilmHUD(ctx,{...project,textScale:plan.common.scale},data,time-plan.common.startFrame/30,frame.width,frame.height);ctx.restore();}return;}
  for(const text of plan.titles)drawTitle(ctx,text,project,data,time,frame);
  if(!plan.labels||!frame.anchor)return;
  const alpha=itemAlpha(plan.common,time*30);if(alpha<=0)return;
  const unit=frame.width/720*plan.common.scale,size=18*unit,cells=new Set<string>();
  ctx.save();ctx.globalAlpha=alpha;ctx.font=`500 ${size}px ${project.textStyle?fontFamilies[project.textStyle.font]:"'Segoe UI',Arial,sans-serif"}`;ctx.textAlign='center';ctx.textBaseline='bottom';
  for(const label of plan.labels){
    const anchor=frame.anchor(label.txIndex);if(!anchor.visible)continue;
    const width=ctx.measureText(label.text).width+12*unit,x=anchor.x,y=anchor.y+size+10*unit;
    if(x-width/2<0||x+width/2>frame.width||y<size||y>frame.height)continue;
    const left=Math.floor((x-width/2)/(32*unit)),right=Math.floor((x+width/2)/(32*unit)),row=Math.floor(y/(28*unit));
    const occupied=Array.from({length:right-left+1},(_,i)=>`${left+i}:${row}`);if(occupied.some(cell=>cells.has(cell)))continue;occupied.forEach(cell=>cells.add(cell));
    ctx.fillStyle=project.textStyle?project.textStyle.panelColor+'db':'#081018db';ctx.fillRect(x-width/2,y-size-4*unit,width,size+8*unit);ctx.fillStyle=project.accent;ctx.fillText(label.text,x,y);
  }
  ctx.restore();
}
