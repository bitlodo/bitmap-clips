import {test,expect} from 'bun:test';
import {BitmapImport} from '../src/bitmap-import';
import {lookupBlock} from '../src/lib/block';
import {OrdinalsClient} from '../src/lib/ordinals';
import type {BitmapResult} from '../src/lib/types';
import fixture from './fixtures/block-57043-live.json';
const inscription:BitmapResult={bitmap:57043,id:'fixturei0',content:'57043.bitmap',info:{id:'fixturei0'},recursiveInfo:{id:'fixturei0',height:57043},source:'oci',tip:900000,checkedAt:'2026-10-08',warnings:[]};
async function block(){return lookupBlock(57043,new OrdinalsClient('https://fixture.test',(async input=>Response.json(String(input).endsWith('/r/block/57043')?fixture.hex:fixture.info)) as typeof fetch));}
test('bitmap import waits for both independent results and preserves the complete raw dataset',async()=>{
 const loaded=await block();expect(loaded.rawHex).toBe(fixture.hex);
 for(const blockFirst of [true,false]){
  const collector=new BitmapImport(57043),first=blockFirst?{type:'block-result' as const,result:loaded}:{type:'result' as const,result:inscription},second=blockFirst?{type:'result' as const,result:inscription}:{type:'block-result' as const,result:loaded};
  expect(collector.accept(first)).toBeUndefined();const record=collector.accept(second)!;
  expect(record.block.rawHex).toBe(fixture.hex);expect(record.block.block.txs).toHaveLength(2);expect(record.inscription.recursiveInfo).toEqual(inscription.recursiveInfo);
  expect(record.data.height).toBe(57043);expect(record.data.layout).toEqual(loaded.layout);expect(structuredClone(record).block.rawHex).toBe(fixture.hex);
 }
});
test('missing inscriptions, mismatched data and network failures never produce a reusable dataset',async()=>{
 const loaded=await block(),collector=new BitmapImport(57043);collector.accept({type:'block-result',result:loaded});
 expect(()=>collector.accept({type:'result',result:null})).toThrow('No bitmap inscription');
 expect(()=>new BitmapImport(57043).accept({type:'result',result:{...inscription,content:'123.bitmap'}})).toThrow('does not match');
 expect(()=>new BitmapImport(1).accept({type:'block-result',result:loaded})).toThrow('another block');
 expect(()=>collector.accept({type:'error',message:'Inscription network failed'})).toThrow('Inscription network failed');
 expect(()=>collector.accept({type:'block-error',message:'Block network failed'})).toThrow('Block network failed');
});
