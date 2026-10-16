import type {Film} from './clips/film';
import {sceneStyleSchema,type SceneStyle} from './scene-style';
import {textStyleSchema,type TextStyle} from './text-style';
/** Presets resolve to ordinary settings; scope controls whether item overrides survive. */
export function applySceneDefaults(film:Film,look:Film['look'],style:SceneStyle,resetOverrides=false):Film{
 const parsed=sceneStyleSchema.parse(style),next=structuredClone(film);next.look=look;next.sceneStyle=parsed;
 if(resetOverrides)for(const item of next.clips)item.styleOverride=null;
 return next;
}
export function applyTextDefaults(film:Film,style:TextStyle,resetOverrides=false):Film{
 const parsed=textStyleSchema.parse(style),next=structuredClone(film);next.textStyle=parsed;
 if(resetOverrides)for(const item of next.texts)item.textStyleOverride=null;
 return next;
}
