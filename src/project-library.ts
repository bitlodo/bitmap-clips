import {parseDocument,type Film} from './clips/film';
import type {SceneData} from './editor-model';
export interface StoredBitmap {height:number;updatedAt:number;block:import('./lib/block').BlockResult;inscription:import('./lib/types').BitmapResult;data:SceneData;}
export interface LocalProject {templatePending?:boolean;id:string;name:string;updatedAt:number;film:Film;data:SceneData;}
export class ProjectLibrary {
 private database:Promise<IDBDatabase>;
 constructor(){this.database=new Promise((resolve,reject)=>{const request=indexedDB.open('bitmap-projects',2);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});if(!db.objectStoreNames.contains('bitmaps'))db.createObjectStore('bitmaps',{keyPath:'height'});};request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};request.onblocked=()=>reject(Error('Close other Bitmap Clips tabs and try again.'));request.onerror=()=>reject(request.error);});void this.database.catch(()=>{});}
 private async request<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>,storeName='projects'):Promise<T>{
  const db=await this.database;return new Promise((resolve,reject)=>{const transaction=db.transaction(storeName,mode),request=operation(transaction.objectStore(storeName));transaction.oncomplete=()=>resolve(request.result);transaction.onerror=transaction.onabort=()=>reject(transaction.error??Error('Unable to complete local storage operation.'));});
 }
 async save(project:LocalProject){await this.request('readwrite',store=>store.put(project));}
 async get(id:string){const value=await this.request<LocalProject|undefined>('readonly',store=>store.get(id));if(!value)return;return {...value,...parseDocument({film:value.film,data:value.data})};}
 async delete(id:string){await this.request('readwrite',store=>store.delete(id));}
 async saveBitmap(bitmap:StoredBitmap){await this.request('readwrite',store=>store.put(bitmap),'bitmaps');}
 async getBitmap(height:number){return this.request<StoredBitmap|undefined>('readonly',store=>store.get(height),'bitmaps');}
 async list(){return (await this.request<LocalProject[]>('readonly',store=>store.getAll())).sort((a,b)=>b.updatedAt-a.updatedAt);}
}
