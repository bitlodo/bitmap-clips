import { type TitleClip, type TextTemplate } from '../editor-model';
import type { TextCommon } from './types';

export function title(common:TextCommon,template:TextTemplate,text:string,kicker='',txIndex=0):TitleClip {
  return {id:common.id,label:template,text,kicker,txIndex,start:common.startFrame/30,duration:common.durationFrames/30,template,position:common.position,scale:common.scale,binding:null,sourceBinding:null,shotId:null,animation:'template',fadeIn:common.fadeInFrames/30,fadeOut:common.fadeOutFrames/30};
}
