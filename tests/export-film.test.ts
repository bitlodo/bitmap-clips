import {test,expect} from 'bun:test';
import {qualityBitrate,copyEncodingFrame} from '../src/export-film';

test('export bitrate supports detailed motion at landscape, portrait and square sizes',()=>{
 expect(qualityBitrate(1280,720)).toBe(12_000_000);
 expect(qualityBitrate(720,1280)).toBe(12_000_000);
 expect(qualityBitrate(720,720)).toBe(12_000_000);
 expect(qualityBitrate(1920,1080)).toBe(24_000_000);
 expect(qualityBitrate(1080,1920)).toBe(24_000_000);
});

test('each encoded frame gets an opaque backing before copying the rendered scene',()=>{
 const calls:unknown[]=[];
 const ctx={fillStyle:'',fillRect:(...args:number[])=>calls.push(['fill',ctx.fillStyle,...args]),drawImage:(...args:unknown[])=>calls.push(['draw',...args])};
 const target={width:1280,height:720,getContext:()=>ctx} as unknown as HTMLCanvasElement;
 const source={} as HTMLCanvasElement;
 copyEncodingFrame(target,source);copyEncodingFrame(target,source);
 expect(calls).toEqual([
  ['fill','#000000',0,0,1280,720],['draw',source,0,0,1280,720],
  ['fill','#000000',0,0,1280,720],['draw',source,0,0,1280,720],
 ]);
});
