import {z} from 'zod';
import {createProject,type Project,type SceneData} from './editor-model';

export const sceneStyleSchema=z.object({
 cubeType:z.preprocess(value=>value==='rounded'?'rounded-small':value,z.enum(['square','chamfered','rounded-small','rounded-large']).optional()),
 cameraType:z.enum(['perspective','isometric']).optional(),
 background:z.enum(['void','studio','paper']).optional(),backgroundColor:z.string().regex(/^#[a-f\d]{6}$/i).optional(),
 material:z.enum(['solid','neon','wireframe','hologram']).optional(),accent:z.string().regex(/^#[a-f\d]{6}$/i).optional(),
 bloom:z.number().min(0).max(.6).optional(),shadows:z.boolean().optional(),grid:z.boolean().optional(),scanlines:z.boolean().optional(),
 shadowOpacity:z.number().min(0).max(1).optional(),
 fog:z.boolean().optional(),fogNear:z.number().min(0).max(20).optional(),fogFar:z.number().min(.1).max(40).optional(),
 lightRotation:z.number().min(-180).max(180).optional(),
 lightIntensity:z.number().min(0).max(8).optional(),ambientIntensity:z.number().min(0).max(5).optional(),rimIntensity:z.number().min(0).max(8).optional(),
}).refine(s=>s.fogNear===undefined||s.fogFar===undefined||s.fogFar>s.fogNear,{message:'Fog Far must be greater than Near.',path:['fogFar']});
export type SceneStyle=z.infer<typeof sceneStyleSchema>;
export function styleDefaults(data:SceneData,look:Project['preset']){
 const p=createProject(data,look),paper=p.background==='paper',city=look==='data-city';
 return {cubeType:'rounded-small' as const,cameraType:'perspective' as const,background:p.background,backgroundColor:paper?'#f2ede6':p.background==='studio'?'#182331':'#05070b',material:p.material,accent:p.accent,bloom:p.bloom,shadows:p.shadows,shadowOpacity:paper?.22:.38,grid:false,scanlines:false,fog:false,fogNear:1,fogFar:6,lightRotation:0,lightIntensity:paper?3.4:city?1.5:3.6,ambientIntensity:paper?2.1:city?.7:.65,rimIntensity:paper?.7:2.9};
}
export interface StyleView {yaw:number;elevation:number;distance:number;pan?:[number,number,number];}
export function stylePreviewProject(data:SceneData,look:Project['preset'],style:SceneStyle,view:StyleView):Project{
 const project=createProject(data,look,5);Object.assign(project,style);project.models=[];project.titles=[];project.fades=[];
 project.shots=[project.shots[0]!];const shot=project.shots[0]!;shot.start=0;shot.duration=5;
 Object.assign(shot.camera,{yawStart:view.yaw,yawEnd:view.yaw,elevation:view.elevation,elevationEnd:view.elevation,distanceStart:view.distance,distanceEnd:view.distance,target:'block',compositionLift:0,transition:'cut'});
 return project;
}
