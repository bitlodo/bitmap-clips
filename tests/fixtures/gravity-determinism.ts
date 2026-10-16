import snapshot from '../../src/demo.json';
import {makeClip} from '../../src/clips/film';
import {buildClip} from '../../src/clips/registry';
import type {SceneData} from '../../src/editor-model';

export function gravityDeterminismFixture(seed=42){
 const count=48,parcels=Array.from({length:count},(_,i)=>({...snapshot.layout.parcels[0]!,size:i%3+1,x:i%8,y:Math.floor(i/8),txIndex:i}));
 const data={...snapshot,txCount:count,layout:{width:16,height:16,parcels}} as SceneData;
 const clip=makeClip('presentation-gravity',120);clip.seed=seed;
 Object.assign(clip.settings,{speed:2,dropHeight:2,flow:6});
 return {data,clip,model:buildClip({data,look:'monument'},clip).engine.models[0]!};
}
