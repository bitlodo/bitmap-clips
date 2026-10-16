import type {BlockResult} from './lib/block';
import type {BitmapResult,WorkerMessage} from './lib/types';
import {sceneFromBlock} from './editor-model';
import type {StoredBitmap} from './project-library';
/** Block and inscription arrive independently; publish only a complete dataset. */
export class BitmapImport {
 private block:BlockResult|undefined;
 private inscription:BitmapResult|undefined;
 constructor(private height:number){}
 accept(message:WorkerMessage):StoredBitmap|undefined {
  if(message.type==='error'||message.type==='block-error')throw Error(message.message);
  if(message.type==='block-result'){if(message.result.height!==this.height)throw Error('Received another block.');this.block=message.result;}
  if(message.type==='result'){if(!message.result)throw Error('No bitmap inscription found for this block.');if(message.result.bitmap!==this.height||message.result.content!==`${this.height}.bitmap`)throw Error('Bitmap inscription does not match.');this.inscription=message.result;}
  if(!this.block||!this.inscription)return;
  return {height:this.height,updatedAt:Date.now(),block:this.block,inscription:this.inscription,data:sceneFromBlock(this.block)};
 }
}
