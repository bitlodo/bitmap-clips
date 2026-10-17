import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createFilm,parseDocument,validateFilm} from '../src/clips/film';
import type {SceneData} from '../src/editor-model';
import {makeText} from '../src/texts/registry';
import {textThemes,fontOptions,textStyleOverrideSchema} from '../src/text-style';
import {applyTextDefaults,applySceneDefaults} from '../src/default-styles';
import {styleDefaults} from '../src/scene-style';
import {ProjectHistory} from '../src/history';
const data=snapshot as SceneData;
test('presets are editable settings and preserve local overrides unless reset is requested',()=>{
 const film=createFilm(data);film.texts=[makeText('cinematic',0)];film.texts[0]!.textStyleOverride={color:'#123456'};film.clips[0]!.styleOverride={accent:'#abcdef'};
 const initial=structuredClone(film),preset=textThemes[1]!.style;
 const changed=applyTextDefaults(film,{...preset,color:'#cccccc'});
 expect(changed.textStyle.font).toBe('sans');expect(changed.textStyle.color).toBe('#cccccc');expect(changed.texts[0]!.textStyleOverride).toEqual({color:'#123456'});
 expect(applyTextDefaults(film,preset,true).texts[0]!.textStyleOverride).toBeNull();
 expect(applySceneDefaults(film,'editorial',styleDefaults(data,'editorial')).clips[0]!.styleOverride).toEqual({accent:'#abcdef'});
 expect(applySceneDefaults(film,'editorial',styleDefaults(data,'editorial'),true).clips[0]!.styleOverride).toBeNull();
 expect(film).toEqual(initial);expect(changed).not.toHaveProperty('textPreset');
});
test('six font choices and text style overrides survive document import and undo',()=>{
 expect(fontOptions).toHaveLength(6);
 for(const preset of textThemes){
  const film=createFilm(data);film.texts=[makeText('caption',0)];film.texts[0]!.textStyleOverride={font:'serif',accent:'#123456'};
  const next=validateFilm(applyTextDefaults(film,preset.style),data),history=new ProjectHistory(film);history.record(next);
  expect(parseDocument(JSON.parse(JSON.stringify({data,film:next}))).film).toEqual(next);expect(history.undo()).toEqual(film);expect(history.redo()).toEqual(next);
 }
 const old=createFilm(data);const {textStyle,...legacy}=old;expect(parseDocument({data,film:legacy}).film.textStyle).toEqual(textStyle);
});

test('a partial text override inherits every field that was not edited',()=>{
 expect(textStyleOverrideSchema.parse({color:'#123456'})).toEqual({color:'#123456'});
 expect(textStyleOverrideSchema.parse({})).toEqual({});
});

test('new films use the Monument preset while saved styles remain unchanged',()=>{
 const film=createFilm(data);
 expect(film.look).toBe('monument');
 expect(film.sceneStyle).toMatchObject({cameraType:'perspective',background:'void',backgroundColor:'#161a22',accent:'#ff8c00',material:'solid',cubeType:'rounded-small',lightIntensity:1.9,ambientIntensity:4.3,rimIntensity:.25,bloom:0,lightRotation:-92,shadows:true,shadowOpacity:.36,fog:false,grid:false,scanlines:false});
 expect(parseDocument({data,film}).film).toEqual(film);
 const legacy={...film,sceneStyle:{}};
 expect(parseDocument({data,film:legacy}).film.sceneStyle).toEqual({});
});
