import {expect,test} from 'bun:test';
import {createHandler} from '../src/http';
import {OrdinalsClient} from '../src/lib/ordinals';

test('static preview serves public assets without backend routes',async()=>{
 const handle=createHandler();
 expect((await handle(new Request('http://localhost/'))).status).toBe(200);
 for(const path of ['/package.json','/api/config','/api/ord/r/blockheight'])expect((await handle(new Request('http://localhost'+path))).status).toBe(404);
 expect((await handle(new Request('http://localhost/',{method:'POST'}))).status).toBe(405);
 expect(await (await handle(new Request('http://localhost/',{method:'HEAD'}))).text()).toBe('');
});

test('Ordinals requests use direct CORS access without credentials and retain refetch settings',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];
 const api=new OrdinalsClient(undefined,(async(input,init)=>{calls.push({url:String(input),init});return new Response('942000');}) as typeof fetch,'no-store');
 expect(await api.text('/r/blockheight')).toBe('942000');
 expect(calls[0]!.url).toBe('https://ordinals.com/r/blockheight');
 expect(calls[0]!.init).toMatchObject({mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'*/*'}});
});

test('direct Ordinals failures preserve status and cancellation',async()=>{
 const api=new OrdinalsClient(undefined,(async()=>new Response('limited',{status:429})) as unknown as typeof fetch);
 await expect(api.json('/r/blockheight')).rejects.toMatchObject({status:429});
 const controller=new AbortController();controller.abort();
 await expect(api.json('/r/blockheight',controller.signal)).rejects.toThrow();
});
