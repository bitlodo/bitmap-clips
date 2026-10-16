import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {clips,buildClip,sceneLabel,migrateScene,settingsFor} from '../src/clips/registry';
import {makeClip,createFilm,validateFilm} from '../src/clips/film';
import {controlVisible} from '../src/clips/types';
import {sampleCamera} from '../src/camera-motion';
import {parcelPose,displayParcelPose} from '../src/model-motion';
const data=snapshot as SceneData;
test('library has two purposeful scenes with type-specific controls',()=>{
 expect(clips.map(c=>c.id)).toEqual(['reveal','display']);
 for(const [type,values,key] of [['reveal',['build','wave','radial','scale-rotate','gravity'],'revealType'],['display',['none','pulse','wave'],'displayAnimation']] as const){
  for(const value of values){
   const c=makeClip(type);c.settings[key]=value;
   const settings=settingsFor(type,c.settings),d=clips.find(d=>d.id===type)!;
   const visible=d.controls.filter(control=>controlVisible(settings,control)).map(c=>c.key);
   expect(new Set(visible).size).toBe(visible.length);
   expect(sceneLabel(c)).toContain(d.name+' · ');
   const plan=buildClip({data,look:'monument'},c);expect(plan.engine.duration).toBe(c.durationFrames/30);
   if(type==='reveal')expect(String(plan.engine.models[0]!.kind)).toBe(value==='gravity'?'drop':value==='radial'?'scatter':value);
   else expect(String(plan.engine.displayMotion?.kind)).toBe(value);
  }
 }
});
test('changing reveal type preserves timing, text, camera and style',()=>{
 const film=createFilm(data),c=film.clips[0]!;c.settings.rotation='rotating';c.settings.zoomMode='zoom-in';c.styleOverride={cubeType:'chamfered'};
 const before=structuredClone(film);c.settings.revealType='gravity';const after=validateFilm(film,data);
 expect(after.clips[0]!.startFrame).toBe(before.clips[0]!.startFrame);expect(after.clips[0]!.durationFrames).toBe(before.clips[0]!.durationFrames);
 expect(after.clips[0]!.styleOverride).toEqual(before.clips[0]!.styleOverride);expect(after.texts).toEqual(before.texts);expect(after.clips[0]!.settings.rotation).toBe(true);
});
test('camera rotation and zoom combine; zoom out reverses the distance path',()=>{
 const c=makeClip('display');Object.assign(c.settings,{rotation:true,zoomEnabled:true,zoomMode:'zoom-in',cameraA:{position:[0,10,1000],target:[0,0,0],fov:45}});
 const project=buildClip({data,look:'monument'},c).engine,start=sampleCamera(data,project,0,1),end=sampleCamera(data,project,project.duration,1);
 expect(end.position.distanceTo(end.target)).toBeLessThan(start.position.distanceTo(start.target));expect(end.position.x).not.toBe(0);
 c.settings.zoomMode='zoom-out';const out=buildClip({data,look:'monument'},c).engine;
 expect(sampleCamera(data,out,0,1).position.distanceTo(start.target)).toBeCloseTo(end.position.distanceTo(end.target));
 expect(sampleCamera(data,out,out.duration,1).position.distanceTo(start.target)).toBeCloseTo(start.position.distanceTo(start.target));
});
test('Display loops continue beyond one cycle; Scale & Rotate completes and holds',()=>{
 for(const kind of ['pulse','wave'] as const){
  const motion={kind,speed:2,intensity:.3},pose=()=>({x:10,y:1,z:3,scale:1,heightScale:1,yaw:0});
  const a=displayParcelPose(pose(),motion,.4,30),b=displayParcelPose(pose(),motion,3.4,30);
  for(const key of ['x','y','z','scale','heightScale'] as const)expect(a[key]).toBeCloseTo(b[key]);
 }
 const c=makeClip('reveal');c.settings.revealType='scale-rotate';const model=buildClip({data,look:'monument'},c).engine.models[0]!,parcel=data.layout.parcels[0]!;
 expect(parcelPose(data,parcel,0,model,0).scale).toBe(0);expect(parcelPose(data,parcel,0,model,model.duration).scale).toBe(1);expect(parcelPose(data,parcel,0,model,model.duration+1).yaw).toBe(0);
});
test('previous scene choices map to Reveal or Display preserving identity',()=>{
 for(const [type,next] of [['presentation-gravity','reveal'],['presentation-wave','reveal'],['presentation-static','display'],['presentation-ready','display'],['panorama','display']]){
  const old=makeClip(type!);const migrated=migrateScene(old);expect(migrated.type).toBe(next!);expect(migrated.id).toBe(old.id);expect(migrated.durationFrames).toBe(old.durationFrames);
 }
});

test('camera checkboxes reveal only their relevant options',async()=>{
 const {cameraMotionControls}=await import('../src/camera-animation-controls');
 const off=settingsFor('display',{}),on=settingsFor('display',{rotation:true,zoomEnabled:true,zoomMode:'zoom-out'});
 expect(off.rotation).toBe(false);expect(off.zoomEnabled).toBe(false);
 const visible=(s:Record<string,unknown>)=>cameraMotionControls.filter(c=>controlVisible(s,c)).map(c=>c.key);
 expect(visible(off)).toEqual(['rotation','zoomEnabled']);
 expect(visible(on)).toEqual(['rotation','rotationSpeed','zoomEnabled','zoomMode','cameraZoomStrength','cameraZoomEasing']);
});

test('new Reveal Build scenes use five seconds, no fades and a default still camera',()=>{
 const c=makeClip('reveal');expect(c.durationFrames).toBe(150);expect(c.fadeInFrames).toBe(0);expect(c.fadeOutFrames).toBe(0);
 expect(c.settings.revealType).toBe('build');expect(c.settings.inheritLastCamera).toBe(false);expect(c.settings.rotation).toBe(false);expect(c.settings.zoomEnabled).toBe(false);
 expect(settingsFor('reveal',{}).inheritLastCamera).toBe(false);
 expect(settingsFor('reveal',{inheritLastCamera:true}).inheritLastCamera).toBe(true);
});

test('Radial defaults are independent of Build and survive switching types',()=>{
 const c=makeClip('reveal');c.settings.revealType='radial';
 expect(c.settings.radialDuration).toBe(.6);expect(c.settings.radialStagger).toBe(.7);expect(c.settings.radialIntensity).toBe(2);
 const model=buildClip({data,look:'monument'},c).engine.models[0]!;
 expect(model.duration).toBe(3);expect(model.stagger).toBe(.7);expect(model.strength).toBe(2);
 c.settings.revealType='build';expect(c.settings.revealFraction).toBe(.4);expect(c.settings.bounceBack).toBe(.6);
});

 test('new projects omit Transaction while saved Transaction scenes still load',()=>{
 const film=createFilm(data);
 expect(film.clips.every(c=>c.type!=='transaction')).toBe(true);
 film.clips=[makeClip('transaction')];
 expect(validateFilm(film,data).clips[0]!.type).toBe('transaction');
});
