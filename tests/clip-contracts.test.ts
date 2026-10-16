import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {clips,definition,settingsFor,buildClip} from '../src/clips/registry';
import {createFilm,makeClip,validateFilm,totalFrames,clipStart,activeClip,fadeAmount,textRange,suggestedText,resolvedText,parseDocument,findTextGap,videoProject} from '../src/clips/film';
import {modelState,parcelPose} from '../src/model-motion';
import {sampleCamera,shotPose,fitDistance} from '../src/camera-motion';
import {controlVisible} from '../src/clips/types';
import {controlsFor} from '../src/clips/registry';
import {makeText} from '../src/texts/registry';
import {ProjectHistory} from '../src/history';
import type {SceneData} from '../src/editor-model';
const data=snapshot as SceneData;
function filmWithTexts(){const p=createFilm(data);p.clips[2]=makeClip('transaction',300,300);for(const c of [p.clips[0]!,p.clips[2]!])p.texts.push(suggestedText(p,data,c)!);return validateFilm(p,data);}

test('available scene contracts contain their controls in the schema',()=>{
 expect(clips).toHaveLength(2);expect(clips.filter(c=>c.complexity==='simple')).toHaveLength(2);
 for(const d of clips){const settings=settingsFor(d.id,{});for(const control of d.controls)expect(control.key in settings).toBe(true);const c=makeClip(d.id),p=buildClip({data,look:'monument'},c);expect(p.engine.titles).toHaveLength(0);expect(p.engine.fades).toHaveLength(0);expect(p.phases[0]!.from).toBe(0);expect(p.phases.at(-1)!.to).toBe(1);}
 expect(()=>settingsFor('presentation',{assembly:'invalid'})).toThrow();expect(()=>settingsFor('panorama',{amplitude:500})).toThrow();expect(()=>definition('legacy-camera')).toThrow();
});
test('novo filme usa a duração de cada contrato e cobre a timeline sem cena simultânea',()=>{
 const p=filmWithTexts();expect(p.aspect).toBe('1:1');let start=0;
 for(const c of p.clips){expect(c.durationFrames).toBe(definition(c.type).duration.default);expect(clipStart(p,c.id)).toBe(start);expect(activeClip(p,start)!.clip.id).toBe(c.id);expect(activeClip(p,start+c.durationFrames-1)!.clip.id).toBe(c.id);start+=c.durationFrames;}
 expect(totalFrames(p)).toBe(start);expect(validateFilm(p,data)).toEqual(p);expect(p).not.toHaveProperty('duration');
});
test('resize, adição, remoção, histórico e export derivam o total dos clips',()=>{
 let p=filmWithTexts();const history=new ProjectHistory(p),before=totalFrames(p),otherDurations=p.clips.slice(0,2).map(c=>c.durationFrames);
 p.clips[2]!.durationFrames+=30;p=validateFilm(p,data);history.record(p);
 expect(totalFrames(p)).toBe(before+30);expect(p.clips.slice(0,2).map(c=>c.durationFrames)).toEqual(otherDurations);
 expect(videoProject(p).duration).toBe((before+30)/30);expect(totalFrames(history.undo()!)).toBe(before);expect(totalFrames(history.redo()!)).toBe(before+30);
 const extra=makeClip('panorama',150,totalFrames(p));p.clips.push(extra);expect(totalFrames(validateFilm(p,data))).toBe(before+30+extra.durationFrames);
 p.clips.pop();p=parseDocument(JSON.parse(JSON.stringify({data,film:p}))).film;expect(videoProject(p).duration).toBe((before+30)/30);
});
test('clips e textos podem somar mais de três minutos sem duração global',()=>{
 const p=filmWithTexts();p.clips=Array.from({length:15},(_,i)=>makeClip('transaction',480,i*480));
 p.texts=[makeText('caption',5500,1600)];
 expect(totalFrames(validateFilm(p,data))).toBe(7200);expect(videoProject(parseDocument({data,film:p}).film).duration).toBe(240);
 p.texts[0]!.durationFrames=1800;expect(totalFrames(validateFilm(p,data))).toBe(7300);
});
test('fade cobre o reset na fronteira, corte não adiciona sobreposição/duração',()=>{
 const p=filmWithTexts(),boundary=p.clips[0]!.durationFrames;p.clips[0]!.fadeInFrames=12;p.clips[0]!.fadeOutFrames=9;expect(fadeAmount(p,0)).toBe(1);expect(fadeAmount(p,boundary)).toBe(1);expect(fadeAmount(p,boundary-1)).toBeGreaterThan(.9);expect(fadeAmount(p,boundary+10)).toBe(0);const total=totalFrames(p);p.clips[0]!.fadeOutFrames=0;p.clips[1]!.fadeInFrames=0;expect(fadeAmount(p,boundary)).toBe(0);expect(totalFrames(p)).toBe(total);expect(fadeAmount(p,total-1)).toBeGreaterThan(.98);
});
test('override e montagem são locais, seek não herda a cena anterior',()=>{
 const p=filmWithTexts(),first=p.clips[0]!,next=p.clips[1]!;first.styleOverride={material:'wireframe',accent:'#ff0000'};first.settings.assembly='scatter';
 const a=buildClip({data,look:p.look},first),b=buildClip({data,look:p.look},next);expect(modelState(a.engine,2).material).toBe('wireframe');expect(modelState(b.engine,0).material).toBe('solid');expect(modelState(b.engine,0).transform).toBeUndefined();const parcel=data.layout.parcels[0]!;expect(parcelPose(data,parcel,0,undefined,0).scale).toBe(1);expect(sampleCamera(data,b.engine,1,1)).toEqual(sampleCamera(data,b.engine,1,1));
});
test('texto manual conserva timing e conteúdo ao reordenar e redimensionar clips',()=>{
 const p=filmWithTexts(),t=p.texts[0]!,c=p.clips[0]!,before=textRange(p,t);Object.assign(t.settings,{source:'manual',text:'Meu bitmap'});c.startFrame=totalFrames(p);c.durationFrames+=30;p.clips.sort((a,b)=>a.startFrame-b.startFrame);
 expect(textRange(p,t)).toEqual(before);expect(resolvedText(p,data,t).text).toBe('Meu bitmap');expect(validateFilm(p,data)).toEqual(p);
});
test('alvo do clip não altera o texto sugerido já adicionado nem sua câmera',()=>{
 const p=filmWithTexts(),c=p.clips[2]!,t=p.texts[1]!,tx=resolvedText(p,data,t).txIndex;c.settings.target='selected';c.settings.txIndex=0;
 const before=buildClip({data,look:p.look},c);expect(resolvedText(p,data,t).txIndex).toBe(tx);
 t.settings.source='manual';t.settings.text='custom';t.position='top';const after=buildClip({data,look:p.look},c);expect(sampleCamera(data,before.engine,3,9/16)).toEqual(sampleCamera(data,after.engine,3,9/16));expect(after.phases).toHaveLength(3);c.settings.returnWide=false;expect(buildClip({data,look:p.look},c).phases).toHaveLength(2);
});
test('import aceita o contrato atual, referências existentes e texto sem sobreposição',()=>{
 const p=filmWithTexts();expect(parseDocument({data,film:p}).film).toEqual(p);expect(()=>parseDocument({data,project:p})).toThrow();expect(()=>validateFilm({...p,version:4},data)).toThrow();const duplicate=structuredClone(p.texts[0]!);duplicate.id='another';p.texts.push(duplicate);expect(()=>validateFilm(p,data)).toThrow();p.texts.pop();p.clips[2]!.settings.target='selected';p.clips[2]!.settings.txIndex=999999;expect(()=>validateFilm(p,data)).toThrow();
});
test('inserção de texto encontra espaço livre sem empilhar os sugeridos',()=>{
 const p=filmWithTexts(),gap=findTextGap(p,180);expect(gap).not.toBeNull();for(const t of p.texts){const r=textRange(p,t);expect(gap!.start>=r.start+r.duration||gap!.start+gap!.duration<=r.start).toBe(true);}expect(suggestedText(p,data,p.clips[1]!)!.type).toBe('cinematic');
});
test('ângulo, elevação e zoom se aplicam ao percurso inteiro nos três formatos',()=>{
 const p=filmWithTexts(),c=p.clips[1]!,base=buildClip({data,look:p.look},c);c.framing={yawOffset:20,pitchOffset:10,zoom:1.2};const adjusted=buildClip({data,look:p.look},c);for(const aspect of [16/9,1,9/16])for(const t of [0,1,4.9]){const before=sampleCamera(data,base.engine,t,aspect),after=sampleCamera(data,adjusted.engine,t,aspect);expect(after.position.equals(before.position)).toBe(false);expect(after.position.toArray().every(Number.isFinite)).toBe(true);}
});

