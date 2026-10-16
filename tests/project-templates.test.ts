import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {projectTemplates,templateFilm,defineProjectTemplate,composeTemplate,createTemplateRegistry} from '../src/project-templates';
import {parseDocument,totalFrames,validateFilm,makeClip} from '../src/clips/film';
import {buildClip} from '../src/clips/registry';
import dynamicProject from '../src/project-templates/projects/dynamic.json';
import futuristicProject from '../src/project-templates/projects/futuristic.json';
import {defineExportedProjectTemplate} from '../src/project-templates/exported-project';
import {ProjectHistory} from '../src/history';
const data=snapshot as SceneData;
test('blank timeline survives persistence and can receive its first scene',()=>{
 const film=templateFilm(data,'blank');expect(film.clips).toEqual([]);expect(film.texts).toEqual([]);expect(film.audio.enabled).toBe(false);expect(totalFrames(film)).toBe(0);
 expect(parseDocument(JSON.parse(JSON.stringify({data,film}))).film).toEqual(film);
 film.clips.push(makeClip('presentation'));expect(totalFrames(validateFilm(film,data))).toBe(150);
});
test('templates provide independent editable settings and bitmap-derived text',()=>{
 const films=projectTemplates.filter(t=>t.id!=='blank').map(t=>templateFilm(data,t.id));
 for(const film of films){expect(validateFilm(film,data)).toEqual(film);expect(film.clips.length).toBeGreaterThan(0);expect(film.texts.length).toBeGreaterThan(0);for(const clip of film.clips)expect(buildClip({data,look:film.look,sceneStyle:film.sceneStyle},clip).engine.shots.length).toBeGreaterThan(0);expect(parseDocument({data,film}).film).toEqual(film);}
 expect(films[0]!.look).toBe('monument');expect(films[1]!.look).toBe('data-city');const before=structuredClone(films[1]);films[0]!.clips[0]!.settings.revealType='wave';expect(films[1]).toEqual(before);
});
test('an empty project supports undo after adding its first item',()=>{
 const empty=templateFilm(data,'blank'),history=new ProjectHistory(empty);const changed=structuredClone(empty);changed.clips.push(makeClip('panorama'));history.record(changed);expect(history.undo()).toEqual(empty);
});

test('registering a predefined module needs no changes to editor or existing template builders',()=>{
 const custom=defineProjectTemplate({id:'report',version:1,name:'Report',description:'A predefined report',tag:'1 scene',actionLabel:'Open report',preview:{kind:'frame',time:1},build:scene=>composeTemplate(scene,{look:'editorial',aspect:'16:9',sceneStyle:{accent:'#123456'},scenes:[{type:'panorama',startFrame:30,durationFrames:120,settings:{view:'top',amplitude:20},styleOverride:{material:'wireframe'}}],texts:[{type:'caption',startFrame:45,durationFrames:60,settings:{text:`Block ${scene.height}`},position:'top',scale:1.2}],audio:{enabled:false}})});
 const registry=createTemplateRegistry([custom]),before=structuredClone(data),a=registry.build(data,'report'),b=registry.build(data,'report');
 expect(registry.definitions[0]!.preview).toEqual({kind:'frame',time:1});expect(a.clips).toHaveLength(1);expect(a.clips[0]!.startFrame).toBe(30);expect(a.texts[0]!.settings.text).toBe(`Block ${data.height}`);expect(a.aspect).toBe('16:9');expect(a.sceneStyle.accent).toBe('#123456');expect(a.clips[0]!.id).not.toBe(b.clips[0]!.id);expect(a.texts[0]!.id).not.toBe(b.texts[0]!.id);expect(data).toEqual(before);
 a.clips[0]!.settings.view='oblique';expect(b.clips[0]!.settings.view).toBe('top');
 expect(()=>createTemplateRegistry([custom,custom])).toThrow('duplicate');expect(()=>registry.build(data,'missing')).toThrow('Unknown');
});
test('registry validates authored timelines and isolates bitmap input from builders',()=>{
 const invalid=defineProjectTemplate({id:'invalid',version:1,name:'Invalid',description:'',tag:'',actionLabel:'',preview:{kind:'empty'},build:scene=>composeTemplate(scene,{scenes:[{type:'panorama',startFrame:0,durationFrames:120},{type:'panorama',startFrame:60,durationFrames:120}]})});
 expect(()=>createTemplateRegistry([invalid]).build(data,'invalid')).toThrow('overlap');
 const unknown={...invalid,id:'unknown',build:(scene:SceneData)=>composeTemplate(scene,{scenes:[{type:'missing',startFrame:0,durationFrames:120}]})};expect(()=>createTemplateRegistry([unknown]).build(data,'unknown')).toThrow('Unknown scene');
 const mutator={...invalid,id:'isolation',build:(scene:SceneData)=>{scene.height=1;return composeTemplate(scene,{});}};
 const before=structuredClone(data);createTemplateRegistry([mutator]).build(data,'isolation');expect(data).toEqual(before);
});

