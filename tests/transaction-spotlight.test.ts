import {expect,test} from 'bun:test';
import snapshot from '../src/demo.json';
import {type SceneData} from '../src/editor-model';
import {makeClip} from '../src/clips/film';
import {buildClip} from '../src/clips/registry';
import {modelState} from '../src/model-motion';
import {sampleCamera} from '../src/camera-motion';

const data=snapshot as SceneData;
test('Transaction lifts its selected parcel above the context and returns it without a jump',()=>{
 for(const treatment of ['highlight','isolate'])for(const frames of [30,300,1800]){
  const clip=makeClip('transaction',frames);Object.assign(clip.settings,{treatment,target:'selected',txIndex:0});
  const plan=buildClip({data,look:'monument'},clip),p=plan.engine,effect=p.models.find(m=>m.kind===treatment)!;
  const settled=p.shots[0]!.duration*.8;
  expect(modelState(p,0).targetLift).toBe(0);
  expect(modelState(p,settled).targetLift).toBeGreaterThan(Math.max(...data.layout.parcels.map(x=>x.size-.5)));
  expect(modelState(p,settled).context?.txIndex).toBe(0);
  expect(modelState(p,p.duration).targetLift).toBe(0);
  for(const aspect of [9/16,1,16/9]){
   const raised=sampleCamera(data,p,settled,aspect);
   const unlifted=structuredClone(p);delete unlifted.models.find(m=>m.id===effect.id)!.targetLift;
   const original=sampleCamera(data,unlifted,settled,aspect);
   expect(raised.target.y-original.target.y).toBeCloseTo(modelState(p,settled).targetLift);
   expect(raised.position.y-original.position.y).toBeCloseTo(modelState(p,settled).targetLift);
   const boundary=p.shots[1]!.start;
   const before=sampleCamera(data,p,boundary-1e-7,aspect),after=sampleCamera(data,p,boundary,aspect);
   expect(before.position.distanceTo(after.position)).toBeLessThan(.001);
  }
 }
});

test('Transaction without return holds the lifted detail through the last frame',()=>{
 const clip=makeClip('transaction');Object.assign(clip.settings,{returnWide:false,movement:'still'});
 const p=buildClip({data,look:'monument'},clip).engine;
 expect(modelState(p,p.duration).targetLift).toBeGreaterThan(0);
 expect(sampleCamera(data,p,p.duration,1).position.toArray()).toEqual(sampleCamera(data,p,p.duration*.8,1).position.toArray());
});