test('mudar zoom in não retima textos já adicionados',()=>{
 const p=filmWithTexts(),c=p.clips[2]!,t=p.texts[1]!;Object.assign(t.settings,{source:'manual',text:'Minha mensagem'});const before=structuredClone(t);c.settings.zoomInDuration=2.5;
 expect(validateFilm(p,data).texts[1]).toEqual(before);
});

test('campos condicionais aceitam select e checkbox, preservando o valor oculto',()=>{
 const c=makeClip('transaction'),controls=controlsFor(c.type),target=controls.find(c=>c.key==='txIndex')!,duration=controls.find(c=>c.key==='zoomInDuration')!;
 expect(controls.some(c=>c.key==='focusShare')).toBe(false);expect(controlVisible(c.settings,target)).toBe(false);c.settings.target='selected';expect(controlVisible(c.settings,target)).toBe(true);
 expect(controlVisible(c.settings,duration)).toBe(true);c.settings.zoomInDuration=2.3;c.settings.zoomIn=false;expect(controlVisible(c.settings,duration)).toBe(false);
 const normalized=settingsFor(c.type,c.settings);expect(normalized.zoomInDuration).toBe(2.3);normalized.zoomIn=true;expect(controlVisible(normalized,duration)).toBe(true);
 expect(()=>settingsFor(c.type,{zoomIn:'false'})).toThrow();expect(()=>settingsFor(c.type,{zoomInDuration:0})).toThrow();expect(()=>settingsFor(c.type,{zoomInDuration:3.1})).toThrow();
});
test('zoom in parte da visão geral e chega ao alvo na duração configurada; desligado conserva visão geral',()=>{
 const c=makeClip('transaction');c.settings.zoomInDuration=2.5;const plan=buildClip({data,look:'monument'},c),shot=plan.engine.shots[0]!;
 expect(plan.phases[0]!.to*plan.engine.duration).toBe(2.5);
 for(const aspect of [16/9,1,9/16]){
  const initial=shotPose(data,shot,0,aspect),end=shotPose(data,shot,2.5,aspect),without=structuredClone(shot);delete without.camera.zoomIn;
  const expected=shotPose(data,without,2.5,aspect);expect(initial.position.distanceTo(initial.target)).toBeCloseTo(fitDistance(data,shot.camera.fov,aspect)*1.3);
  expect(end.position.toArray()).toEqual(expected.position.toArray());expect(end.target.toArray()).toEqual(expected.target.toArray());expect(initial.target.equals(end.target)).toBe(false);
 }
 c.settings.zoomIn=false;const wide=buildClip({data,look:'monument'},c);expect(wide.engine.shots[0]!.camera.target).toBe('block');expect(wide.engine.shots[0]!.camera.zoomIn).toBeUndefined();expect(wide.phases.some(p=>p.id==='zoom-in')).toBe(false);
});
test('rotação é linear durante zoom, detalhe e retorno em todas as durações e proporções',()=>{
 for(const duration of [180,300,480])for(const zoomIn of [false,true])for(const returnWide of [false,true]){
  const c=makeClip('transaction',duration);Object.assign(c.settings,{zoomIn,returnWide,zoomInDuration:3});c.framing.yawOffset=20;
  const plan=buildClip({data,look:'monument'},c),p=plan.engine;
  for(const aspect of [16/9,1,9/16])for(let frame=0;frame<duration;frame++){
   const time=frame/30,pose=sampleCamera(data,p,time,aspect),yaw=Math.atan2(pose.position.x-pose.target.x,pose.position.z-pose.target.z)*180/Math.PI;
   expect(yaw).toBeCloseTo(65+28*time/p.duration,7);expect([...pose.position.toArray(),...pose.target.toArray()].every(Number.isFinite)).toBe(true);
  }
  c.settings.movement='still';const still=buildClip({data,look:'monument'},c).engine;for(const t of [0,1,still.duration-.01]){const pose=sampleCamera(data,still,t,1);expect(Math.atan2(pose.position.x-pose.target.x,pose.position.z-pose.target.z)*180/Math.PI).toBeCloseTo(65);}
 }
});

