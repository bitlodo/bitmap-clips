import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {createFilm,parseDocument,validateFilm} from '../src/clips/film';
import {buildClip} from '../src/clips/registry';
import {sceneStyleSchema,styleDefaults,stylePreviewProject} from '../src/scene-style';
import {ProjectHistory} from '../src/history';
const data=snapshot as SceneData;

test('look templates load valid complete settings, and style previews contain ready geometry without film animations',()=>{
 for(const look of ['monument','data-city','terminal','editorial'] as const){
  const defaults=styleDefaults(data,look);expect(sceneStyleSchema.parse(defaults)).toEqual(defaults);
  const project=stylePreviewProject(data,look,defaults,{yaw:-25,elevation:65,distance:1.8});
  expect(project.models).toEqual([]);expect(project.titles).toEqual([]);expect(project.fades).toEqual([]);expect(project.shots).toHaveLength(1);
  const camera=project.shots[0]!.camera;expect(camera.yawStart).toBe(-25);expect(camera.yawEnd).toBe(-25);expect(camera.elevation).toBe(65);expect(camera.distanceStart).toBe(1.8);expect(camera.distanceEnd).toBe(1.8);
 }
});

test('all scenes inherit background, color and lights, while local scene overrides retain precedence',()=>{
 const film=createFilm(data),original=structuredClone(film);
 film.sceneStyle={...styleDefaults(data,'editorial'),backgroundColor:'#123456',accent:'#abcdef',lightIntensity:5,ambientIntensity:1,rimIntensity:4,shadowOpacity:.15,grid:true,scanlines:true};
 for(const clip of film.clips){const project=buildClip({data,look:film.look,sceneStyle:film.sceneStyle},clip).engine;expect(project.backgroundColor).toBe('#123456');expect(project.accent).toBe('#abcdef');expect(project.lightIntensity).toBe(5);expect(project.ambientIntensity).toBe(1);expect(project.rimIntensity).toBe(4);expect(project.shadowOpacity).toBe(.15);expect(project.grid).toBe(true);expect(project.scanlines).toBe(true);}
 const preview=stylePreviewProject(data,film.look,film.sceneStyle,{yaw:0,elevation:45,distance:1});expect(preview.grid).toBe(true);expect(preview.scanlines).toBe(true);expect(preview.shadowOpacity).toBe(.15);
 film.clips[0]!.styleOverride={accent:'#ff0000',bloom:.2};
 const project=buildClip({data,look:film.look,sceneStyle:film.sceneStyle},film.clips[0]!).engine;expect(project.accent).toBe('#ff0000');expect(project.backgroundColor).toBe('#123456');expect(project.bloom).toBe(.2);
 expect(film.clips.slice(1)).toEqual(original.clips.slice(1));expect(film.texts).toEqual(original.texts);
});

test('style settings survive save/import and undo without retiming scenes; old v8 files receive an empty default',()=>{
 const film=createFilm(data),history=new ProjectHistory(film),times=film.clips.map(c=>[c.startFrame,c.durationFrames]);
 film.sceneStyle={backgroundColor:'#000000',lightIntensity:2};history.record(film);
 expect(parseDocument(JSON.parse(JSON.stringify({data,film}))).film).toEqual(film);expect(film.clips.map(c=>[c.startFrame,c.durationFrames])).toEqual(times);
 expect(history.undo()!.sceneStyle).toEqual({});expect(history.redo()!.sceneStyle).toEqual(film.sceneStyle);
 const {sceneStyle,...old}=film;expect(parseDocument({data,film:old}).film.sceneStyle).toEqual({});
 expect(()=>sceneStyleSchema.parse({lightIntensity:-1})).toThrow();expect(()=>sceneStyleSchema.parse({backgroundColor:'white'})).toThrow();
 expect(sceneStyleSchema.parse({shadowOpacity:0}).shadowOpacity).toBe(0);expect(sceneStyleSchema.parse({shadowOpacity:1}).shadowOpacity).toBe(1);expect(()=>sceneStyleSchema.parse({shadowOpacity:1.1})).toThrow();
 expect(()=>sceneStyleSchema.parse({fog:true,fogNear:3,fogFar:2})).toThrow('Fog Far');
 expect(sceneStyleSchema.parse({fog:false,fogNear:2,fogFar:7,lightRotation:90})).toMatchObject({fogNear:2,fogFar:7,lightRotation:90});
});

test('cube shapes persist and reach both scene and style preview plans',()=>{
 for(const cubeType of ['square','chamfered','rounded-small','rounded-large'] as const){
  const film=createFilm(data);film.sceneStyle={cubeType};
  const restored=validateFilm(film,data);
  expect(restored.sceneStyle.cubeType).toBe(cubeType);
  expect(stylePreviewProject(data,film.look,restored.sceneStyle,{yaw:35,elevation:30,distance:1}).cubeType).toBe(cubeType);
  expect(buildClip({data,look:film.look,sceneStyle:restored.sceneStyle},restored.clips[0]!).engine.cubeType).toBe(cubeType);
 }
});

test('shared Scene Style controls cover every schema field and work for both form scopes',async()=>{
 const {sceneStyleControls,sceneStyleFields}=await import('../src/scene-style-controls');
 expect(sceneStyleControls.map(c=>String(c.key)).toSorted()).toEqual(Object.keys(sceneStyleSchema.shape).toSorted());
 const values=styleDefaults(data,'monument');
 for(const prefix of ['style','clip-style']){
  const html=sceneStyleFields(values,prefix);
  for(const control of sceneStyleControls){expect(html).toContain(`data-style="${control.key}"`);expect(html).toContain(`id="${prefix}-${control.key}"`);}
 }
});

test('every local style override persists and takes precedence without changing the global style',()=>{
 const film=createFilm(data),global=styleDefaults(data,'monument');film.sceneStyle=global;
 const override=sceneStyleSchema.parse({...global,cameraType:'isometric',cubeType:'chamfered',background:'paper',backgroundColor:'#eeeeee',accent:'#123456',material:'neon',lightIntensity:2,ambientIntensity:1,rimIntensity:3,bloom:.1,lightRotation:45,shadows:false,shadowOpacity:.4,fog:false,fogNear:2,fogFar:8,grid:true,scanlines:true});
 film.clips[0]!.styleOverride=override;
 const restored=parseDocument(JSON.parse(JSON.stringify({data,film}))).film;
 const project=buildClip({data,look:restored.look,sceneStyle:restored.sceneStyle},restored.clips[0]!).engine;
 for(const [key,value] of Object.entries(override))expect(project[key as keyof typeof project]).toEqual(value);
 expect(restored.sceneStyle).toEqual(global);expect(restored.clips[1]!.styleOverride).toBeNull();
});
