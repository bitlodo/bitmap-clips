import {cameraAnimationSchema,cameraAnimationControls} from '../camera-animation';
import {defineClip} from '../types';
import {presentation} from '../presentation';

export const scene=defineClip({
 id:'presentation-ready',version:1,category:'Presentation',name:'Ready',description:'Present the complete bitmap with gentle camera motion.',complexity:'simple',glyph:'◒',
 duration:presentation.duration,cameraControls:presentation.cameraControls,
 schema:presentation.settingsSchema.omit({assembly:true,buildOrder:true,bounceBack:true,revealFraction:true,stagger:true,strength:true,movement:true}).extend(cameraAnimationSchema),
 controls:cameraAnimationControls,
 build(context,settings,common){
  const plan=presentation.build(context,presentation.schema.parse({...settings,movement:'orbit',assembly:'none'}),common);
  const shot=plan.engine.shots[0]!;shot.camera.yawEnd=shot.camera.yawStart;shot.camera.distanceEnd=shot.camera.distanceStart;
  plan.engine.cameraSettings={cameraA:settings.cameraA,cameraB:settings.cameraB,animation:settings.movement,animationSpeed:settings.cameraSpeed,zoomStrength:settings.zoomStrength,zoomEasing:settings.zoomEasing};
  return plan;
 },
});
