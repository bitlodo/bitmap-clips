import {reveal,revealTypes} from './reveal';
import {display,displayTypes} from './display';
import {zoomEasingFor} from '../easing';
import {scene as staticScene} from './presentation-static';
import {scene as gravity} from './presentation-gravity';
import {scene as build} from './presentation-build';
import {scene as radial} from './presentation-radial';
import {scene as wave} from './presentation-wave';
import {scene as ready} from './presentation-ready';
import {presentation} from './presentation';
import {panorama} from './panorama';
import {transaction} from './transaction';
import type {ClipCommon,ClipContext,ClipInstance,Control} from './types';
/** Erasure happens only at registry boundary; each definition is typed against its own schema. */
export const clips=[reveal,display];
const previousDefinitions=[transaction,build,radial,wave,ready,staticScene,gravity,panorama];
const definitions=new Map([...clips,...previousDefinitions,presentation].map(scene=>[scene.id,scene]));
export function sceneLabel(c:ClipInstance){const d=definition(c.type);const options=c.type==='reveal'?revealTypes:c.type==='display'?displayTypes:undefined,key=c.type==='reveal'?'revealType':'displayAnimation';return options?`${d.name} · ${options.find(o=>o.value===c.settings[key])?.label??options[0]!.label}`:d.name;}
export function definition(type:string){const d=definitions.get(type);if(!d)throw Error(`Unknown scene: ${type}`);return d;}
/** Normalize compatibility fields before the current scene schema strips unknown keys. */
export function settingsFor(type:string,value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))return definition(type).schema.parse(value);
 const settings={...value as Record<string,unknown>};
 if(settings.zoomEnabled===undefined&&settings.zoomMode!==undefined){
  settings.zoomEnabled=settings.zoomMode!=='none';
 }
 if(type==='display'&&settings.displayAnimation==='spin'){
  settings.displayAnimation='none';
  settings.rotation='rotating';
  settings.rotationSpeed=settings.rotationSpeed??settings.displaySpeed??2;
 }
 if(type==='presentation-gravity'||type==='presentation-ready'){
  if(settings.zoomEasing!==undefined)settings.zoomEasing=zoomEasingFor(settings.zoomEasing);
  if(settings.zoomStrength===undefined&&typeof settings.zoomAmount==='number'){
   settings.zoomStrength=Math.max(.1,Math.min(2,settings.zoomAmount/5));
  }
  if(settings.movement==='orbit')settings.movement='rotating';
  if(settings.movement==='push-in')settings.movement='zoom-in';
  if(settings.movement==='fixed')settings.movement='none';
  if(settings.dropHeight===undefined&&typeof settings.height==='number'){
   settings.dropHeight=Math.max(1,Math.min(20,settings.height*5));
  }
  if(settings.flow===undefined&&typeof settings.flowFraction==='number'){
   settings.flow=Math.max(1,Math.min(10,1+9*(1-settings.flowFraction)/.85));
  }
 }
 if(settings.inheritLastCamera===undefined&&(settings.cameraA||settings.cameraB)){
  settings.inheritLastCamera=false;
 }
 return definition(type).schema.parse(settings);
}
export function controlsFor(type:string):readonly Control[]{return definition(type).controls;}
export function buildClip(context:ClipContext,c:ClipInstance){
  const d=definition(c.type);if(c.settingsVersion!==d.version)throw Error('Unsupported settings version.');
  const settings=settingsFor(c.type,c.settings);
  // Correlated union is checked when authoring each module; registry validates runtime input.
  return (d.build as (context:ClipContext,settings:Record<string,unknown>,common:ClipCommon)=>ReturnType<typeof presentation.build>)(context,settings,c);
}

export function migratePresentation(c:ClipInstance):ClipInstance {
 if(c.type==='presentation-vertical')return {...c,type:'presentation-build',settings:settingsFor('presentation-build',c.settings)};
 if(c.type!=='presentation')return c;
 const settings=presentation.schema.parse(c.settings),types={build:'presentation-build',rise:'presentation-build',scatter:'presentation-radial',wave:'presentation-wave',none:'presentation-ready'};
 const type=types[settings.assembly];return {...c,type,settings:settingsFor(type,settings)};
}

export function migrateScene(c:ClipInstance):ClipInstance{
 if(['reveal','display','transaction'].includes(c.type))return c;
 const s={...c.settings};
 const movements=s.movement;
 s.rotation=movements==='orbit'||movements==='rotating'||c.type==='panorama'?'rotating':'none';
 s.rotationSpeed=s.cameraSpeed??2;s.zoomEnabled=movements==='zoom-in'||movements==='push-in';s.zoomMode=movements==='zoom-in'||movements==='push-in'?'zoom-in':'none';
 s.cameraZoomStrength=s.zoomStrength??1;s.cameraZoomEasing=s.zoomEasing??'SineInOut';
 const types:Record<string,string>={'presentation-build':'build','presentation-wave':'wave','presentation-radial':'radial','presentation-gravity':'gravity','presentation-vertical':'build'};
 let type:string;
 if(c.type in types){type='reveal';s.revealType=types[c.type];}
 else if(c.type==='presentation'&&s.assembly!=='none'){type='reveal';s.revealType=s.assembly==='scatter'?'radial':s.assembly==='rise'?'build':s.assembly??'build';}
 else {type='display';s.displayAnimation='none';}
 if(type==='reveal'&&s.revealType==='radial'){
  s.radialDuration=s.revealFraction;
  s.radialStagger=s.stagger;
  s.radialIntensity=s.strength;
 }
 return {...c,type,settings:settingsFor(type,s)};
}
