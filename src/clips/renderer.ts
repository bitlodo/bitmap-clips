import type {RenderQualityProfile} from '../render-quality';
import {stylePreviewProject,type StyleView} from '../scene-style';
import {FilmRenderer} from '../film-renderer';
import {sampleCamera} from '../camera-motion';
import {buildClip,settingsFor} from './registry';
import {activeClip,totalFrames,fadeAmount,type Film} from './film';
import type {ClipPlan} from './types';
import {buildText} from '../texts/registry';
import {drawTextPlan} from '../texts/renderer';
import type {TextPlan} from '../texts/types';
import {createProject,type SceneData,type Project} from '../editor-model';

/** One local plan at a time. A clip cannot leak held model/style into its neighbor. */
export class ClipFilmRenderer {
  get maxRenderSize(){return this.engine.maxRenderSize;}
  private engine:FilmRenderer;
  private plans=new Map<string,ClipPlan>();
  private textKey='';private texts:TextPlan[]=[];
  private backgrounds=new Map<string,Project>();
  private modelVisible=false;
  constructor(public canvas:HTMLCanvasElement,public data:SceneData,onError:(message:string)=>void,onProcessing:()=>void=()=>{}){this.engine=new FilmRenderer(canvas.ownerDocument.createElement('canvas'),data,onError,onProcessing);}
  plan(p:Film,c:Film['clips'][number],aspect=this.canvas.width/this.canvas.height) {
    const preceding=p.clips.filter(item=>item.id!==c.id&&item.startFrame+item.durationFrames<=c.startFrame).sort((a,b)=>a.startFrame-b.startFrame);
    const key=JSON.stringify([p.look,p.sceneStyle,c,preceding,aspect]);let plan=this.plans.get(key);
    if(!plan){
      const settings=settingsFor(c.type,c.settings),inherit=preceding.length>0&&settings.inheritLastCamera===true;
      plan=buildClip({data:this.data,look:p.look,sceneStyle:p.sceneStyle},inherit?{...c,settings:{...settings,cameraA:undefined,cameraB:undefined}}:c);
      const previous=preceding.at(-1);
      if(inherit){
        if(previous){
          const previousPlan=this.plan(p,previous,aspect),last=sampleCamera(this.data,previousPlan.engine,(previous.durationFrames-1)/30,aspect);
          plan.engine.cameraSettings={...plan.engine.cameraSettings,cameraA:{position:last.position.toArray(),target:last.target.toArray(),fov:last.fov},cameraB:undefined};
        }
      }
      if(this.plans.size>80)this.plans.clear();this.plans.set(key,plan);
    }
    return plan;
  }
  background(p:Film){const key=JSON.stringify([p.look,p.sceneStyle]);let project=this.backgrounds.get(key);if(!project){project=createProject(this.data,p.look);Object.assign(project,p.sceneStyle);project.shots=[];project.models=[];project.titles=[];project.fades=[];if(this.backgrounds.size>40)this.backgrounds.clear();this.backgrounds.set(key,project);}return project;}
  renderStyle(p:Film,view:StyleView,width:number,height:number,quality?:RenderQualityProfile){
   this.engine.render(stylePreviewProject(this.data,p.look,p.sceneStyle,view),2,width,height,undefined,false,quality,view.pan,true);
   if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;
   const ctx=this.canvas.getContext('2d')!;ctx.clearRect(0,0,width,height);ctx.drawImage(this.engine.canvas,0,0,width,height);this.modelVisible=true;Object.assign(this.canvas.dataset,this.engine.canvas.dataset);
  }
  render(p:Film,time:number,width=this.canvas.width,height=this.canvas.height,quality?:RenderQualityProfile,poseOverride?:import('../camera-settings').CameraSetting){
    const frame=Math.max(0,Math.min(totalFrames(p)-1,time*30)),active=activeClip(p,frame),plan=active?this.plan(p,active.clip,width/height):null;
    const project=plan?.engine??this.background(p),local=active?(frame-active.start)/30:0;
    this.modelVisible=!!active;
    if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;
    const ctx=this.canvas.getContext('2d')!;
    ctx.clearRect(0,0,width,height);
    const alpha=poseOverride?0:fadeAmount(p,frame);
    if(plan){
      this.engine.render(poseOverride?{...plan.engine,grid:true,fades:[]}:plan.engine,local,width,height,undefined,false,quality,undefined,false,poseOverride);
      const layer=this.engine.canvas;
      ctx.save();ctx.globalAlpha=1-alpha;ctx.drawImage(layer,0,0,width,height);ctx.restore();
      Object.assign(this.canvas.dataset,layer.dataset);
    }else for(const key of ['rendered','txIndex','look','shot','camera','localStyle','model','physics','internalWidth','internalHeight','qualityScale','qualityRequestedScale','qualitySamples','qualityFxaa','qualityShadow'])delete this.canvas.dataset[key];
    if(!poseOverride){
    const textKey=JSON.stringify([p.look,p.texts]);if(textKey!==this.textKey){this.textKey=textKey;this.texts=p.texts.map(t=>buildText({data:this.data,look:p.look},t));}
    // Each layer fades to transparency before independent text is composed.
    for(const text of this.texts)drawTextPlan(ctx,text,{...project,textStyle:p.textStyle,accent:p.textStyle.accent},this.data,frame/30,{width,height,anchor:active?tx=>this.engine.anchor(tx):undefined});
    }
    this.canvas.dataset.clip=active?.clip.id??'';this.canvas.dataset.clipType=active?.clip.type??'';this.canvas.dataset.phase=plan?.phases.find(x=>local/project.duration>=x.from&&local/project.duration<x.to)?.label??'';this.canvas.dataset.fade=String(alpha);
  }
  processing(p:Film,c:Film['clips'][number]){const model=this.plan(p,c).engine.models.find(m=>m.kind==='drop');return model?this.engine.processing(model):null;}
  async prepare(p:Film,recalculate=false){const projects=p.clips.map(c=>this.plan(p,c).engine);if(!projects.length)return;await this.engine.prepare({...projects[0]!,models:projects.flatMap(project=>project.models)},recalculate);}
  pick(x:number,y:number){return this.modelVisible?this.engine.pick(x,y):null;}
  dispose(){this.plans.clear();this.backgrounds.clear();this.engine.dispose();}
}