test('project templates do not create Transaction scenes',()=>{
 for(const template of projectTemplates)expect(templateFilm(data,template.id).clips.some(c=>c.type==='transaction')).toBe(false);
});

test('project templates do not create Transaction values texts',()=>{
 for(const template of projectTemplates)expect(templateFilm(data,template.id).texts.some(t=>t.type==='transaction-labels')).toBe(false);
});


test('rebuilt templates use current effects with contiguous scenes and independent text timing',()=>{
 for(const [id,frames] of [['dynamic',564],['futuristic',540]] as const){
  const film=templateFilm(data,id),template=projectTemplates.find(t=>t.id===id)!;
  expect(totalFrames(film)).toBe(frames);
  expect(film.clips.map(c=>c.type)).toEqual(id==='dynamic'?['reveal','display','reveal']:['reveal','display','display']);
  expect(film.clips[1]!.settings.inheritLastCamera).toBe(true);
  expect(film.clips[2]!.settings.inheritLastCamera).toBe(id!=='dynamic');
  for(let i=1;i<film.clips.length;i++)expect(film.clips[i]!.startFrame).toBe(film.clips[i-1]!.startFrame+film.clips[i-1]!.durationFrames);
  if(id==='futuristic')expect(film.clips.slice(1).map(c=>c.settings.displayAnimation)).toEqual(['wave','pulse']);
  else expect(film.clips[2]!.settings.revealType).toBe('gravity');
  expect(film.texts.map(t=>t.settings.source)).toEqual(id==='dynamic'?['identity','transactions','manual']:['identity','transactions','volume']);
  for(const text of film.texts)expect(text.startFrame+text.durationFrames).toBeLessThanOrEqual(frames);
  expect(template.preview.kind).toBe('frame');
  if(template.preview.kind==='frame')expect(template.preview.time*30).toBeLessThan(frames);
  expect(parseDocument(JSON.parse(JSON.stringify({data,film}))).film).toEqual(film);
 }
});

test('template typography and local overrides remain independent across builds',()=>{
 const a=templateFilm(data,'futuristic'),b=templateFilm(data,'futuristic');
 expect(a.textStyle.font).toBe('mono');expect(a.textStyle.accent).toBe(a.sceneStyle.accent!);
 expect(a.clips[2]!.styleOverride!.material).toBe('hologram');
 expect(a.texts[2]!.textStyleOverride!.accent).toBe(a.clips[2]!.styleOverride!.accent);
 a.textStyle.accent='#ffffff';a.texts[2]!.textStyleOverride!.accent='#000000';
 expect(b.textStyle.accent).toBe('#48e8dc');expect(b.texts[2]!.textStyleOverride!.accent).toBe('#a69cff');
});


test('JSON project templates preserve all exported film settings and use the saved name',()=>{
 for(const [id,project] of [['dynamic',dynamicProject],['futuristic',futuristicProject]] as const){
  const film=templateFilm(data,id);
  expect(film).toEqual(validateFilm(project.film,data));
  expect(projectTemplates.find(t=>t.id===id)!.name).toBe(project.name);
  film.clips[0]!.fadeInFrames=0;
  expect(templateFilm(data,id).clips[0]!.fadeInFrames).toBe(project.film.clips[0]!.fadeInFrames);
 }
});

test('exported templates adapt invalid transaction references without changing camera settings',()=>{
 const project=structuredClone(futuristicProject);
 project.name='Saved project name';
 project.film.texts[0]!.settings.txIndex=project.data.layout.parcels.at(-1)!.txIndex;
 const template=defineExportedProjectTemplate('saved',project,'Saved composition');
 const target=structuredClone(data);target.layout.parcels=target.layout.parcels.slice(0,1);target.txCount=1;
 const film=template.build(target);
 expect(template.name).toBe('Saved project name');
 expect(film.texts[0]!.settings.txIndex).toBe(target.layout.parcels[0]!.txIndex);
 expect(film.clips).toEqual(validateFilm(project.film,project.data as SceneData).clips);
});
