import {createHash} from 'node:crypto';
import {bakeDrop,DROP_PHYSICS_VERSION} from '../../src/drop-physics';
import {gravityDeterminismFixture} from './gravity-determinism';

if(import.meta.main){
 const {data,model}=gravityDeterminismFixture(Number(process.argv[2]??42));
 const bake=await bakeDrop(data,model);
 const digest=(values:Float32Array)=>createHash('sha256').update(new Uint8Array(values.buffer,values.byteOffset,values.byteLength)).digest('hex');
 console.log(JSON.stringify({version:DROP_PHYSICS_VERSION,framesHash:digest(bake.frames),birthsHash:digest(bake.birthTimes!),count:bake.count,fps:bake.fps,frameCount:bake.frameCount,seconds:bake.seconds}));
}