test('Presentation abre controles por montagem e aplica os parâmetros ao plano',()=>{
 for(const mode of ['build','rise','scatter','wave','none']){
  const c=makeClip('presentation');c.settings={...c.settings,assembly:mode,revealFraction:.6,stagger:.7,strength:1.2};
  const visible=controlsFor(c.type).filter(control=>controlVisible(c.settings,control)).map(control=>control.key);
  expect(visible.includes('buildOrder')).toBe(mode==='build');
  expect(visible.includes('revealFraction')).toBe(mode!=='none');
  expect(visible.includes('strength')).toBe(['rise','scatter','wave'].includes(mode));
  expect(new Set(visible).size).toBe(visible.length);
  const plan=buildClip({data,look:'monument'},c);
  if(mode==='none')expect(plan.engine.models).toHaveLength(0);
  else {expect(plan.engine.models[0]!.duration).toBeCloseTo(plan.engine.duration*.6);expect(plan.engine.models[0]!.stagger).toBe(.7);expect(plan.engine.models[0]!.strength).toBe(1.2);expect(plan.phases[0]!.to).toBe(.6);}
 }
});

test('Build sequencial cresce em ordem e aleatório é repetível após salvar',()=>{
 const c=makeClip('presentation');c.settings.buildOrder='sequential';c.settings.stagger=.8;
 const plan=buildClip({data,look:'monument'},c),model=plan.engine.models[0]!,at=model.duration*.5;
 const scales=data.layout.parcels.map((parcel,index)=>parcelPose(data,parcel,index,model,at).scale);
 for(let i=1;i<scales.length;i++)expect(scales[i]!).toBeLessThanOrEqual(scales[i-1]!);
 expect(scales[0]).toBeGreaterThan(scales.at(-1)!);
 c.settings.buildOrder='random';const random=buildClip({data,look:'monument'},c).engine.models[0]!;
 const poses=data.layout.parcels.map((parcel,index)=>parcelPose(data,parcel,index,random,at));
 expect(poses.map(p=>p.scale)).not.toEqual(scales);
 const restored=buildClip({data,look:'monument'},JSON.parse(JSON.stringify(c))).engine.models[0]!;
 expect(data.layout.parcels.map((parcel,index)=>parcelPose(data,parcel,index,restored,at))).toEqual(poses);
 expect(settingsFor('presentation',{}).buildOrder).toBe('random');
});

