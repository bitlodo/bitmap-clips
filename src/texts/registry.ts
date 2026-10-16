import {bitmapIdentity} from './bitmap-identity';
import {caption} from './caption';
import {classicTexts} from './classic';
import {transactionLabels} from './transaction-labels';
import {uid} from '../editor-model';
import type {TextCommon,TextContext,TextInstance,TextPlan} from './types';

export const texts=[bitmapIdentity,...classicTexts,caption];
export function textDefinition(type:string){const d=[...texts,transactionLabels].find(d=>d.id===type);if(!d)throw Error(`Unknown text template: ${type}`);return d;}
export function textSettingsFor(type:string,value:unknown):Record<string,unknown>{return textDefinition(type).schema.parse(value);}
export function makeText(type:string,startFrame:number,durationFrames=textDefinition(type).duration.default,settings:Record<string,unknown>={}):TextInstance {
  return {id:uid(),type,settingsVersion:1,startFrame,durationFrames,fadeInFrames:7.5,fadeOutFrames:7.5,settings:textSettingsFor(type,settings),position:'bottom',scale:1,textStyleOverride:null};
}
export function buildText(context:TextContext,text:TextInstance):TextPlan {
  const d=textDefinition(text.type);if(text.settingsVersion!==d.version)throw Error('Unsupported text settings version.');
  const settings=d.schema.parse(text.settings);
  return (d.build as (context:TextContext,settings:Record<string,unknown>,common:TextCommon)=>TextPlan)(context,settings,text);
}
