import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
import {bakeDrop,emissionPoint,initPhysics,releaseDropCheckpoint,type DropCheckpoint} from '../src/drop-physics';
import {positiveCubeRoot} from '../src/deterministic-math';
import {gravityDeterminismFixture} from './fixtures/gravity-determinism';
import manifest from '../package.json';

const digest=(values:Float32Array)=>createHash('sha256').update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength)).digest('hex');
const runner=new URL('./fixtures/gravity-determinism-runner.ts',import.meta.url).pathname;
async function coldBake(seed=42){
 const process=Bun.spawn([Bun.argv[0]!,runner,String(seed)],{stdout:'pipe',stderr:'pipe'});
 const [output,errors,code]=await Promise.all([new Response(process.stdout).text(),new Response(process.stderr).text(),process.exited]);
 if(code!==0)throw Error(errors);
 return JSON.parse(output);
}

test('Gravity reproduces its exact versioned frames in independent processes',async()=>{
 expect(manifest.dependencies['@dimforge/rapier3d-deterministic-compat']).toBe('0.21.0');
 const expected={version:'faucet-10-rapier-deterministic-0.21.0',framesHash:'26df6c461c898d6aec88620e3e0b47329c47b1f627e3e6d1e1182d54947d578f',birthsHash:'2cd5c219e582ee220c11a0e2f53d5554fc01815b36e2447270381dc5557bab52',count:48,fps:30,frameCount:121,seconds:4};
 expect(await coldBake()).toEqual(expected);expect(await coldBake()).toEqual(expected);
 expect((await coldBake(7)).framesHash).not.toBe(expected.framesHash);
});

test('physics and legacy faucet height do not depend on native transcendental functions or random state',async()=>{
 const {data,model}=gravityDeterminismFixture();await initPhysics();
 const originals={sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt,cbrt:Math.cbrt,pow:Math.pow,random:Math.random};
 const forbidden=()=>{throw Error('Non-deterministic native math used in physics.');};
 try{
  Object.assign(Math,Object.fromEntries(Object.keys(originals).map(key=>[key,forbidden])));
  for(let i=0;i<100;i++){const point=emissionPoint(i,42,5);expect(point.x*point.x+point.z*point.z).toBeLessThanOrEqual(25);}
  const bake=await bakeDrop(data,model),legacy=await bakeDrop(data,{...model,simulationDuration:undefined});
  expect(bake.frames.every(Number.isFinite)).toBe(true);expect(legacy.frames.every(Number.isFinite)).toBe(true);
  expect(positiveCubeRoot(0)).toBe(0);expect(positiveCubeRoot(125)).toBe(5);
 }finally{Object.assign(Math,originals);}
});

test('saved inputs and yielding callbacks reproduce the same cube trajectory',async()=>{
 const {data,model}=gravityDeterminismFixture(),first=await bakeDrop(data,model);
 const saved=JSON.parse(JSON.stringify({data,model}));
 const reopened=await bakeDrop(saved.data,saved.model,()=>{},()=>{});
 expect(reopened.frames).toEqual(first.frames);expect(reopened.birthTimes).toEqual(first.birthTimes);
});

test('resizing at different frames and seeds remains byte-identical to a fresh bake',async()=>{
 for(const seed of [42,7,123]){
  const {data,model}=gravityDeterminismFixture(seed),direct=await bakeDrop(data,model);
  for(const seconds of [.5,37/30,62/30,3]){
   let checkpoint:DropCheckpoint|undefined;
   const prefix=await bakeDrop(data,{...model,simulationDuration:seconds},()=>{},undefined,undefined,state=>{checkpoint=state;});
   if(seed===42&&seconds===.5)await expect(bakeDrop(data,model,()=>{},undefined,{...checkpoint!,version:'old-physics'})).rejects.toThrow('different simulation version');
   const continued=await bakeDrop(data,model,()=>{},undefined,checkpoint);
   expect(continued.frames.slice(0,prefix.frames.length)).toEqual(prefix.frames.slice());
   expect(digest(continued.frames)).toBe(digest(direct.frames));expect(digest(continued.birthTimes!)).toBe(digest(direct.birthTimes!));
  }
 }
});

test('discarded live checkpoints release their WASM world and cannot be resumed',async()=>{
 const {data,model}=gravityDeterminismFixture();let checkpoint:DropCheckpoint|undefined;
 await bakeDrop(data,{...model,simulationDuration:.5},()=>{},undefined,undefined,state=>{checkpoint=state;});
 expect(checkpoint!.world).not.toBeNull();releaseDropCheckpoint(checkpoint!);expect(checkpoint!.world).toBeNull();
 releaseDropCheckpoint(checkpoint!);
 await expect(bakeDrop(data,model,()=>{},undefined,checkpoint)).rejects.toThrow('already consumed or released');
});