test('Build bounce back afeta apenas altura e largura cresce na metade do tempo',()=>{
 for(const buildOrder of ['sequential','random']){
  const c=makeClip('presentation');Object.assign(c.settings,{buildOrder,bounceBack:.3,stagger:.6});
  const model=buildClip({data,look:'monument'},c).engine.models[0]!;
  for(const index of [0,Math.floor(data.layout.parcels.length/2),data.layout.parcels.length-1]){
   const parcel=data.layout.parcels[index]!;
   const samples=Array.from({length:201},(_,i)=>parcelPose(data,parcel,index,model,model.duration*i/200));
   expect(samples[0]!.scale).toBe(0);expect(Math.max(...samples.map(p=>p.heightScale))).toBeCloseTo(1.3,2);
   expect(samples.at(-1)!.scale).toBe(1);expect(parcelPose(data,parcel,index,model,model.duration+10).scale).toBe(1);
   for(const pose of samples){expect(pose.scale).toBeLessThanOrEqual(1);expect(pose.y).toBeCloseTo((parcel.size-.5)*pose.heightScale/2);}
   expect(samples.at(-1)!.heightScale).toBe(1);
  }
  const restored=JSON.parse(JSON.stringify(c));expect(buildClip({data,look:'monument'},restored).engine.models[0]!.bounceBack).toBe(.3);
 }
 expect(settingsFor('presentation',{}).bounceBack).toBe(0);
 expect(()=>settingsFor('presentation',{bounceBack:1})).toThrow();
});

 test('Build com bounce completa largura e profundidade na metade da animação local',()=>{
  const c=makeClip('presentation');Object.assign(c.settings,{bounceBack:.3,stagger:0});
  const model=buildClip({data,look:'monument'},c).engine.models[0]!,parcel=data.layout.parcels[0]!;
  expect(parcelPose(data,parcel,0,model,model.duration*.25).scale).toBeCloseTo(.5);
  for(const phase of [.5,.7,.9,1])expect(parcelPose(data,parcel,0,model,model.duration*phase).scale).toBe(1);
  const peak=parcelPose(data,parcel,0,model,model.duration*.7);expect(peak.heightScale).toBeCloseTo(1.3);expect(peak.y).toBeCloseTo((parcel.size-.5)*1.3/2);
 });
